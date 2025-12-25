const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔄 Running database migrations...');

        // Read SQL file
        const sqlPath = path.join(__dirname, '..', 'sql', 'init-database.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Run migrations
        await pool.query(sql);

        console.log('✅ Database migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
