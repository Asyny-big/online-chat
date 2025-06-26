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
        
        // Уведомить других участников о новом пользователе
        socket.to(channel).emit('user-joined-video-call', {
          userId: socket.id,
          username: username || 'Участник'
        });
        
        // Отправить новому участнику список всех участников
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

  socket.on('leave-video-call', (data) => {
    const { channel } = data;
    
    if (activeVideoCalls.has(channel)) {
      const call = activeVideoCalls.get(channel);
      call.participants = call.participants.filter(p => p.id !== socket.id);
      
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

  // Новый обработчик для сигналов WebRTC
  socket.on('video-signal', (data) => {
    const { channel, to, ...rest } = data;
    if (to) {
      io.to(to).emit('video-signal', {
        ...rest,
        from: socket.id,
        channel
      });
    }
  });
};

module.exports = handleVideoCall;
