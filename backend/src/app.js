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

// ===== CORRECCIÓN PARA RENDER =====
// Configurar trust proxy de forma segura: solo confiar en los proxies de Render
// Render usa proxies como '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'
app.set('trust proxy', (ip) => {
  // Permitir solo IPs privadas (proxies internos de Render)
  return ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(limiter);

app.use(express.static(path.join(__dirname, '../../frontend/public')));
app.use(express.static(path.join(__dirname, '../../frontend/views')));
app.use('/boletos', express.static(path.join(__dirname, '../../public/boletos')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/boletos', boletoRoutes);
app.use('/api/ine', ineRoutes);
app.use('/api/pagos', pagoRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/views/index.html'));
});

process.on('uncaughtException', (err) => console.error('❌', err));
process.on('unhandledRejection', (reason) => console.error('❌', reason));

module.exports = app;