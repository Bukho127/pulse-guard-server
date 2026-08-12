const { getMobileCrimeAnalytics } = require('../services/mobileCrimeAnalyticsService');

const REQUEST_EVENT = 'mobile:crime-analytics:request';
const UPDATE_EVENT = 'mobile:crime-analytics:update';
const ERROR_EVENT = 'mobile:crime-analytics:error';

const emitAnalyticsError = (socket, error, ack) => {
  const payload = {
    message: error.message,
    statusCode: error.statusCode || 500
  };

  socket.emit(ERROR_EVENT, payload);

  if (typeof ack === 'function') {
    ack({
      success: false,
      error: payload
    });
  }
};

const handleMobileCrimeAnalyticsRequest = async (socket, payload = {}, ack) => {
  try {
    if (socket.user?.role !== 'user') {
      const error = new Error('Only mobile users can request local crime analytics');
      error.statusCode = 403;
      throw error;
    }

    const analytics = await getMobileCrimeAnalytics(payload.h3Index);

    socket.emit(UPDATE_EVENT, analytics);

    if (typeof ack === 'function') {
      ack({
        success: true,
        data: analytics
      });
    }
  } catch (error) {
    console.error('[mobileCrimeAnalytics] Request failed:', error.message);
    emitAnalyticsError(socket, error, ack);
  }
};

const registerMobileCrimeAnalyticsSocket = (socket) => {
  socket.on(REQUEST_EVENT, (payload, ack) => {
    handleMobileCrimeAnalyticsRequest(socket, payload, ack);
  });
};

module.exports = {
  REQUEST_EVENT,
  UPDATE_EVENT,
  ERROR_EVENT,
  handleMobileCrimeAnalyticsRequest,
  registerMobileCrimeAnalyticsSocket
};
