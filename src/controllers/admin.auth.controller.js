const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

/**
 * Register Admin
 */
const registerAdmin = async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Username, email, and password are required'
            });
        }

        const existingAdmin = await db.query(
            'SELECT id FROM admins WHERE email = $1 OR username = $2',
            [email.toLowerCase(), username.toLowerCase()]
        );

        if (existingAdmin.rows.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Admin with this email or username already exists'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO admins (username, email, password, full_name, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, username, email, full_name, role, is_active, created_at`,
            [username.toLowerCase(), email.toLowerCase(), hashedPassword, fullName]
        );

        const newAdmin = result.rows[0];

        console.log(`✅ Admin registered: ${newAdmin.email}`);

        res.status(201).json({
            status: 'success',
            message: 'Admin account created successfully',
            data: {
                id: newAdmin.id,
                username: newAdmin.username,
                email: newAdmin.email,
                fullName: newAdmin.full_name,
                role: newAdmin.role
            }
        });

    } catch (error) {
        console.error('❌ Admin registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Admin registration failed',
            error: error.message
        });
    }
};

/**
 * Admin Login
 */
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        console.log(`🔐 Admin login attempt: ${email}`);

        const result = await db.query(
            'SELECT * FROM admins WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Admin not found: ${email}`);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            console.log(`❌ Admin disabled: ${email}`);
            return res.status(403).json({
                status: 'error',
                message: 'Admin account is disabled'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        
        if (!isPasswordValid) {
            console.log(`❌ Invalid password: ${email}`);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        await db.query(
            'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [admin.id]
        );

        const token = jwt.sign(
            { 
                id: admin.id,
                email: admin.email,
                role: admin.role,
                isAdmin: true
            },
            process.env.JWT_SECRET || 'flipcash-secret-key-2025',
            { expiresIn: '12h' }
        );

        console.log(`✅ Admin login successful: ${admin.email}`);

        res.status(200).json({
            status: 'success',
            message: 'Admin login successful',
            data: {
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.full_name,
                    role: admin.role
                }
            }
        });

    } catch (error) {
        console.error('❌ Admin login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed',
            error: error.message
        });
    }
};

/**
 * Verify Admin
 */
const verifyAdmin = async (req, res) => {
    try {
        const adminId = req.user.id;

        const result = await db.query(
            'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = $1',
            [adminId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Admin not found'
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin account is disabled'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('❌ Verify admin error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Verification failed',
            error: error.message
        });
    }
};

// Export all functions
module.exports = {
    registerAdmin,
    adminLogin,
    verifyAdmin
};
