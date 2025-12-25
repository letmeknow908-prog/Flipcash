// src/config/init-db.js
const db = require('./database');

async function initKycTables() {
    try {
        console.log('Initializing KYC tables...');
        
        // Create kyc_submissions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS kyc_submissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reference_id VARCHAR(50) UNIQUE NOT NULL,
                fullname VARCHAR(100) NOT NULL,
                dob DATE NOT NULL,
                address TEXT NOT NULL,
                id_type VARCHAR(20) NOT NULL,
                id_number VARCHAR(50) NOT NULL,
                bvn VARCHAR(11) NOT NULL,
                country VARCHAR(2) NOT NULL,
                occupation VARCHAR(100) NOT NULL,
                source_funds VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                submitted_at TIMESTAMP DEFAULT NOW(),
                reviewed_at TIMESTAMP,
                reviewer_id INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                email VARCHAR(255),
                is_bvn_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Create index for faster queries
        await db.query('CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_submissions(user_id);');
        await db.query('CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);');
        await db.query('CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_submissions(submitted_at);');

        // Add KYC columns to users table if they don't exist
        // We'll do this by checking each column and adding if missing
        // Since PostgreSQL doesn't have a simple way to do this in one command, we use multiple ALTER TABLE statements with IF NOT EXISTS (but note: PostgreSQL doesn't support IF NOT EXISTS for columns in all versions)
        // Instead, we can use a DO block as in the original SQL, but note that the DO block cannot be run in a transaction from the node-pg client? Actually it can.
        // Alternatively, we can use the following method for each column:

        const columnsToAdd = [
            { name: 'kyc_status', type: 'VARCHAR(20) DEFAULT \'not_submitted\'' },
            { name: 'kyc_submitted_at', type: 'TIMESTAMP' },
            { name: 'kyc_verified_at', type: 'TIMESTAMP' },
            { name: 'kyc_rejection_reason', type: 'TEXT' },
            { name: 'tier_level', type: 'VARCHAR(20) DEFAULT \'basic\'' },
            { name: 'full_name', type: 'VARCHAR(100)' },
            { name: 'date_of_birth', type: 'DATE' }
        ];

        for (const column of columnsToAdd) {
            // Check if the column exists
            const checkQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='${column.name}';
            `;
            const result = await db.query(checkQuery);
            if (result.rows.length === 0) {
                // Column doesn't exist, add it
                await db.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type};`);
                console.log(`Added column ${column.name} to users table.`);
            }
        }

        console.log('KYC tables initialized successfully.');
    } catch (error) {
        console.error('Error initializing KYC tables:', error);
        // We don't want to crash the server if the tables already exist, but if there's a connection issue, we might want to retry.
        // However, for simplicity, we just log the error.
    }
}

module.exports = initKycTables;
