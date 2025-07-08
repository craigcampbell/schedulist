const db = require('./schedulist/src/models');

async function checkAppointments() {
  try {
    console.log('🔍 Checking appointments in database...');
    
    const appointments = await db.Appointment.findAll({
      attributes: ['id', 'patientId', 'therapistId', 'serviceType', 'status', 'startTime', 'endTime'],
      order: [['startTime', 'DESC']],
      limit: 10
    });
    
    console.log(`\n📊 Found ${appointments.length} recent appointments:`);
    appointments.forEach((app, index) => {
      console.log(`${index + 1}. ID: ${app.id}`);
      console.log(`   - patientId: ${app.patientId}`);
      console.log(`   - therapistId: ${app.therapistId}`);
      console.log(`   - serviceType: "${app.serviceType}"`);
      console.log(`   - status: ${app.status}`);
      console.log(`   - startTime: ${app.startTime}`);
      console.log(`   ---`);
    });
    
    // Check serviceType distribution
    const serviceTypes = await db.Appointment.findAll({
      attributes: [
        'serviceType',
        [db.sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['serviceType'],
      raw: true
    });
    
    console.log('\n📈 ServiceType distribution:');
    serviceTypes.forEach(type => {
      console.log(`   - "${type.serviceType}": ${type.count} appointments`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

checkAppointments();