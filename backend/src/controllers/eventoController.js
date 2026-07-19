const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const uploadDir = './uploads/eventos/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `evento_${Date.now()}${ext}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no permitido'), false);
  }
});

const getEventos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id_evento, nombre_evento, fecha_evento, hora_evento,
             ubicacion, capacidad_total, boletos_disponibles,
             precio_normal, precio_preventa, es_preventa, imagen_url,
             preventa_inicio, preventa_fin
      FROM evento
      WHERE fecha_evento >= CURRENT_DATE
      ORDER BY fecha_evento ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en getEventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

const createEvento = async (req, res) => {
  const { nombre_evento, fecha_evento, hora_evento, ubicacion, capacidad_total, precio_normal, precio_preventa, es_preventa, preventa_inicio, preventa_fin } = req.body;
  let imagen_url = null;
  if (req.file) {
    try {
      // Comprimir imagen
      const compressedPath = path.join(uploadDir, `compressed_${req.file.filename}`);
      await sharp(req.file.path)
        .resize(1200, 800, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(compressedPath);
      fs.unlinkSync(req.file.path);
      imagen_url = `/uploads/eventos/${path.basename(compressedPath)}`;
    } catch (e) {
      imagen_url = `/uploads/eventos/${req.file.filename}`;
    }
  }
  try {
    const result = await pool.query(
      `INSERT INTO evento
       (nombre_evento, fecha_evento, hora_evento, ubicacion, capacidad_total, boletos_disponibles, precio_normal, precio_preventa, es_preventa, imagen_url, preventa_inicio, preventa_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [nombre_evento, fecha_evento, hora_evento, ubicacion, capacidad_total, capacidad_total, precio_normal, precio_preventa || null, es_preventa || false, imagen_url, preventa_inicio || null, preventa_fin || null]
    );
    res.status(201).json({ success: true, evento: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
};

const deleteEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM evento WHERE id_evento = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
};

const getEventoStats = async (req, res) => {
  const { id } = req.params;
  try {
    const evento = await pool.query('SELECT capacidad_total, boletos_disponibles FROM evento WHERE id_evento = $1', [id]);
    if (evento.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    const vendidos = await pool.query('SELECT COUNT(*) as vendidos FROM boletos WHERE id_evento = $1 AND estatus = \'activo\'', [id]);
    res.json({
      capacidad: evento.rows[0].capacidad_total,
      disponibles: evento.rows[0].boletos_disponibles,
      vendidos: parseInt(vendidos.rows[0].vendidos)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = { getEventos, createEvento, deleteEvento, getEventoStats, upload };