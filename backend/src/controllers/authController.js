const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const { nombre, edad, telefono, correo_usuario, contrasena } = req.body;
  try {
    const exists = await pool.query('SELECT id_cliente FROM cliente WHERE correo_usuario = $1', [correo_usuario]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Email ya registrado' });
    const hashed = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      `INSERT INTO cliente (nombre, edad, telefono, correo_usuario, contrasena)
       VALUES ($1,$2,$3,$4,$5) RETURNING id_cliente, nombre, correo_usuario`,
      [nombre, edad, telefono, correo_usuario, hashed]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const login = async (req, res) => {
  const { correo_usuario, contrasena } = req.body;
  try {
    const result = await pool.query(
      'SELECT id_cliente, nombre, correo_usuario, contrasena, es_admin FROM cliente WHERE correo_usuario = $1',
      [correo_usuario]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(contrasena, user.contrasena);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id_cliente, email: user.correo_usuario, isAdmin: user.es_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ===== CONFIGURACIÓN DE COOKIE PARA RENDER =====
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction, // Solo HTTPS en producción
      sameSite: isProduction ? 'none' : 'lax', // 'none' para cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      path: '/',
      domain: isProduction ? '.onrender.com' : undefined // Importante para Render
    });

    res.json({
      success: true,
      user: {
        id: user.id_cliente,
        nombre: user.nombre,
        email: user.correo_usuario,
        isAdmin: user.es_admin
      }
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    domain: isProduction ? '.onrender.com' : undefined
  });
  res.json({ success: true });
};

const getMe = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const result = await pool.query(
      'SELECT id_cliente, nombre, correo_usuario, es_admin FROM cliente WHERE id_cliente = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = result.rows[0];
    res.json({
      user: {
        id: user.id_cliente,
        nombre: user.nombre,
        email: user.correo_usuario,
        isAdmin: user.es_admin
      }
    });
  } catch (error) {
    console.error('❌ Error en getMe:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { register, login, logout, getMe };