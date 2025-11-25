// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const authRoutes = require("./routes/auth");
const appointmentsRoutes = require("./routes/appointments");
const adminRoutes = require("./routes/admin");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple route to test
app.get("/", (req, res) => {
  res.send("Nutri Path API is running 🚀");
});

// Health check route
app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({
      status: "ok",
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error("DB health check failed:", err);
    res.status(500).json({ status: "error", message: "Database not reachable" });
  }
});

// Contact form route
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await db.query(
      "INSERT INTO inquiries (name, email, message) VALUES ($1, $2, $3)",
      [name, email, message]
    );

    res.json({ success: true, message: "Inquiry saved successfully" });
  } catch (err) {
    console.error("Error inserting inquiry:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================
app.use("/api/auth", authRoutes);

// ============================================
// APPOINTMENTS ROUTES
// ============================================
app.use("/api/appointments", appointmentsRoutes);

// ============================================
// ADMIN ROUTES
// ============================================
app.use("/api/admin", adminRoutes);

// ============================================
// SERVICES ROUTES
// ============================================
// Get all services
app.get("/api/services", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM services WHERE is_active = true ORDER BY id"
    );
    res.json({
      success: true,
      services: result.rows
    });
  } catch (err) {
    console.error("Error fetching services:", err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Get single service
app.get("/api/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT * FROM services WHERE id = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    
    res.json({
      success: true,
      service: result.rows[0]
    });
  } catch (err) {
    console.error("Error fetching service:", err);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

// Use PORT from env or default 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}`);
});