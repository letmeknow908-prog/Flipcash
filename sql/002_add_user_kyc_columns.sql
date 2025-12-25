-- Migration 002: Add KYC columns to users table
-- Applied: $(date)

DO $$ 
BEGIN 
  -- Check and add kyc_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='kyc_status') THEN
    ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'not_submitted';
    RAISE NOTICE 'Added kyc_status column to users table';
  END IF;
  
  -- Check and add kyc_submitted_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='kyc_submitted_at') THEN
    ALTER TABLE users ADD COLUMN kyc_submitted_at TIMESTAMP;
    RAISE NOTICE 'Added kyc_submitted_at column to users table';
  END IF;
  
  -- Check and add kyc_verified_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='kyc_verified_at') THEN
    ALTER TABLE users ADD COLUMN kyc_verified_at TIMESTAMP;
    RAISE NOTICE 'Added kyc_verified_at column to users table';
  END IF;
  
  -- Check and add kyc_rejection_reason column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='kyc_rejection_reason') THEN
    ALTER TABLE users ADD COLUMN kyc_rejection_reason TEXT;
    RAISE NOTICE 'Added kyc_rejection_reason column to users table';
  END IF;
  
  -- Check and add tier_level column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='tier_level') THEN
    ALTER TABLE users ADD COLUMN tier_level VARCHAR(20) DEFAULT 'basic';
    RAISE NOTICE 'Added tier_level column to users table';
  END IF;
  
  -- Check and add full_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='full_name') THEN
    ALTER TABLE users ADD COLUMN full_name VARCHAR(100);
    RAISE NOTICE 'Added full_name column to users table';
  END IF;
  
  -- Check and add date_of_birth column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='date_of_birth') THEN
    ALTER TABLE users ADD COLUMN date_of_birth DATE;
    RAISE NOTICE 'Added date_of_birth column to users table';
  END IF;
  
  -- Check and add bvn column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='bvn') THEN
    ALTER TABLE users ADD COLUMN bvn VARCHAR(11);
    RAISE NOTICE 'Added bvn column to users table';
  END IF;
  
  -- Check and add kyc_verified column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='kyc_verified') THEN
    ALTER TABLE users ADD COLUMN kyc_verified BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added kyc_verified column to users table';
  END IF;
  
END $$;
