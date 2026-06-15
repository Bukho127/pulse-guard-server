const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { connectDB, sequelize } = require('./config/db');
require('dotenv').config();
const { setIo } = require('./services/socketService');
const { startIncidentNotificationWorker } = require('./services/incidentNotificationQueue');

// Log database connection details for debugging purposes 
console.log({
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME
});

const PORT = process.env.PORT || 5000;

// ==================== IMPORTS ====================
// Routes
const userRoutes = require('./routes/userRoutes');
const policePersonnelRoutes = require('./routes/policePersonnelRoutes.js');
const incidentRoutes = require('./routes/incidentRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// ==================== DATABASE ASSOCIATIONS ====================
const associations = require('./models/associations'); // Ensure associations are defined before syncing the database

// Models
const User = require('./models/userModel');
const PolicePersonnel = require('./models/policePersonnelModel');
const Incident = require('./models/incidentModel');
const Notification = require('./models/notificationModel');

// ==================== EXPRESS & SERVER SETUP ====================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: false,
  optionsSuccessStatus: 204,
};

// ==================== MIDDLEWARE ====================
app.use(cors(corsOptions));
app.use(express.json());


// ==================== SOCKET.IO AUTHENTICATION ====================
setIo(io);

io.use((socket, next) => {
  try {
    const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid socket token'));
  }
});

io.on('connection', (socket) => {
  if (socket.user?.role === 'personnel') {
    const personnelId = socket.user.security_personnel_id || socket.user.id;
    if (personnelId) {
      socket.join(`personnel:${personnelId}`);
    }
  } else {
    const userId = socket.user?.user_id || socket.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  }
});

// ==================== ROUTES ====================
app.use('/', incidentRoutes);
app.use('/', policePersonnelRoutes);
app.use('/', heatmapRoutes);
app.use('/', userRoutes);
app.use('/', notificationRoutes);

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ==================== DATABASE & SERVER START ====================
connectDB().then(async (connected) => {
  if (connected) {
    try {
      await sequelize.sync();
      console.log('Database synced successfully');
      startIncidentNotificationWorker();

      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('Database sync failed:', error.message);
    }
  }
});

module.exports = { app, server, io };
