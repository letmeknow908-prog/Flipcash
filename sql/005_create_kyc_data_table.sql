-- Create kyc_data table if it doesn't exist
CREATE TABLE IF NOT EXISTS kyc_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fullname VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    address TEXT NOT NULL,
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(100) NOT NULL,
    bvn VARCHAR(11) NOT NULL,
    country VARCHAR(2),
    occupation VARCHAR(100),
    source_funds VARCHAR(50),
    kyc_submitted_at TIMESTAMP DEFAULT NOW(),
    kyc_approved_at TIMESTAMP,
    kyc_rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_kyc_data_user_id ON kyc_data(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_data_bvn ON kyc_data(bvn);

-- Make sure users table has kyc columns
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
                   WHERE table_name='users' AND column_name='kyc_verified') THEN
        ALTER TABLE users ADD COLUMN kyc_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
