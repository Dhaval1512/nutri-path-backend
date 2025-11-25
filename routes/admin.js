// routes/admin.js
// Admin routes for Dr. Dhvani

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware: Authenticate Admin Token
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ============================================
// GET DASHBOARD STATISTICS
// GET /api/admin/stats
// ============================================
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    // Total clients
    const clientsResult = await db.query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'client'"
    );

    // Total appointments by status
    const appointmentsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM appointments
    `);

    // Today's appointments
    const todayResult = await db.query(`
      SELECT COUNT(*) as today_appointments
      FROM appointments
      WHERE appointment_date = CURRENT_DATE
      AND status NOT IN ('cancelled')
    `);

    // Upcoming appointments (next 7 days)
    const upcomingResult = await db.query(`
      SELECT COUNT(*) as upcoming_appointments
      FROM appointments
      WHERE appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND status NOT IN ('cancelled', 'completed')
    `);

    // Most popular services
    const popularServicesResult = await db.query(`
      SELECT s.service_name, COUNT(a.id) as booking_count
      FROM services s
      LEFT JOIN appointments a ON s.id = a.service_id
      GROUP BY s.id, s.service_name
      ORDER BY booking_count DESC
      LIMIT 5
    `);

    // Recent appointments
    const recentAppointmentsResult = await db.query(`
      SELECT a.*, s.service_name, u.full_name, u.email, u.phone
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        total_clients: parseInt(clientsResult.rows[0].total),
        total_appointments: parseInt(appointmentsResult.rows[0].total),
        pending_appointments: parseInt(appointmentsResult.rows[0].pending),
        confirmed_appointments: parseInt(appointmentsResult.rows[0].confirmed),
        completed_appointments: parseInt(appointmentsResult.rows[0].completed),
        cancelled_appointments: parseInt(appointmentsResult.rows[0].cancelled),
        today_appointments: parseInt(todayResult.rows[0].today_appointments),
        upcoming_appointments: parseInt(upcomingResult.rows[0].upcoming_appointments),
        popular_services: popularServicesResult.rows,
        recent_appointments: recentAppointmentsResult.rows
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================
// GET ALL APPOINTMENTS (with filters)
// GET /api/admin/appointments
// ============================================
router.get('/appointments', authenticateAdmin, async (req, res) => {
  try {
    const { status, date, service_id, search } = req.query;

    let query = `
      SELECT a.*, s.service_name, s.duration_minutes,
             u.full_name, u.email, u.phone
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    // Filter by status
    if (status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Filter by date
    if (date) {
      query += ` AND a.appointment_date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    // Filter by service
    if (service_id) {
      query += ` AND a.service_id = $${paramCount}`;
      params.push(service_id);
      paramCount++;
    }

    // Search by client name or email
    if (search) {
      query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      appointments: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ============================================
// UPDATE APPOINTMENT STATUS
// PATCH /api/admin/appointments/:id/status
// ============================================
router.patch('/appointments/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE appointments 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Get full appointment details
    const appointment = await db.query(
      `SELECT a.*, s.service_name, u.full_name, u.email
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Appointment status updated',
      appointment: appointment.rows[0]
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============================================
// GET ALL CLIENTS
// GET /api/admin/clients
// ============================================
router.get('/clients', authenticateAdmin, async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.email, u.phone, u.date_of_birth, 
             u.gender, u.created_at, u.is_active,
             COUNT(a.id) as total_appointments
      FROM users u
      LEFT JOIN appointments a ON u.id = a.user_id
      WHERE u.role = 'client'
    `;

    const params = [];
    
    if (search) {
      query += ` AND (u.full_name ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      clients: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// ============================================
// GET SINGLE CLIENT DETAILS
// GET /api/admin/clients/:id
// ============================================
router.get('/clients/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get client info
    const clientResult = await db.query(
      `SELECT u.*, cp.height_cm, cp.weight_kg, cp.blood_group, 
              cp.medical_conditions, cp.allergies, cp.dietary_preferences, cp.health_goals
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1 AND u.role = 'client'`,
      [id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get client's appointments
    const appointmentsResult = await db.query(
      `SELECT a.*, s.service_name
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.user_id = $1
       ORDER BY a.appointment_date DESC`,
      [id]
    );

    res.json({
      success: true,
      client: clientResult.rows[0],
      appointments: appointmentsResult.rows
    });

  } catch (error) {
    console.error('Get client details error:', error);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

// ============================================
// GET INQUIRIES (Contact Form Submissions)
// GET /api/admin/inquiries
// ============================================
router.get('/inquiries', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM inquiries WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      inquiries: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// ============================================
// UPDATE INQUIRY STATUS
// PATCH /api/admin/inquiries/:id
// ============================================
router.patch('/inquiries/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'replied', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      success: true,
      message: 'Inquiry status updated',
      inquiry: result.rows[0]
    });

  } catch (error) {
    console.error('Update inquiry error:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

module.exports = router;