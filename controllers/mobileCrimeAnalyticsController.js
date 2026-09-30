const { getMobileCrimeAnalytics } = require('../services/mobileCrimeAnalyticsService');

const REQUEST_EVENT = 'mobile:crime-analytics:request';
const UPDATE_EVENT = 'mobile:crime-analytics:update';
const ERROR_EVENT = 'mobile:crime-analytics:error';

const getSocketUserId = (socket) => {
  return socket.user?.user_id || socket.user?.id || socket.user?.security_personnel_id || null;
};

const emitAnalyticsError = (socket, error, ack) => {
  const payload = {
    message: error.message,
    statusCode: error.statusCode || 500
  };

  socket.emit(ERROR_EVENT, payload);

  if (typeof ack === 'function') {
    ack({
      success: false,
      message: payload.message,
      error: payload
    });
  }
};

const handleMobileCrimeAnalyticsRequest = async (socket, payload = {}, ack) => {
  const startedAt = Date.now();
  const h3Index = payload?.h3Index;

  console.log('[mobileCrimeAnalytics] Request received', {
    socketId: socket.id,
    userId: getSocketUserId(socket),
    role: socket.user?.role,
    h3Index,
    hasAck: typeof ack === 'function'
  });

  try {
    if (socket.user?.role !== 'user') {
      const error = new Error('Only mobile users can request local crime analytics');
      error.statusCode = 403;
      throw error;
    }

    const analytics = await getMobileCrimeAnalytics(payload.h3Index);

    socket.emit(UPDATE_EVENT, analytics);

    console.log('[mobileCrimeAnalytics] Request succeeded', {
      socketId: socket.id,
      userId: getSocketUserId(socket),
      h3Index,
      totalIncidentCount: analytics.totalIncidentCount,
      localCrimePoints: analytics.localCrimePoints.length,
      cellCounts: analytics.cellCounts.length,
      hotspots: analytics.hotspots.length,
      durationMs: Date.now() - startedAt
    });

    if (typeof ack === 'function') {
      ack({
        success: true,
        data: analytics
      });
    }
  } catch (error) {
    console.error('[mobileCrimeAnalytics] Request failed', {
      socketId: socket.id,
      userId: getSocketUserId(socket),
      role: socket.user?.role,
      h3Index,
      message: error.message,
      statusCode: error.statusCode || 500,
      durationMs: Date.now() - startedAt
    });
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
