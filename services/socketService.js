let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

const getIo = () => ioInstance;

const emitNotificationToRecipient = ({ recipientType, recipientId, notification }) => {
  console.log("EMIT DEBUG:", {
    recipientType,
    recipientId,
    room: `${recipientType}:${recipientId}`
  });

  if (!ioInstance) {
    console.log("NO IO INSTANCE");
    return;
  }

  ioInstance
    .to(`${recipientType}:${recipientId}`)
    .emit("notification:new", notification);

  console.log("EMIT ROOM:", `${recipientType}:${recipientId}`);
  console.log("IO EXISTS:", !!ioInstance);
};



module.exports = {
  setIo,
  getIo,
  emitNotificationToRecipient
};