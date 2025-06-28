const { User, Patient, Appointment } = require('./src/models');

async function debugForeignKeys() {
  try {
    // Get a specific appointment and check its patientId
    const appointment = await Appointment.findOne();
    console.log('Sample appointment:');
    console.log('- ID:', appointment.id);
    console.log('- Patient ID:', appointment.patientId);
    console.log('- Therapist ID:', appointment.therapistId);
    
    // Check if the patient exists with this exact ID
    const patient = await Patient.findByPk(appointment.patientId);
    console.log('- Patient exists:', patient ? `${patient.firstName} ${patient.lastName}` : 'NOT FOUND');
    
    // Try without any where conditions
    console.log('\n=== Testing without organization filter ===');
    const appointmentWithPatient = await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: Patient,
          required: false
        }
      ]
    });
    
    console.log('Patient loaded:', appointmentWithPatient.Patient ? 
                `${appointmentWithPatient.Patient.firstName} ${appointmentWithPatient.Patient.lastName}` : 
                'NULL');
    
    // Check the raw SQL being generated
    console.log('\n=== Check exact column names ===');
    const rawAppointment = await Appointment.findOne({ raw: true });
    console.log('Raw appointment columns:', Object.keys(rawAppointment));
    
    const rawPatient = await Patient.findOne({ raw: true });
    console.log('Raw patient columns:', Object.keys(rawPatient));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugForeignKeys();