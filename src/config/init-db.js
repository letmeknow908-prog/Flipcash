const db = require('./database');

async function initKycTables() {
    try {
        console.log('Initializing KYC tables...');
        
        // We'll wrap the table creation and index creation in a transaction
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');

            // Create kyc_submissions table
            await client.query(`
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
            await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_submissions(user_id);');
            await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);');
            await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_submissions(submitted_at);');

            // Add KYC columns to users table if they don't exist
            // We use a DO block to conditionally add columns
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='kyc_status') THEN
                        ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'not_submitted';
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='kyc_submitted_at') THEN
                        ALTER TABLE users ADD COLUMN kyc_submitted_at TIMESTAMP;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='kyc_verified_at') THEN
                        ALTER TABLE users ADD COLUMN kyc_verified_at TIMESTAMP;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='kyc_rejection_reason') THEN
                        ALTER TABLE users ADD COLUMN kyc_rejection_reason TEXT;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='tier_level') THEN
                        ALTER TABLE users ADD COLUMN tier_level VARCHAR(20) DEFAULT 'basic';
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='full_name') THEN
                        ALTER TABLE users ADD COLUMN full_name VARCHAR(100);
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='users' AND column_name='date_of_birth') THEN
                        ALTER TABLE users ADD COLUMN date_of_birth DATE;
                    END IF;
                END $$;
            `);

            await client.query('COMMIT');
            console.log('KYC tables initialized successfully.');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in KYC tables initialization transaction:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error initializing KYC tables:', error);
        // We don't want to crash the server if the tables already exist, but if there's a connection issue, we might want to retry.
        // However, for simplicity, we just log the error.
    }
}

module.exports = initKycTables;
