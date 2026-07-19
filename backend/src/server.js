const app = require('./app');
const fs = require('fs');
const pool = require('./config/database');

// Crear carpetas necesarias (si no existen)
const dirs = ['./uploads/ine', './uploads/selfies', './uploads/eventos', './public/boletos', './logs'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// En producción, ejecutar schema si no existen tablas
if (process.env.NODE_ENV === 'production') {
  (async () => {
    try {
      const check = await pool.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cliente')");
      if (!check.rows[0].exists) {
        const schema = fs.readFileSync('./database/schema.sql', 'utf-8');
        await pool.query(schema);
        console.log('✅ Schema ejecutado correctamente');
      }
    } catch (err) {
      console.error('❌ Error ejecutando schema:', err.message);
    }
  })();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MyTicket en http://localhost:${PORT}`);
  console.log('🔐 Admin: admin@myticket.com / admin123');
});