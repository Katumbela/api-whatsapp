const { Client, MessageMedia , LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

/**
 * BASED ON MANY QUESTIONS
 * Actually ready mentioned on the tutorials
 * 
 * The two middlewares above only handle for data json & urlencode (x-www-form-urlencoded)
 * So, we need to add extra middleware to handle form-data
 * Here we can use express-fileupload
 */
app.use(fileUpload({
  debug: false
}));

app.get('/', (req, res) => {
  res.sendFile('index-multiple-account.html', {
    root: __dirname
  });
});

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function (id, description) {
  console.log('Creating session: ' + id);
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

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
 
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

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected! because:' + reason });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {

    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }

  
client.initialize();
}

const init = function (socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       * 
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
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
}

init();

// Socket IO
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});

// Send message
app.post('/send-message', async (req, res) => {
  console.log(req);

  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }

  /**
   * Check if the number is already registered
   * Copied from app.js
   * 
   * Please check app.js for more validations example
   * You can add the same here!
   */
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});




server.listen(port, function () {
  console.log('App running on *: ' + port);
});

server.keepAliveTimeout = 600000;
