const db = require('../src/models');

const resetDatabase = async () => {
  try {
    console.log('🗑️  Dropping all tables...');
    
    // Force sync will drop all tables and recreate them
    await db.sequelize.sync({ force: true });
    
    console.log('✅ All tables dropped and recreated successfully');
    console.log('\nNow run: npm run db:seed to populate with fresh data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
};

resetDatabase();