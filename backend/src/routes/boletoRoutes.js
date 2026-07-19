const express = require('express');
const { comprarBoletos, getMisBoletos } = require('../controllers/boletoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.post('/comprar', authMiddleware, comprarBoletos);
router.get('/mis-boletos', authMiddleware, getMisBoletos);

module.exports = router;