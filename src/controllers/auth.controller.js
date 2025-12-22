const User = require('../models/User');
const JWTUtil = require('../utils/jwt');
const { redisClient } = require('../config/redis');
const { sendOTP, sendWelcomeEmail } = require('../services/notification.service');
const { generateVirtualAccount } = require('../services/virtualAccount.service');
const { initializeWallets } = require('../services/wallet.service');

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { email, phone, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          status: 'error',
          message: 'User with this email already exists',
        });
      }

      const existingPhone = await User.findByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({
          status: 'error',
          message: 'User with this phone number already exists',
        });
      }

      // Create user
      const user = await User.create({ email, phone, password, firstName, lastName });

      // Generate OTP
      const otp = JWTUtil.generateOTP();
      
      // Store OTP in Redis (expires in 10 minutes)
      await redisClient.setEx(`otp:${user.id}`, 600, otp);

      // Send OTP via SMS
      await sendOTP(phone, otp);

      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please verify your phone number.',
        data: {
          userId: user.id,
          email: user.email,
          phone: user.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Verify OTP
  static async verifyOTP(req, res, next) {
    try {
      const { userId, otp } = req.body;

      // Get stored OTP from Redis
      const storedOTP = await redisClient.get(`otp:${userId}`);

      if (!storedOTP) {
        return res.status(400).json({
          status: 'error',
          message: 'OTP expired. Please request a new one.',
        });
      }

      if (storedOTP !== otp) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid OTP. Please try again.',
        });
      }

      // OTP verified - Initialize user account
      const user = await User.findById(userId);

      // Generate virtual Naira account
      const virtualAccount = await generateVirtualAccount(user);
      await User.setVirtualAccount(userId, virtualAccount.accountNumber);

      // Initialize wallets (NGN, KSH, BTC, ETH, USDT)
      await initializeWallets(userId);

      // Delete OTP from Redis
      await redisClient.del(`otp:${userId}`);

      // Generate tokens
      const tokens = JWTUtil.generateTokens(userId);

      // Send welcome email
      await sendWelcomeEmail(user.email, user.first_name, virtualAccount.accountNumber);

      res.status(200).json({
        status: 'success',
        message: 'Phone number verified successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.first_name,
            lastName: user.last_name,
            virtualAccount: virtualAccount.accountNumber,
          },
          tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Resend OTP
  static async resendOTP(req, res, next) {
    try {
      const { userId } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      // Generate new OTP
      const otp = JWTUtil.generateOTP();
      
      // Store in Redis
      await redisClient.setEx(`otp:${userId}`, 600, otp);

      // Send OTP
      await sendOTP(user.phone, otp);

      res.status(200).json({
        status: 'success',
        message: 'OTP sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Login
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
        });
      }

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          status: 'error',
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
        });
      }

      // Generate tokens
      const tokens = JWTUtil.generateTokens(user.id);

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.first_name,
            lastName: user.last_name,
            kycStatus: user.kyc_status,
            virtualAccount: user.virtual_naira_account,
          },
          tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Refresh access token
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required',
        });
      }

      // Verify refresh token
      const decoded = JWTUtil.verifyRefreshToken(refreshToken);

      // Generate new access token
      const accessToken = JWTUtil.generateAccessToken(decoded.userId);

      res.status(200).json({
        status: 'success',
        data: {
          accessToken,
        },
      });
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  // Logout
  static async logout(req, res, next) {
    try {
      // In a more robust system, you'd blacklist the token in Redis
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Forgot password
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return res.status(200).json({
          status: 'success',
          message: 'If an account exists with this email, a reset code has been sent.',
        });
      }

      // Generate OTP for password reset
      const otp = JWTUtil.generateOTP();
      
      // Store in Redis (15 minutes expiry)
      await redisClient.setEx(`password-reset:${user.id}`, 900, otp);

      // Send OTP via SMS and email
      await sendOTP(user.phone, otp);

      res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, a reset code has been sent.',
        data: {
          userId: user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Reset password
  static async resetPassword(req, res, next) {
    try {
      const { userId, otp, newPassword } = req.body;

      // Verify OTP
      const storedOTP = await redisClient.get(`password-reset:${userId}`);

      if (!storedOTP || storedOTP !== otp) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or expired reset code',
        });
      }

      // Update password
      await User.updatePassword(userId, newPassword);

      // Delete OTP
      await redisClient.del(`password-reset:${userId}`);

      res.status(200).json({
        status: 'success',
        message: 'Password reset successful. Please login with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
