// src/config/init-db.js
const db = require('../../config/database');
const fs = require('fs').promises;
const path = require('path');

// Migration management system
class MigrationManager {
  constructor() {
    this.migrationsTable = 'schema_migrations';
    this.migrationsDir = path.join(__dirname, '../../sql');
  }

  async init() {
    console.log('🚀 Starting database migrations...');
    
    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get all migration files
      const migrationFiles = await this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        console.log('ℹ️ No migration files found in /sql directory');
        return { success: true, migrated: 0 };
      }
      
      // Filter out already executed migrations
      const pendingMigrations = await this.getPendingMigrations(migrationFiles);
      
      if (pendingMigrations.length === 0) {
        console.log('✅ All migrations are already applied');
        return { success: true, migrated: 0, message: 'All migrations already applied' };
      }
      
      console.log(`📊 Found ${pendingMigrations.length} pending migration(s)`);
      
      // Execute pending migrations
      const results = await this.executeMigrations(pendingMigrations);
      
      console.log('🎉 Database migrations completed successfully');
      return {
        success: true,
        migrated: pendingMigrations.length,
        results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Database migration failed:', error.message);
      throw error;
    }
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        version VARCHAR(100) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );
    `;
    
    await db.query(query);
    console.log('✅ Migrations table ready');
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort() // Sort alphabetically for proper order
        .map(file => ({
          filename: file,
          version: file.replace('.sql', ''),
          path: path.join(this.migrationsDir, file)
        }));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📁 Creating migrations directory: ${this.migrationsDir}`);
        await fs.mkdir(this.migrationsDir, { recursive: true });
        return [];
      }
      throw error;
    }
  }

  async getPendingMigrations(migrationFiles) {
    try {
      const result = await db.query(
        `SELECT version FROM ${this.migrationsTable}`
      );
      const appliedVersions = new Set(result.rows.map(row => row.version));
      
      return migrationFiles.filter(migration => 
        !appliedVersions.has(migration.version)
      );
    } catch (error) {
      console.error('Error checking applied migrations:', error);
      // If we can't read, assume no migrations applied
      return migrationFiles;
    }
  }

  async executeMigrations(pendingMigrations) {
    const results = [];
    
    for (const migration of pendingMigrations) {
      const startTime = Date.now();
      
      try {
        console.log(`🔄 Applying migration: ${migration.filename}`);
        
        // Read SQL file
        const sql = await fs.readFile(migration.path, 'utf8');
        
        // Calculate checksum
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');
        
        // Wrap in transaction for safety - FIXED: db.getClient() not db.connect()
        const client = await db.getClient(); // ⚠️ FIXED THIS LINE
        
        try {
          await client.query('BEGIN');
          
          // Execute migration SQL
          await client.query(sql);
          
          // Record migration
          await client.query(
            `INSERT INTO ${this.migrationsTable} (version, filename, checksum, execution_time_ms) 
             VALUES ($1, $2, $3, $4)`,
            [migration.version, migration.filename, checksum, Date.now() - startTime]
          );
          
          await client.query('COMMIT');
          
          const executionTime = Date.now() - startTime;
          console.log(`✅ Migration applied: ${migration.filename} (${executionTime}ms)`);
          
          results.push({
            version: migration.version,
            filename: migration.filename,
            status: 'applied',
            executionTime,
            checksum
          });
          
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        
      } catch (error) {
        console.error(`❌ Failed to apply migration ${migration.filename}:`, error.message);
        
        // Check if it's a non-critical error (like table already exists)
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key')) {
          console.log(`⚠️ Migration ${migration.filename} already applied, marking as completed`);
          
          // Mark as applied anyway (idempotent)
          try {
            await db.query(
              `INSERT INTO ${this.migrationsTable} (version, filename) 
               VALUES ($1, $2) 
               ON CONFLICT (version) DO NOTHING`,
              [migration.version, migration.filename]
            );
            
            results.push({
              version: migration.version,
              filename: migration.filename,
              status: 'already_exists',
              warning: error.message
            });
            
          } catch (markError) {
            console.error(`Failed to mark migration ${migration.filename}:`, markError.message);
          }
        } else {
          throw new Error(`Migration ${migration.filename} failed: ${error.message}`);
        }
      }
    }
    
    return results;
  }

  async getMigrationStatus() {
    try {
      const applied = await db.query(
        `SELECT version, filename, applied_at, execution_time_ms 
         FROM ${this.migrationsTable} 
         ORDER BY applied_at DESC`
      );
      
      const migrationFiles = await this.getMigrationFiles();
      
      return {
        totalMigrations: migrationFiles.length,
        applied: applied.rows.length,
        pending: migrationFiles.length - applied.rows.length,
        appliedMigrations: applied.rows,
        pendingMigrations: migrationFiles.filter(m => 
          !applied.rows.find(a => a.version === m.version)
        ),
        lastApplied: applied.rows[0] ? applied.rows[0].applied_at : null
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return { error: error.message };
    }
  }

  async rollbackMigration(version) {
    // This is a basic rollback - you would need to implement
    // reverse migration SQL files for proper rollback
    console.log(`⚠️ Rollback requested for version: ${version}`);
    console.log('ℹ️ Manual rollback required. Please check your backup/restore procedures.');
    return { warning: 'Manual rollback required' };
  }
}

