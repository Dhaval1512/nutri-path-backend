// setup-db.js
// This script sets up your NUTRI PATH database tables

const fs = require('fs');
const db = require('./db');

async function setupDatabase() {
  try {
    console.log('📊 Starting database setup...');
    console.log('------------------------------------');
    
    // Read the schema file
    const schemaFile = fs.existsSync('./schema-fixed.sql') 
      ? './schema-fixed.sql' 
      : './schema.sql';
    
    console.log(`📄 Reading ${schemaFile}...`);
    const schema = fs.readFileSync(schemaFile, 'utf8');
    
    // Execute the SQL
    console.log('⚙️  Executing SQL commands...');
    await db.query(schema);
    
    // Verify setup
    console.log('✅ Verifying tables...');
    
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const servicesResult = await db.query('SELECT COUNT(*) FROM services');
    
    console.log('------------------------------------');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('📋 Tables created:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log('');
    console.log(`✅ Services available: ${servicesResult.rows[0].count}`);
    console.log('');
    console.log('✅ Ready for Step 2: Authentication!');
    console.log('------------------------------------');
    
  } catch (error) {
    console.error('❌ Error setting up database:');
    console.error('   Error:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is running');
    console.log('   2. Check your .env file has correct DATABASE_URL');
    console.log('   3. Make sure schema-fixed.sql is in the same folder');
    console.log('');
    console.log('📧 If error persists, share the full error message');
  }
  
  process.exit();
}

// Run the setup
setupDatabase();