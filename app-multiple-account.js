const { Client, MessageMedia , LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const mongoose = require('mongoose');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(fileUpload({
  debug: false
}));

app.get('/', (req, res) => {
  res.sendFile('index-multiple-account.html', {
    root: __dirname
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define o esquema do modelo de sessão
const sessionSchema = new mongoose.Schema({
  id: String,
  description: String,
  ready: Boolean,
  // Outros campos necessários
});

// Cria o modelo de sessão
const Session = mongoose.model('Session', sessionSchema);

// Função para criar uma nova sessão e salvá-la no MongoDB
const createSession = async function (id, description) {
  console.log('Creating session: ' + id);
  
  const session = new Session({
    id: id,
    description: description,
    ready: false,
    // Outros campos necessários
  });

  try {
    await session.save();
    console.log('Session created and saved to MongoDB');
  } catch (err) {
    console.error('Error saving session to MongoDB:', err);
  }

  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },

    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },

    authStrategy: new LocalAuth({
      clientId: id
    })
  });

  client.on('message', msg => {
    io.emit('message', { id: id, text: msg.body });
  
    if (msg.body == '!ping') {
      msg.reply('pong');
      client.sendMessage(msg.from, 'Esta é uma mensagem automática Reputação 360');
    } else if (msg.body == 'bom dia !') {
      msg.reply('Bom dia, como está?!');
      client.sendMessage(msg.from, 'Esta é uma mensagem automática Reputação 360');
    } else if (msg.body == 'tou bem !') {
      msg.reply('Que bom que está bem, como posso ajudar?!');
      client.sendMessage(msg.from, 'Esta é uma mensagem automática Reputação 360');
    } else if (msg.body == '!atendimento') {
      const atendimentoOptions = {
        message: 'Selecione uma opção de atendimento:',
        action: 'Selecionar',
        options: [
          { title: 'Consulta' },
          { title: 'Suporte Técnico' },
          { title: 'Cancelamento de Serviço' },
          { title: 'Ver Website' }
        ]
      };
      msg.reply(atendimentoOptions.message);
      atendimentoOptions.options.forEach((option, index) => {
        msg.reply(`${index + 1}: ${option.title}`);
      });
    } else if (msg.body == '1') {
      msg.reply('Você selecionou Consulta. Por favor, forneça mais detalhes sobre sua consulta.');
    } else if (msg.body == '2') {
      msg.reply('Você selecionou Suporte Técnico. Como posso ajudá-lo com o suporte técnico?');
    } else if (msg.body == '3') {
      msg.reply('Você selecionou Cancelamento de Serviço. Por favor, entre em contato conosco para mais informações sobre o cancelamento.');
    } else if (msg.body == '4') {
      msg.reply('Aqui está o link para o website da Reputação 360: https://reputacao360.com');
    } else if (msg.body == '!groups') {
      client.getChats().then(chats => {
        if (chats.length == 0) {
          msg.reply('You have no group yet.');
        } else {
          let replyMsg = '*YOUR GROUPS*\n\n';
          chats.forEach((group, i) => {
            replyMsg += `ID: ${group.id}\nType: ${group.isGroup}\nLastMsg: ${group.lastMessage}\nTime: ${group.timestamp}\nName: ${group.name}\n\n`;
          });
          replyMsg += '_You can use the group id to send a message to the group._'
          msg.reply(replyMsg);
          client.sendMessage(msg.from, replyMsg);
          io.emit('chats', { id: id, text: replyMsg });
        }
      });
    }
  });
  

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, src: url });
      io.emit('message', { id: id, text: 'QR Code received, scan please!' });
    });
  });

  client.on('ready', async () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is ready!' });

    const savedSessions = await getSessionsFromMongoDB();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    await updateSessionInMongoDB(id, { ready: true });
 
    client.getChats().then(chats => {
      //const groups = chats.filter(chat => chat.isGroup);

      if (chats.length == 0) {
        
      } else {
        let replyMsg = '*YOUR GROUPS*\n\n';
        chats.forEach((group, i) => {
          replyMsg += group;
          replyMsg += `ID: ${group.id}\n\nType: ${group.isGroup}LastMsg: ${group.lastMessage}\n\nTime: ${group.timestamp}\n\nName: ${group.name}\n\n`;
        });
        replyMsg += '_You can use the group id to send a message to the group._'
        
        io.emit('chats', { id: id, text: replyMsg });
      }
    });
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is authenticated!' });
  });

  client.on('auth_failure', function () {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', async (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected! because:' + reason });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = await getSessionsFromMongoDB();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    await Session.deleteOne({ id: id });
    io.emit('remove-session', id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = await getSessionsFromMongoDB();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {

    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    await Session.create({
      id: id,
      description: description,
      ready: false,
    });
  }

  
  client.initialize();
}


const getSessionsFromMongoDB = async () => {
  try {
    const sessions = await Session.find({});
    return sessions;
  } catch (error) {
    console.error('Error fetching sessions from MongoDB:', error);
    return [];
  }
};

// Função para atualizar uma sessão no MongoDB
const updateSessionInMongoDB = async (id, update) => {
  try {
    await Session.updateOne({ id: id }, update);
  } catch (error) {
    console.error('Error updating session in MongoDB:', error);
  }
};

// Array para armazenar as sessões
const sessions = [];

// Restante do seu código...

// Função de inicialização
const init = function (socket) {
  getSessionsFromMongoDB().then(savedSessions => {
    if (savedSessions.length > 0) {
      if (socket) {
        savedSessions.forEach((e, i, arr) => {
          arr[i].ready = false;
        });

        socket.emit('init', savedSessions);
      } else {
        savedSessions.forEach(sess => {
          createSession(sess.id, sess.description);
        });
      }
    }
  });
};

// Restante do seu código...

// Socket IO
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});

// Send message
// Alterações na função de envio de mensagem para verificar e esperar pela inicialização da sessão
app.post('/send-message', async (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  try {
    // Recupera a sessão do MongoDB
    const session = await Session.findOne({ id: sender });

    // Verifica se a sessão existe e está pronta
    if (!session || !session.ready) {
      return res.status(422).json({
        status: false,
        message: `A sessão ${sender} não está pronta para enviar mensagens`
      });
    }

    // Obtém o cliente WhatsApp da sessão
    const client = session.client;

    // Verifica se o número está registrado no WhatsApp
    /*const isRegisteredNumber = await client.isisRegisteredUser(number);
    if (!isRegisteredNumber) {
      return res.status(422).json({
        status: false,
        message: 'O número não está registrado no WhatsApp'
      });
    }*/

    // Envia a mensagem
    const response = await client.sendMessage(number, message);
    res.status(200).json({
      status: true,
      response: response
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      status: false,
      message: 'Erro interno ao enviar mensagem'
    });
  }
});


server.listen(process.env.PORT || 8000, function () {
  console.log('App running on *: ' + (process.env.PORT || 8000));
});

server.keepAliveTimeout = 6000000;
