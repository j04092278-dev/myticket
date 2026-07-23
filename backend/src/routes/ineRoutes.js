const express = require('express');
const { getEstadoINE, validarINEConImagen, upload } = require('../controllers/ineController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/estado', authMiddleware, getEstadoINE);
router.post('/validar-con-imagen', authMiddleware, upload.fields([
  { name: 'ineImage', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 }
]), validarINEConImagen);

module.exports = router;