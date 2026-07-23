const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = './uploads/eventos/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ===== CONFIGURACIÓN DE MULTER =====
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

// ========== GET EVENTOS ==========
const getEventos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id_evento, nombre_evento, fecha_evento, hora_evento,
             ubicacion, capacidad_total, boletos_disponibles,
             precio_normal, precio_preventa, es_preventa, imagen_url,
             preventa_inicio, preventa_fin,
             CASE WHEN imagen_data IS NOT NULL THEN true ELSE false END as tiene_imagen
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

// ========== GET IMAGEN DEL EVENTO ==========
const getEventoImagen = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT imagen_data FROM evento WHERE id_evento = $1 AND imagen_data IS NOT NULL',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Imagen no encontrada');
    }
    const buffer = result.rows[0].imagen_data;
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Error al obtener imagen:', error);
    res.status(500).send('Error al obtener imagen');
  }
};

// ========== CREATE EVENTO ==========
const createEvento = async (req, res) => {
  const {
    nombre_evento, fecha_evento, hora_evento, ubicacion,
    capacidad_total, precio_normal, precio_preventa,
    es_preventa, preventa_inicio, preventa_fin
  } = req.body;

  let imagenData = null;
  let imagenUrl = null;

  // Leer imagen del archivo temporal
  if (req.file) {
    try {
      imagenData = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path); // Eliminar archivo temporal
      imagenUrl = `/api/eventos/imagen/temp`; // Se actualizará después
    } catch (err) {
      console.error('❌ Error al leer archivo:', err);
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO evento
       (nombre_evento, fecha_evento, hora_evento, ubicacion, capacidad_total, boletos_disponibles,
        precio_normal, precio_preventa, es_preventa, imagen_data, imagen_url, preventa_inicio, preventa_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_evento`,
      [
        nombre_evento, fecha_evento, hora_evento, ubicacion,
        capacidad_total, capacidad_total,
        precio_normal, precio_preventa || null,
        es_preventa || false,
        imagenData,
        imagenUrl,
        preventa_inicio || null,
        preventa_fin || null
      ]
    );

    const eventId = result.rows[0].id_evento;
    // Actualizar la URL con el ID real
    if (imagenData) {
      const realUrl = `/api/eventos/${eventId}/imagen`;
      await pool.query('UPDATE evento SET imagen_url = $1 WHERE id_evento = $2', [realUrl, eventId]);
    }

    const newEvento = await pool.query('SELECT * FROM evento WHERE id_evento = $1', [eventId]);
    res.status(201).json({ success: true, evento: newEvento.rows[0] });
  } catch (error) {
    console.error('❌ Error en createEvento:', error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
};

// ========== DELETE EVENTO ==========
const deleteEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM evento WHERE id_evento = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error en deleteEvento:', error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
};

// ========== GET ESTADÍSTICAS ==========
const getEventoStats = async (req, res) => {
  const { id } = req.params;
  try {
    const evento = await pool.query(
      'SELECT capacidad_total, boletos_disponibles FROM evento WHERE id_evento = $1',
      [id]
    );
    if (evento.rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    const vendidos = await pool.query(
      'SELECT COUNT(*) as vendidos FROM boletos WHERE id_evento = $1 AND estatus = \'activo\'',
      [id]
    );
    res.json({
      capacidad: evento.rows[0].capacidad_total,
      disponibles: evento.rows[0].boletos_disponibles,
      vendidos: parseInt(vendidos.rows[0].vendidos)
    });
  } catch (error) {
    console.error('❌ Error en getEventoStats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = { getEventos, getEventoImagen, createEvento, deleteEvento, getEventoStats, upload };