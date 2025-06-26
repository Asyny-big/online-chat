const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const handleVideoCall = require('./videoCallHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Обработка видеозвонков
  handleVideoCall(io, socket);

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});