-- Migration 001: Create KYC tables and indexes
-- Applied: $(date)

-- KYC submissions table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_kyc_reference ON kyc_submissions(reference_id);
CREATE INDEX IF NOT EXISTS idx_kyc_email ON kyc_submissions(email);

COMMENT ON TABLE kyc_submissions IS 'Stores KYC submission data for user verification';
COMMENT ON COLUMN kyc_submissions.reference_id IS 'Unique reference ID for tracking';
COMMENT ON COLUMN kyc_submissions.is_bvn_verified IS 'Whether BVN has been externally verified';
