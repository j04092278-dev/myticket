const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Intentar obtener token de cookies o del header Authorization
  let token = req.cookies.token;
  if (!token) {
    // Si no está en cookies, buscar en header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: 'No autorizado - token no encontrado' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin || false;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    console.error('❌ Error verificando token:', err.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Acceso solo para administradores' });
  next();
};

module.exports = { authMiddleware, adminMiddleware };