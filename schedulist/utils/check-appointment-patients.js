const { Sequelize } = require('sequelize');
const db = require('../src/models');

async function checkAppointments() {
  try {
    // Check appointments that should NOT have patients
    const noPatientTypes = ['indirect', 'lunch', 'supervision', 'cleaning'];
    
    const appointmentsWithPatients = await db.Appointment.findAll({
      where: {
        serviceType: noPatientTypes,
        patientId: {
          [Sequelize.Op.ne]: null
        }
      },
      attributes: ['id', 'serviceType', 'title', 'patientId'],
      include: [{
        model: db.Patient,
        attributes: ['firstName', 'lastName']
      }]
    });

    if (appointmentsWithPatients.length > 0) {
      console.log(`\n❌ FOUND ${appointmentsWithPatients.length} appointments that should NOT have patients but do:`);
      appointmentsWithPatients.forEach(app => {
        console.log(`  - ${app.serviceType}: "${app.title}" has patient ${app.Patient?.firstName} ${app.Patient?.lastName}`);
      });
    } else {
      console.log('\n✅ All indirect, lunch, supervision, and cleaning appointments correctly have NO patients assigned!');
    }

    // Show statistics
    const stats = await db.Appointment.findAll({
      attributes: [
        'serviceType',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('COUNT', Sequelize.col('patientId')), 'withPatient']
      ],
      group: ['serviceType'],
      raw: true
    });

    console.log('\nAppointment Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat.serviceType}: ${stat.count} total, ${stat.withPatient} with patients`);
    });

  } catch (error) {
    console.error('Error checking appointments:', error);
  } finally {
    await db.sequelize.close();
  }
}

checkAppointments();