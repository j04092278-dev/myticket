const express = require('express');
const { crearSesionPago, confirmarPago, webhook } = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Webhook de Stripe (sin autenticación, necesita raw body) - DEBE IR PRIMERO
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Ruta para iniciar pago (frontend)
router.post('/crear-sesion', authMiddleware, crearSesionPago);

// Ruta para confirmar pago desde el frontend
router.post('/confirmar', authMiddleware, confirmarPago);

module.exports = router;