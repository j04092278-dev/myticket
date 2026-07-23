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

// ===== CORS CONFIGURACIÓN =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://myticket.onrender.com',
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('❌ CORS bloqueado para:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// ===== CORRECCIÓN DEFINITIVA DE TRUST PROXY =====
// Usamos '1' para confiar solo en el primer proxy (el de Render)
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(limiter);

// Servir archivos estáticos
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

// Ruta para el frontend (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});

process.on('uncaughtException', (err) => console.error('❌', err));
process.on('unhandledRejection', (reason) => console.error('❌', reason));

module.exports = app;