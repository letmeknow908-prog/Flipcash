const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// TEMPORARY IN-MEMORY USER STORAGE
// Replace with your actual database later
let users = [];

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
        const existingUser = users.find(u => u.email === email || u.phone === phone);
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this email or phone already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = {
            id: Date.now().toString(),
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
            kycVerified: false,
            kycStatus: 'not_submitted',
            createdAt: new Date()
        };

        users.push(user);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: { user: userWithoutPassword }
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
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

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
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                accessToken,
                user: userWithoutPassword
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

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        // Find user
        const user = users.find(u => u.email === email);
        if (!user) {
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

// Export users array so other controllers can access it
exports.users = users;

module.exports = exports;
