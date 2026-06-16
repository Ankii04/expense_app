const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function runMigrations() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ Database schema applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    // Don't crash the server — tables may already exist
  }
}

module.exports = runMigrations;
