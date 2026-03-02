// db.js — MySQL Connection Pool (XAMPP + Railway)
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initPool() {
  const config = {
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER      || 'root',
    password:           process.env.DB_PASSWORD  || '',
    database:           process.env.DB_NAME      || 'railway',
    waitForConnections: true,
    connectionLimit:    10,
    connectTimeout:     20000,
  };

  console.log('🔌 Connecting to MySQL...');
  console.log('   Host:', config.host);
  console.log('   Port:', config.port);
  console.log('   User:', config.user);
  console.log('   Database:', config.database);

  try {
    pool = await mysql.createPool(config);
    const conn = await pool.getConnection();
    conn.release();
    console.log('✅ MySQL connected successfully!');
  } catch (err) {
    console.error('❌ MySQL Connection Failed:', err.message);
    console.error('❌ Error code:', err.code);
    process.exit(1);
  }
}

async function getConnection() {
  return await pool.getConnection();
}

module.exports = { initPool, getConnection };