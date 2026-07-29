const express = require('express');
const { crearSesionPago, confirmarPago, webhook } = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ruta para iniciar pago (frontend)
router.post('/crear-sesion', authMiddleware, crearSesionPago);

// Ruta para confirmar pago desde el frontend (se llama desde mis-boletos.js)
router.post('/confirmar', authMiddleware, confirmarPago);

// Webhook de Stripe (sin autenticación, necesita raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

module.exports = router;