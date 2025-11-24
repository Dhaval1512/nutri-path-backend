// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple route to test
app.get("/", (req, res) => {
  res.send("Nutri Path API is running 🚀");
});

// Use PORT from env or default 5000
const PORT = process.env.PORT || 5000;

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


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
