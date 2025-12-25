const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Register new user
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        // Validate
        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required'
            });
        }

        // Check if user exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this email or phone already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            `INSERT INTO users (first_name, last_name, email, phone, password)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, first_name, last_name, email, phone, kyc_verified, kyc_status, created_at`,
            [firstName, lastName, email, phone, hashedPassword]
        );

        const user = result.rows[0];

        // Create wallets for user
        await db.query(
            `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, 'NGN', 0), ($1, 'KSH', 0)`,
            [user.id]
        );

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Registration failed',
            error: error.message
        });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        // Find user
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const accessToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'flipcash-secret-key-2025',
            { expiresIn: '7d' }
        );

        // Remove password from response
        delete user.password;

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    phone: user.phone,
                    kycVerified: user.kyc_verified,
                    kycStatus: user.kyc_status
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed',
            error: error.message
        });
    }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        // Check if user exists
        const result = await db.query(
            'SELECT id, phone FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            // Don't reveal if user exists
            return res.status(200).json({
                status: 'success',
                message: 'If the email exists, a reset link has been sent'
            });
        }

        // TODO: Send SMS with Twilio
        console.log('Reset password for:', email);

        res.status(200).json({
            status: 'success',
            message: 'Password reset link sent to your phone'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process request',
            error: error.message
        });
    }
};

module.exports = exports;