// Initialize KYC tables (legacy function - kept for backward compatibility)
async function initKycTables() {
  console.log('🔄 Running legacy KYC table initialization...');
  
  try {
    // FIXED: db.getClient() not db.connect()
    const client = await db.getClient(); // ⚠️ FIXED THIS LINE
    
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

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_submissions(user_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_submissions(submitted_at);');

      // Add KYC columns to users table if they don't exist
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
      console.log('✅ Legacy KYC tables initialized successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // If tables already exist, it's not an error
      if (error.message.includes('already exists')) {
        console.log('ℹ️ KYC tables already exist (continuing)');
      } else {
        console.error('Error in KYC tables initialization:', error.message);
        throw error;
      }
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error initializing KYC tables:', error.message);
    // Don't crash the server if KYC tables fail
  }
}

// Main migration function
async function runMigrations() {
  const migrationManager = new MigrationManager();
  return await migrationManager.init();
}

// Migration status function
async function getMigrationStatus() {
  const migrationManager = new MigrationManager();
  return await migrationManager.getMigrationStatus();
}

// Export functions
module.exports = {
  initKycTables,     // Legacy function (backward compatibility)
  runMigrations,     // New migration system
  getMigrationStatus,
  MigrationManager   // Class for advanced usage
};

// Run migrations if this file is executed directly
if (require.main === module) {
  console.log('🚀 Running migrations from command line...');
  
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  
  async function execute() {
    const migrationManager = new MigrationManager();
    
    switch (command) {
      case 'status':
        const status = await migrationManager.getMigrationStatus();
        console.log('\n📊 Migration Status:');
        console.log('='.repeat(50));
        console.log(`Total migration files: ${status.totalMigrations}`);
        console.log(`Applied migrations: ${status.applied}`);
        console.log(`Pending migrations: ${status.pending}`);
        console.log('='.repeat(50));
        
        if (status.appliedMigrations.length > 0) {
          console.log('\n✅ Applied Migrations:');
          status.appliedMigrations.forEach(m => {
            console.log(`  • ${m.filename} (${new Date(m.applied_at).toLocaleString()})`);
          });
        }
        
        if (status.pendingMigrations && status.pendingMigrations.length > 0) {
          console.log('\n⏳ Pending Migrations:');
          status.pendingMigrations.forEach(m => {
            console.log(`  • ${m.filename}`);
          });
        }
        break;
        
      case 'run':
      default:
        const result = await migrationManager.init();
        console.log('\n🎯 Migration Result:', result);
        break;
    }
  }
  
  execute()
    .then(() => {
      console.log('\n✅ Migration command completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration command failed:', error);
      process.exit(1);
    });
}
