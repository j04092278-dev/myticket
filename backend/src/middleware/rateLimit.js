const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 peticiones por IP
  message: { error: 'Demasiadas peticiones' },
  standardHeaders: true,
  legacyHeaders: false,
  // Desactivar la validación de trust proxy para evitar errores
  validate: { trustProxy: false },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

module.exports = { limiter, authLimiter };