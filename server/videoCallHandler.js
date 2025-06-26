const activeVideoCalls = new Map();

const handleVideoCall = (io, socket) => {
  socket.on('start-video-call', (data) => {
    const { channel, caller } = data;
    
    if (!activeVideoCalls.has(channel)) {
      activeVideoCalls.set(channel, {
        participants: [{ id: socket.id, username: caller }],
        caller
      });
      
      // Уведомить всех пользователей в канале о начале видеозвонка
      socket.to(channel).emit('video-call-started', {
        caller,
        channel
      });
    }
  });

  socket.on('join-video-call', (data) => {
    const { channel, username } = data;
    
    if (activeVideoCalls.has(channel)) {
      const call = activeVideoCalls.get(channel);
      
      // Проверяем, не присоединился ли уже этот пользователь
      if (!call.participants.find(p => p.id === socket.id)) {
        call.participants.push({ id: socket.id, username: username || 'Участник' });
        
        // Присоединяем сокет к комнате канала для видеозвонка
        socket.join(channel);
        
        // Уведомить других участников о новом пользователе
        socket.to(channel).emit('user-joined-video-call', {
          userId: socket.id,
          username: username || 'Участник'
        });
        
        // Отправить новому участнику список всех существующих участников
        call.participants.forEach(participant => {
          if (participant.id !== socket.id) {
            socket.emit('user-joined-video-call', {
              userId: participant.id,
              username: participant.username
            });
          }
        });
      }
    }
  });

  // Добавляем обработчики для WebRTC сигналинга
  socket.on('webrtc-offer', (data) => {
    socket.to(data.target).emit('webrtc-offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.target).emit('webrtc-answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.target).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  socket.on('leave-video-call', (data) => {
    const { channel } = data;
    
    if (activeVideoCalls.has(channel)) {
      const call = activeVideoCalls.get(channel);
      call.participants = call.participants.filter(p => p.id !== socket.id);
      
      socket.leave(channel);
      
      if (call.participants.length === 0) {
        activeVideoCalls.delete(channel);
        socket.to(channel).emit('video-call-ended');
      } else {
        socket.to(channel).emit('user-left-video-call', {
          userId: socket.id
        });
      }
    }
  });

  socket.on('disconnect', () => {
    // Удалить пользователя из всех активных видеозвонков
    for (const [channel, call] of activeVideoCalls.entries()) {
      const participantIndex = call.participants.findIndex(p => p.id === socket.id);
      if (participantIndex !== -1) {
        call.participants.splice(participantIndex, 1);
        
        if (call.participants.length === 0) {
          activeVideoCalls.delete(channel);
          socket.to(channel).emit('video-call-ended');
        } else {
          socket.to(channel).emit('user-left-video-call', {
            userId: socket.id
          });
        }
      }
    }
  });
};

module.exports = handleVideoCall;
