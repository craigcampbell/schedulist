const { User, Patient, Appointment } = require('./src/models');

async function debugVirtualFields() {
  try {
    console.log('=== Testing Patient Association with ID only ===');
    const appointment = await Appointment.findOne({
      include: [
        {
          model: Patient,
          attributes: ['id'], // Only ID, no virtual fields
          required: false
        }
      ]
    });
    
    console.log('Patient ID loaded:', appointment.Patient ? appointment.Patient.id : 'NULL');
    
    console.log('\n=== Testing with organization filter ===');
    const bcba = await User.findOne({ where: { email: 'bcba@sunshine.com' } });
    
    const appointment2 = await Appointment.findOne({
      include: [
        {
          model: Patient,
          attributes: ['id'],
          where: { organizationId: bcba.organizationId },
          required: false
        }
      ]
    });
    
    console.log('Patient ID with org filter:', appointment2.Patient ? appointment2.Patient.id : 'NULL');
    
    console.log('\n=== Testing Patient decryption separately ===');
    const patient = await Patient.findByPk(appointment.patientId);
    console.log('Patient direct fetch:', patient ? `${patient.firstName} ${patient.lastName}` : 'NULL');
    
    console.log('\n=== Testing full association with virtual fields ===');
    const appointment3 = await Appointment.findOne({
      include: [
        {
          model: Patient,
          attributes: ['id', 'firstName', 'lastName'],
          required: false
        }
      ]
    });
    
    console.log('Patient with virtual fields:', appointment3.Patient ? 
                `${appointment3.Patient.firstName} ${appointment3.Patient.lastName}` : 'NULL');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugVirtualFields();