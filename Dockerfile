# Use a imagem do Ubuntu 20.04 como base
FROM ubuntu

# Atualiza o sistema e instala as dependências necessárias
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    libnss3 \
    && rm -rf /var/lib/apt/lists/*
RUN apt-get install libatk-bridge2.0-0

# Instalação do PM2 globalmente
RUN npm install pm2 -g

# Criação do diretório de trabalho
WORKDIR /app

# Copia os arquivos do aplicativo
COPY . .

# Instalação das dependências do aplicativo
RUN npm install

# Comando para iniciar o aplicativo usando PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
