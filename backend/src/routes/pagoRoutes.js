const express = require('express');
const { crearPreferenciaPago, webhook } = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ruta para iniciar pago (frontend)
router.post('/crear-preferencia', authMiddleware, crearPreferenciaPago);

// Webhook de Mercado Pago (sin autenticación)
router.post('/webhook', express.json(), webhook);

module.exports = router;