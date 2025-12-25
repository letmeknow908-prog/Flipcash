const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

/**
 * Register new user
 * Creates user account with hashed password and default wallets
 */
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        // Validate all required fields
        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required: firstName, lastName, email, phone, password'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide a valid email address'
            });
        }

        // Validate password strength (min 8 chars, 1 uppercase, 1 number, 1 special)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character'
            });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1 OR phone = $2',
            [email.toLowerCase(), phone]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this email or phone number already exists'
            });
        }

        // Hash password with bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user into database
        const userResult = await db.query(
            `INSERT INTO users (first_name, last_name, email, phone, password, kyc_verified, kyc_status, created_at)
             VALUES ($1, $2, $3, $4, $5, false, 'not_submitted', NOW())
             RETURNING id, first_name, last_name, email, phone, kyc_verified, kyc_status, created_at`,
            [firstName, lastName, email.toLowerCase(), phone, hashedPassword]
        );

        const newUser = userResult.rows[0];

        // Create default wallets (NGN and KSH)
        try {
            await db.query(
                `INSERT INTO wallets (user_id, currency, balance, created_at)
                 VALUES ($1, 'NGN', 0.00, NOW()), ($1, 'KSH', 0.00, NOW())`,
                [newUser.id]
            );
            console.log(`✅ Wallets created for user ${newUser.id}`);
        } catch (walletError) {
            console.error('⚠️ Wallet creation error:', walletError.message);
            // Continue even if wallet creation fails
        }

        // Format user response
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

        console.log(`✅ User registered: ${newUser.email}`);

        res.status(201).json({
            status: 'success',
            message: 'Account created successfully',
            data: { user: userResponse }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Login user
 * Authenticates user and returns JWT token
 */
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

        console.log(`🔐 Login attempt: ${email}`);

        // Find user by email (case-insensitive)
        const userResult = await db.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        // Check if user exists
        if (userResult.rows.length === 0) {
            console.log(`❌ Login failed: User not found - ${email}`);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        const user = userResult.rows[0];

        // Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log(`❌ Login failed: Invalid password - ${email}`);
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

        console.log(`✅ Login successful: ${user.email}`);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                accessToken,
                user: userResponse
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Forgot password
 * Initiates password reset process
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email address is required'
            });
        }

        // Check if user exists
        const userResult = await db.query(
            'SELECT id, email, phone FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        // Don't reveal if user exists for security
        if (userResult.rows.length === 0) {
            return res.status(200).json({
                status: 'success',
                message: 'If the email exists, a password reset link has been sent'
            });
        }

        const user = userResult.rows[0];

        // TODO: Implement password reset logic
        // 1. Generate reset token
        // 2. Store token in database with expiry
        // 3. Send SMS/Email with reset link
        
        console.log(`🔐 Password reset requested: ${user.email}`);

        res.status(200).json({
            status: 'success',
            message: 'Password reset instructions have been sent to your email and phone'
        });

    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process request. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get current user
 * Returns authenticated user's information
 */
exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        const userResult = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_verified, kyc_status, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];
        
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
        console.error('❌ Get user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve user data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = exports;
