const { Sequelize } = require('sequelize');
require('dotenv').config();

const dropAndRecreateDB = async () => {
  try {
    console.log('🗑️  Dropping and recreating database...');
    
    // Connect to postgres without specifying a database
    const sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS,
      logging: false
    });
    
    // Drop the database if it exists
    await sequelize.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME};`);
    console.log('✅ Database dropped');
    
    // Create the database
    await sequelize.query(`CREATE DATABASE ${process.env.DB_NAME};`);
    console.log('✅ Database created');
    
    await sequelize.close();
    
    // Now sync all models to create tables
    const db = require('../src/models');
    await db.sequelize.sync({ force: true });
    console.log('✅ All tables created');
    
    console.log('\nDatabase completely reset!');
    console.log('Now run: npm run db:seed to populate with fresh data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
};

dropAndRecreateDB();