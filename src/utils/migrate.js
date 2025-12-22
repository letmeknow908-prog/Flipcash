const db = require('../config/database');

const migrations = [
  // Users table
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_document_url TEXT,
    virtual_naira_account VARCHAR(20) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  `,

  // Wallets table
  `
  CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('NGN', 'KSH', 'BTC', 'ETH', 'USDT')),
    balance DECIMAL(20, 8) DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, currency)
  );
  `,

  // Transactions table
  `
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'swap', 'transfer')),
    from_currency VARCHAR(10),
    to_currency VARCHAR(10),
    from_amount DECIMAL(20, 8),
    to_amount DECIMAL(20, 8),
    exchange_rate DECIMAL(20, 8),
    fee DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    reference VARCHAR(100) UNIQUE,
    mpesa_receipt VARCHAR(100),
    destination_phone VARCHAR(20),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  `,

  // Exchange rates table
  `
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(20, 8) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_currency, to_currency)
  );
  `,

  // Create indexes
  `
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
  `,

  // Insert initial exchange rates
  `
  INSERT INTO exchange_rates (from_currency, to_currency, rate, source)
  VALUES 
    ('NGN', 'KSH', 0.29, 'manual'),
    ('KSH', 'NGN', 3.45, 'manual'),
    ('BTC', 'KSH', 13500000, 'manual'),
    ('ETH', 'KSH', 450000, 'manual'),
    ('USDT', 'KSH', 129, 'manual')
  ON CONFLICT (from_currency, to_currency) DO NOTHING;
  `,
];

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    for (const [index, migration] of migrations.entries()) {
      console.log(`Running migration ${index + 1}/${migrations.length}...`);
      await db.query(migration);
    }

    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
