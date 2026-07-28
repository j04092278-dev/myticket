const express = require('express');
const { crearSesionPago, webhook } = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ruta para iniciar pago (frontend)
router.post('/crear-sesion', authMiddleware, crearSesionPago);

// Webhook de Stripe (sin autenticación, porque Stripe lo llama)
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

module.exports = router;