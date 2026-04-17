const express = require('express');
const { connectDB, sequelize } = require('./config/db');
require('dotenv').config();


const PORT = process.env.PORT || 5000;

const userRoutes = require('./routes/userRoutes'); 
const policePersonnelRoutes = require('./routes/policePersonnelRoutes.js');
const incidentRoutes = require('./routes/incidentRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const User = require('./models/userModel');
const Incident = require('./models/incidentModel');
const app = express();

User.hasMany(Incident, { foreignKey: 'user_id' });
Incident.belongsTo(User, { foreignKey: 'user_id' });

app.use(express.json());



app.use('/', incidentRoutes);
app.use('/', policePersonnelRoutes);
app.use('/', heatmapRoutes);
app.use('/', userRoutes); 


connectDB().then(async (connected) => {
    if (connected) {
        try {
            await sequelize.sync(); // Sync models without altering existing table indexes/constraints
            console.log('Database synced successfully');

            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        } catch (error) {
            console.error('Database sync failed:', error.message);
        }
    }
});
