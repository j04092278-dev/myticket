const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { limiter, authLimiter } = require('./middleware/rateLimit');
const sanitizeInput = require('./middleware/sanitize');

const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const boletoRoutes = require('./routes/boletoRoutes');
const ineRoutes = require('./routes/ineRoutes');
const pagoRoutes = require('./routes/pagoRoutes');

const app = express();

// Seguridad
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(limiter);

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../../frontend/public')));
app.use(express.static(path.join(__dirname, '../../frontend/views')));
app.use('/boletos', express.static(path.join(__dirname, '../../public/boletos')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Rutas API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/boletos', boletoRoutes);
app.use('/api/ine', ineRoutes);
app.use('/api/pagos', pagoRoutes);

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});

// Catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});

module.exports = app;