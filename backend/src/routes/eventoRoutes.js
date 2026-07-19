const express = require('express');
const { getEventos, createEvento, deleteEvento, getEventoStats, upload } = require('../controllers/eventoController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
router.get('/', getEventos);
router.get('/:id/stats', authMiddleware, adminMiddleware, getEventoStats);
router.post('/', authMiddleware, adminMiddleware, upload.single('imagen'), createEvento);
router.delete('/:id', authMiddleware, adminMiddleware, deleteEvento);

module.exports = router;