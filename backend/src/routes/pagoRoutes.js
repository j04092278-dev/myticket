const express = require('express');
const { procesarPago } = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.post('/procesar', authMiddleware, procesarPago);

module.exports = router;