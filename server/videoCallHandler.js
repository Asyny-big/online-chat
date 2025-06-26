const activeVideoCalls = new Map();

const handleVideoCall = (io, socket) => {
  socket.on('start-video-call', (data) => {
    const { channel, caller } = data;
    
    if (!activeVideoCalls.has(channel)) {
      activeVideoCalls.set(channel, {
        participants: [socket.id],
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
    const { channel } = data;
    
    if (activeVideoCalls.has(channel)) {
      const call = activeVideoCalls.get(channel);
      call.participants.push(socket.id);
      
      // Уведомить других участников о новом пользователе
      socket.to(channel).emit('user-joined-video-call', {
        userId: socket.id
      });
    }
  });

  socket.on('leave-video-call', (data) => {
    const { channel } = data;
    
    if (activeVideoCalls.has(channel)) {
      const call = activeVideoCalls.get(channel);
      call.participants = call.participants.filter(id => id !== socket.id);
      
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
      if (call.participants.includes(socket.id)) {
        call.participants = call.participants.filter(id => id !== socket.id);
        
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
