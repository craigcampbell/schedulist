const { User, Patient, Appointment } = require('./src/models');
const { Op } = require('sequelize');

async function debugPatients() {
  try {
    // Get today's appointments
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const appointments = await Appointment.findAll({
      where: {
        startTime: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    console.log('Today\'s appointments and their patient IDs:');
    for (const apt of appointments) {
      console.log('- Appointment', apt.id, 'Patient ID:', apt.patientId);
      
      // Check if this patient exists
      const patient = await Patient.findByPk(apt.patientId);
      console.log('  Patient exists:', patient ? `${patient.firstName} ${patient.lastName}` : 'NOT FOUND');
    }
    
    // Also check if patients table has proper associations
    console.log('\n=== Testing Patient Association ===');
    const appointmentWithPatient = await Appointment.findOne({
      include: [
        {
          model: Patient,
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
    
    if (appointmentWithPatient) {
      console.log('Sample appointment with patient association:');
      console.log('- Appointment ID:', appointmentWithPatient.id);
      console.log('- Patient:', appointmentWithPatient.Patient ? 
                  `${appointmentWithPatient.Patient.firstName} ${appointmentWithPatient.Patient.lastName}` : 
                  'NULL');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugPatients();