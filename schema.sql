-- NUTRI PATH Database Schema
-- Created for Dr. Dhvani's Virtual Diet & Nutrition Clinic
-- This version handles existing tables safely

-- ============================================
-- 1. UPDATE INQUIRIES TABLE (if it exists)
-- ============================================
-- Add status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inquiries' AND column_name = 'status'
  ) THEN
    ALTER TABLE inquiries ADD COLUMN status VARCHAR(50) DEFAULT 'new';
  END IF;
END $$;

-- ============================================
-- 2. USERS TABLE (For authentication)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  role VARCHAR(50) DEFAULT 'client', -- 'client' or 'admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. SERVICES TABLE (What Dr. Dhvani offers)
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  price DECIMAL(10, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default services (only if table is empty)
INSERT INTO services (service_name, description, duration_minutes) 
SELECT * FROM (VALUES
  ('Weight Loss', 'Personalized weight loss program with customized diet plans', 60),
  ('Weight Gain', 'Healthy weight gain guidance with nutrition strategies', 60),
  ('Weight Management', 'Maintain your ideal weight with balanced nutrition', 60),
  ('Diabetes Mellitus Management', 'Specialized diet plans for diabetes control', 60),
  ('PCOD / PCOS', 'Hormonal balance through proper nutrition', 60),
  ('Thyroid', 'Thyroid-friendly diet and lifestyle guidance', 60),
  ('Hormonal Balance', 'Natural hormone regulation through diet', 60),
  ('Gut Health', 'Improve digestive health and gut microbiome', 60),
  ('Pregnancy Diet', 'Nutritional support during pregnancy', 60),
  ('Post Pregnancy', 'Postpartum nutrition and recovery plans', 60),
  ('Lifestyle Disorders', 'Manage lifestyle-related health issues', 60),
  ('Balanced Living Diet', 'Overall wellness and healthy living guidance', 60)
) AS v(service_name, description, duration_minutes)
WHERE NOT EXISTS (SELECT 1 FROM services LIMIT 1);

-- ============================================
-- 4. APPOINTMENTS TABLE (Booking system)
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. CLIENT PROFILES (Additional health info)
-- ============================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  height_cm DECIMAL(5, 2),
  weight_kg DECIMAL(5, 2),
  blood_group VARCHAR(10),
  medical_conditions TEXT,
  allergies TEXT,
  dietary_preferences TEXT, -- 'vegetarian', 'vegan', 'non-vegetarian', etc.
  health_goals TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. DIET PLANS TABLE (Future use)
-- ============================================
CREATE TABLE IF NOT EXISTS diet_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(255),
  plan_description TEXT,
  start_date DATE,
  end_date DATE,
  file_url TEXT, -- For storing PDF/document links (Cloudinary)
  created_by INTEGER REFERENCES users(id), -- Dr. Dhvani's user ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. INDEXES for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

-- ============================================
-- DONE!
-- ============================================