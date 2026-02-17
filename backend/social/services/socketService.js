function emitToUserSockets(app, userId, eventName, payload) {
  if (!app || !userId || !eventName) return;

  const io = app.get('io');
  const socketData = app.get('socketData');
  const userSockets = socketData?.userSockets;
  const sockets = userSockets?.get?.(String(userId));

  if (!io || !sockets || sockets.size === 0) return;

  sockets.forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });
}

function emitToUsers(app, userIds, eventName, payload) {
  const uniqueUsers = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));
  uniqueUsers.forEach((userId) => emitToUserSockets(app, userId, eventName, payload));
}

module.exports = {
  emitToUserSockets,
  emitToUsers
};
