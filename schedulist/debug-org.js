const { User, Patient, Appointment } = require('./src/models');

async function debugOrganizations() {
  try {
    // Get BCBA user and their organization
    const bcba = await User.findOne({ where: { email: 'bcba@sunshine.com' } });
    console.log('BCBA User Organization:', bcba.organizationId);
    
    // Get a few patients and check their organizations
    const patients = await Patient.findAll({ limit: 5 });
    console.log('\nPatient Organizations:');
    patients.forEach(patient => {
      console.log(`- ${patient.firstName} ${patient.lastName}: ${patient.organizationId}`);
    });
    
    // Check if they match
    const sameOrgPatients = await Patient.findAll({
      where: { organizationId: bcba.organizationId }
    });
    console.log(`\nPatients in BCBA's organization: ${sameOrgPatients.length}`);
    
    // Try the exact query from the controller
    console.log('\n=== Testing Controller Query ===');
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const appointments = await Appointment.findAll({
      where: {
        startTime: {
          [require('sequelize').Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [
        {
          model: Patient,
          where: { organizationId: bcba.organizationId },
          required: false
        },
        {
          model: User,
          as: 'Therapist',
          attributes: ['id', 'firstName', 'lastName'],
          where: { organizationId: bcba.organizationId },
          required: false
        }
      ]
    });
    
    console.log('Appointments with org filter:', appointments.length);
    appointments.forEach(apt => {
      console.log(`- ${apt.startTime.toLocaleTimeString()} Patient: ${apt.Patient ? apt.Patient.firstName : 'NULL'} Therapist: ${apt.Therapist ? apt.Therapist.firstName : 'NULL'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugOrganizations();