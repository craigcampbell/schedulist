const { User, Patient, Appointment } = require('./src/models');
const { Op } = require('sequelize');

async function debugData() {
  try {
    // Check if BCBA user exists and get their org
    const bcba = await User.findOne({ where: { email: 'bcba@sunshine.com' } });
    console.log('BCBA User:', bcba ? {
      id: bcba.id,
      name: bcba.firstName + ' ' + bcba.lastName,
      organizationId: bcba.organizationId
    } : 'NOT FOUND');
    
    if (!bcba) return;
    
    // Check patients in the same organization
    const patients = await Patient.findAll({ 
      where: { organizationId: bcba.organizationId }
    });
    console.log('\nPatients in same org:', patients.length);
    patients.forEach(p => console.log('- ' + p.firstName + ' ' + p.lastName + ' (ID: ' + p.id + ')'));
    
    // Check appointments for today
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
    console.log('\nAppointments today:', appointments.length);
    appointments.forEach(apt => {
      console.log('- ' + apt.startTime.toLocaleTimeString() + ' Patient ID: ' + apt.patientId + ' Therapist ID: ' + apt.therapistId);
    });
    
    // Check what the API endpoint would return
    console.log('\n=== Testing API Query ===');
    const teamScheduleData = await Appointment.findAll({
      where: {
        startTime: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [
        {
          model: Patient,
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'Therapist',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'BCBA',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
    
    console.log('Team schedule appointments:', teamScheduleData.length);
    teamScheduleData.forEach(apt => {
      console.log('- ' + apt.startTime.toLocaleTimeString() + 
                  ' Patient: ' + (apt.Patient ? apt.Patient.firstName : 'NULL') +
                  ' Therapist: ' + (apt.Therapist ? apt.Therapist.firstName : 'NULL'));
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugData();