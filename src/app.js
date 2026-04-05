require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Route Imports
const downloadRoutes = require('./routes/download.routes');
const statusRoutes = require('./routes/status.routes');
const userRoutes = require('./routes/user.routes');
const apiLimiter = require('./middlewares/rateLimit.middleware');

const app = express();

// Middlewares
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the old frontend GUI so it is accessible natively on port 3001 during local dev
app.use(express.static(path.join(__dirname, '../../vidssave')));

// Serve static downloads (Using absolute path so frontend can reach it via backend server)
app.use('/downloads', express.static(path.join(__dirname, '../downloads'), {
  setHeaders: function (res, filePath) {
    res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(filePath) + '"');
  }
}));

// Register Routes
app.use('/api', apiLimiter, downloadRoutes);
app.use('/api', apiLimiter, statusRoutes);
app.use('/api/users', userRoutes);

// General Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ status: 0, msg: err.message || 'Internal Server Error' });
});

module.exports = app;
