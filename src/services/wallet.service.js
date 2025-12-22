const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class WalletService {
  // Initialize wallets for new user
  static async initializeWallets(userId) {
    const currencies = ['NGN', 'KSH', 'BTC', 'ETH', 'USDT'];
    
    const promises = currencies.map(currency => {
      const query = `
        INSERT INTO wallets (id, user_id, currency, balance)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (user_id, currency) DO NOTHING
      `;
      return db.query(query, [uuidv4(), userId, currency]);
    });

    await Promise.all(promises);
    return true;
  }

  // Get user's wallet by currency
  static async getWallet(userId, currency) {
    const query = 'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2';
    const result = await db.query(query, [userId, currency]);
    return result.rows[0];
  }

  // Get all user wallets
  static async getAllWallets(userId) {
    const query = 'SELECT * FROM wallets WHERE user_id = $1 ORDER BY currency';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // Credit wallet
  static async creditWallet(userId, currency, amount, transactionId = null) {
    const query = `
      UPDATE wallets 
      SET balance = balance + $1, updated_at = NOW()
      WHERE user_id = $2 AND currency = $3
      RETURNING *
    `;
    const result = await db.query(query, [amount, userId, currency]);
    return result.rows[0];
  }

  // Debit wallet
  static async debitWallet(userId, currency, amount, transactionId = null) {
    // First check if sufficient balance
    const wallet = await this.getWallet(userId, currency);
    
    if (!wallet || wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const query = `
      UPDATE wallets 
      SET balance = balance - $1, updated_at = NOW()
      WHERE user_id = $2 AND currency = $3
      RETURNING *
    `;
    const result = await db.query(query, [amount, userId, currency]);
    return result.rows[0];
  }

  // Get wallet balance
  static async getBalance(userId, currency) {
    const wallet = await this.getWallet(userId, currency);
    return wallet ? wallet.balance : 0;
  }
}

module.exports = WalletService;
