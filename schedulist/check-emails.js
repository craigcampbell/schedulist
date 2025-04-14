const db = require('./src/models');

async function checkEmails() {
  try {
    const users = await db.User.findAll({
      attributes: ['id', 'firstName', 'lastName', 'email']
    });
    console.log('User emails:');
    users.forEach(user => {
      console.log(`${user.firstName} ${user.lastName}: ${user.email}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkEmails();
