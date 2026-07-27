const express = require('express');
const { comprarBoletos, getMisBoletos, descargarBoleto } = require('../controllers/boletoController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.post('/comprar', authMiddleware, comprarBoletos);
router.get('/mis-boletos', authMiddleware, getMisBoletos);
router.get('/:id/descargar', authMiddleware, descargarBoleto);

module.exports = router;