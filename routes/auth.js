// routes/auth.js
// Authentication routes for NUTRI PATH

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// JWT Secret (you'll add this to .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// ============================================
// REGISTER NEW USER
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, password, date_of_birth, gender } = req.body;

    // Validate required fields
    if (!full_name || !email || !password) {
      return res.status(400).json({ 
        error: 'Please provide name, email, and password' 
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Email already registered' 
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, date_of_birth, gender, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, full_name, email, phone, role, created_at`,
      [full_name, email, phone, password_hash, date_of_birth, gender, 'client']
    );

    const user = result.rows[0];

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token valid for 7 days
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============================================
// LOGIN USER
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please provide email and password' 
      });
    }

    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account is deactivated. Please contact support.' 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// GET USER PROFILE
// GET /api/auth/profile
// Protected route - requires token
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, email, phone, date_of_birth, gender, role, created_at 
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================
// UPDATE USER PROFILE
// PUT /api/auth/profile
// Protected route - requires token
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, date_of_birth, gender } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           date_of_birth = COALESCE($3, date_of_birth),
           gender = COALESCE($4, gender),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, full_name, email, phone, date_of_birth, gender`,
      [full_name, phone, date_of_birth, gender, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, date_of_birth, gender } = req.body;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, 
           phone = $2, 
           date_of_birth = $3, 
           gender = $4, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, full_name, email, phone, date_of_birth, gender, role, created_at, updated_at`,
      [full_name, phone, date_of_birth, gender, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/auth/change-password - Change user password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.userId;

    if (!current_password || !new_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 6 characters' 
      });
    }

    // Get current user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});


// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success even if user doesn't exist (security best practice)
    // This prevents email enumeration attacks
    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset request has been sent to the administrator'
      });
    }

    const user = userResult.rows[0];

    // Store password reset request in database
    // You could create a password_reset_requests table for this
    // For now, we'll just log it or you can send an email to admin

    console.log('Password Reset Request:', {
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
      requestedAt: new Date()
    });

    // TODO: Send email to admin about password reset request
    // You can use nodemailer or any email service here
    
    // For now, just return success
    res.json({
      success: true,
      message: 'Password reset request has been sent to the administrator'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});


// POST /api/auth/admin/reset-password - Admin resets user password
router.post('/admin/reset-password', authenticateToken, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized. Admin access required.' 
      });
    }

    if (!userId || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING email, full_name',
      [hashedPassword, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    // TODO: Send email to user with new password
    console.log('Password Reset by Admin:', {
      userId: userId,
      userEmail: user.email,
      userName: user.full_name,
      newPassword: newPassword, // In production, don't log passwords!
      resetBy: req.user.email,
      resetAt: new Date()
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        email: user.email,
        full_name: user.full_name
      }
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// MIDDLEWARE: Authenticate Token
// ============================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = router;