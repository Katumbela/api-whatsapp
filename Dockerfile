# Use a imagem oficial do Node.js como base
FROM node:14-alpine

# Criação do diretório de trabalho
WORKDIR /app

# Instalação das dependências
COPY package*.json ./
RUN npm install

# Copia os arquivos do aplicativo
COPY . .

# Instalação do PM2 globalmente
RUN npm install pm2 -g

# Comando para iniciar o aplicativo usando PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
