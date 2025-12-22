const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  // Create new user
  static async create({ email, phone, password, firstName, lastName }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    
    const query = `
      INSERT INTO users (id, email, phone, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, phone, first_name, last_name, kyc_status, created_at
    `;
    
    const values = [userId, email.toLowerCase(), phone, hashedPassword, firstName, lastName];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email.toLowerCase()]);
    return result.rows[0];
  }

  // Find user by phone
  static async findByPhone(phone) {
    const query = 'SELECT * FROM users WHERE phone = $1';
    const result = await db.query(query, [phone]);
    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const query = `
      SELECT id, email, phone, first_name, last_name, kyc_status, 
             virtual_naira_account, is_active, created_at
      FROM users WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user
  static async update(id, updates) {
    const allowedFields = ['first_name', 'last_name', 'kyc_status', 'kyc_document_url', 'virtual_naira_account'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];
    
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, phone, first_name, last_name, kyc_status, virtual_naira_account
    `;
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Set virtual Naira account
  static async setVirtualAccount(userId, accountNumber) {
    const query = `
      UPDATE users 
      SET virtual_naira_account = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING virtual_naira_account
    `;
    const result = await db.query(query, [accountNumber, userId]);
    return result.rows[0];
  }

  // Update password
  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await db.query(query, [hashedPassword, userId]);
  }

  // Deactivate user
  static async deactivate(userId) {
    const query = 'UPDATE users SET is_active = false WHERE id = $1';
    await db.query(query, [userId]);
  }

  // Get user statistics
  static async getStats(userId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM transactions WHERE user_id = $1) as total_transactions,
        (SELECT SUM(from_amount) FROM transactions WHERE user_id = $1 AND status = 'completed') as total_volume,
        (SELECT created_at FROM users WHERE id = $1) as member_since
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = User;
