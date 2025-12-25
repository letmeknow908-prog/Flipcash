const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

// Register new user
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 8 characters long'
            });
        }

        // Check if user already exists
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

        // Insert user into database
        const result = await db.query(
            `INSERT INTO users (first_name, last_name, email, phone, password, kyc_verified, kyc_status)
             VALUES ($1, $2, $3, $4, $5, false, 'not_submitted')
             RETURNING id, first_name, last_name, email, phone, kyc_verified, kyc_status, created_at`,
            [firstName, lastName, email, phone, hashedPassword]
        );

        const newUser = result.rows[0];

        // Create default wallets for the user
        try {
            await db.query(
                `INSERT INTO wallets (user_id, currency, balance) 
                 VALUES ($1, 'NGN', 0.00), ($1, 'KSH', 0.00)`,
                [newUser.id]
            );
        } catch (walletError) {
            console.error('Wallet creation error:', walletError);
            // Continue even if wallet creation fails
        }

        // Format response
        const userResponse = {
            id: newUser.id,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            email: newUser.email,
            phone: newUser.phone,
            kycVerified: newUser.kyc_verified,
            kycStatus: newUser.kyc_status,
            createdAt: newUser.created_at
        };

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: { user: userResponse }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        // Check if user exists
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

        // Generate JWT token
        const accessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email 
            },
            process.env.JWT_SECRET || 'flipcash-secret-key-2025',
            { expiresIn: '7d' }
        );

        // Format user response (exclude password)
        const userResponse = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phone: user.phone,
            kycVerified: user.kyc_verified,
            kycStatus: user.kyc_status
        };

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                accessToken,
                user: userResponse
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
            'SELECT id, email, phone FROM users WHERE email = $1',
            [email]
        );

        // Don't reveal if user exists for security
        if (result.rows.length === 0) {
            return res.status(200).json({
                status: 'success',
                message: 'If the email exists, a reset link has been sent'
            });
        }

        // TODO: Implement password reset logic
        // - Generate reset token
        // - Store token in database
        // - Send SMS/Email with reset link
        
        console.log('Password reset requested for:', email);

        res.status(200).json({
            status: 'success',
            message: 'Password reset link sent to your email and phone'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_verified, kyc_status, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user = result.rows[0];
        
        res.status(200).json({
            status: 'success',
            data: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                phone: user.phone,
                kycVerified: user.kyc_verified,
                kycStatus: user.kyc_status,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get user data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = exports;
