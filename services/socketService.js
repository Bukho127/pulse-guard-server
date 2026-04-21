let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

const getIo = () => ioInstance;

const emitNotificationToRecipient = ({ recipientType, recipientId, notification }) => {
  if (!ioInstance || !recipientType || !recipientId) {
    return;
  }

  ioInstance.to(`${recipientType}:${recipientId}`).emit('notification:new', notification);
};

module.exports = {
  setIo,
  getIo,
  emitNotificationToRecipient
};
