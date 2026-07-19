const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'myticket',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 5432,
      }
);

pool.on('connect', () => console.log('✅ Conectado a PostgreSQL'));
pool.on('error', (err) => console.error('❌ Error PostgreSQL:', err.message));

module.exports = pool;