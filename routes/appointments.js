// routes/appointments.js
// Appointment booking and management routes

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

// ============================================
// CREATE APPOINTMENT (Book)
// POST /api/appointments
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { service_id, appointment_date, appointment_time, notes } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ 
        error: 'Service, date, and time are required' 
      });
    }

    // Check if service exists
    const serviceCheck = await db.query(
      'SELECT * FROM services WHERE id = $1 AND is_active = true',
      [service_id]
    );

    if (serviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if time slot is available (optional - you can add more complex logic)
    const existingAppointment = await db.query(
      `SELECT * FROM appointments 
       WHERE appointment_date = $1 
       AND appointment_time = $2 
       AND status NOT IN ('cancelled')`,
      [appointment_date, appointment_time]
    );

    if (existingAppointment.rows.length > 0) {
      return res.status(400).json({ 
        error: 'This time slot is already booked. Please choose another time.' 
      });
    }

    // Create appointment
    const result = await db.query(
      `INSERT INTO appointments (user_id, service_id, appointment_date, appointment_time, notes, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending') 
       RETURNING *`,
      [user_id, service_id, appointment_date, appointment_time, notes]
    );

    // Get full appointment details with service info
    const appointment = await db.query(
      `SELECT a.*, s.service_name, s.description, s.duration_minutes,
              u.full_name, u.email, u.phone
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment: appointment.rows[0]
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// ============================================
// GET USER'S APPOINTMENTS
// GET /api/appointments
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { status } = req.query; // Optional filter by status

    let query = `
      SELECT a.*, s.service_name, s.description, s.duration_minutes
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.user_id = $1
    `;
    
    const params = [user_id];

    // Add status filter if provided
    if (status) {
      query += ' AND a.status = $2';
      params.push(status);
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      appointments: result.rows
    });

  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ============================================
// GET SINGLE APPOINTMENT
// GET /api/appointments/:id
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await db.query(
      `SELECT a.*, s.service_name, s.description, s.duration_minutes
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({
      success: true,
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// ============================================
// UPDATE APPOINTMENT
// PUT /api/appointments/:id
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const { appointment_date, appointment_time, notes } = req.body;

    // Check if appointment exists and belongs to user
    const appointmentCheck = await db.query(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment can be updated (not completed or cancelled)
    if (['completed', 'cancelled'].includes(appointmentCheck.rows[0].status)) {
      return res.status(400).json({ 
        error: 'Cannot update completed or cancelled appointments' 
      });
    }

    // Update appointment
    const result = await db.query(
      `UPDATE appointments 
       SET appointment_date = COALESCE($1, appointment_date),
           appointment_time = COALESCE($2, appointment_time),
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [appointment_date, appointment_time, notes, id, user_id]
    );

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// ============================================
// CANCEL APPOINTMENT
// DELETE /api/appointments/:id
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const { cancellation_reason } = req.body;

    // Check if appointment exists and belongs to user
    const appointmentCheck = await db.query(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update status to cancelled instead of deleting
    const result = await db.query(
      `UPDATE appointments 
       SET status = 'cancelled',
           cancellation_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [cancellation_reason, id, user_id]
    );

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// ============================================
// GET ALL APPOINTMENTS (Admin only)
// GET /api/appointments/admin/all
// ============================================
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { status, date } = req.query;

    let query = `
      SELECT a.*, s.service_name, u.full_name, u.email, u.phone
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (date) {
      query += ` AND a.appointment_date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    query += ' ORDER BY a.appointment_date ASC, a.appointment_time ASC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      appointments: result.rows
    });

  } catch (error) {
    console.error('Get all appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ============================================
// UPDATE APPOINTMENT STATUS (Admin only)
// PATCH /api/appointments/:id/status
// ============================================
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

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

    res.json({
      success: true,
      message: 'Appointment status updated',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;