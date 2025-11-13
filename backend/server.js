const express = require('express');
const cors = require('cors');
require('dotenv').config();

const employeesRoutes = require('./routes/employees');
const equipmentRoutes = require('./routes/equipment');
const statisticsRoutes = require('./routes/statistics');
const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const notificationsRoutes = require('./routes/notifications');
const leaveRequestsRoutes = require('./routes/leaveRequests');
const overtimeRequestsRoutes = require('./routes/overtimeRequests');
const attendanceRequestsRoutes = require('./routes/attendanceRequests');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/employees', employeesRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/leave-requests', leaveRequestsRoutes);
app.use('/api/overtime-requests', overtimeRequestsRoutes);
app.use('/api/attendance-adjustments', attendanceRequestsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'HR Management System API',
        version: '1.0.0',
        endpoints: {
            employees: '/api/employees',
            equipment: '/api/equipment',
            statistics: '/api/statistics',
            auth: '/api/auth',
            requests: '/api/requests',
            notifications: '/api/notifications',
        leaveRequests: '/api/leave-requests',
        overtimeRequests: '/api/overtime-requests',
        attendanceAdjustments: '/api/attendance-adjustments'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error: ' + err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
