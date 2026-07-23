const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Intentar obtener token desde cookie
  let token = req.cookies.token;
  
  // Si no está en cookie, buscar en header Authorization
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    console.log(`❌ No hay token en la solicitud a ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'No autorizado - token no encontrado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin || false;
    req.userEmail = decoded.email;
    console.log(`✅ Token verificado para: ${decoded.email} (ruta: ${req.path})`);
    next();
  } catch (err) {
    console.error(`❌ Error verificando token en ${req.path}:`, err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };