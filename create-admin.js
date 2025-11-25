// create-admin.js
// Script to create admin user for Dr. Dhvani

const bcrypt = require('bcryptjs');
const db = require('./db');

async function createAdmin() {
  try {
    console.log('📝 Creating admin user for Dr. Dhvani...');
    console.log('----------------------------------------');

    // Admin details
    const adminData = {
      full_name: 'Dr. Dhvani',
      email: 'dhvani@nutripath.com',
      phone: '8490025923',
      password: 'admin123', // Change this to a secure password!
      role: 'admin'
    };

    // Check if admin already exists
    const existingAdmin = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [adminData.email]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Email:', adminData.email);
      console.log('');
      console.log('💡 If you forgot the password, delete the user and run this script again:');
      console.log('   DELETE FROM users WHERE email = \'dhvani@nutripath.com\';');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(adminData.password, salt);

    // Insert admin user
    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, full_name, email, role, created_at`,
      [adminData.full_name, adminData.email, adminData.phone, password_hash, adminData.role]
    );

    const admin = result.rows[0];

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Admin Details:');
    console.log('   ID:', admin.id);
    console.log('   Name:', admin.full_name);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('   Email: dhvani@nutripath.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');
    console.log('🚀 You can now login at: http://localhost:5000/login.html');
    console.log('   Then access admin dashboard at: http://localhost:5000/admin-dashboard.html');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }

  process.exit();
}

createAdmin();