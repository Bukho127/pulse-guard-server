const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { connectDB, sequelize } = require('./config/db');
require('dotenv').config();
const { setIo } = require('./services/socketService');


const PORT = process.env.PORT || 5000;

// Importing routes
const userRoutes = require('./routes/userRoutes'); 
const policePersonnelRoutes = require('./routes/policePersonnelRoutes.js');
const incidentRoutes = require('./routes/incidentRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Importing models to establish associations
const User = require('./models/userModel');
const Incident = require('./models/incidentModel');
const Notification = require('./models/notificationModel');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

User.hasMany(Incident, { foreignKey: 'user_id' });
Incident.belongsTo(User, { foreignKey: 'user_id' });
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

app.use(express.json());

app.use('/', incidentRoutes);
app.use('/', policePersonnelRoutes);
app.use('/', heatmapRoutes);
app.use('/', userRoutes); 
app.use('/', notificationRoutes);



connectDB().then(async (connected) => {
    if (connected) {
        try {
            await sequelize.sync(); // Sync models without altering existing table indexes/constraints
            console.log('Database synced successfully');

            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        } catch (error) {
            console.error('Database sync failed:', error.message);
        }
    }
});
