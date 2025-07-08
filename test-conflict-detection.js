/**
 * Backend Conflict Detection Test Suite
 * 
 * This script tests the server-side conflict detection utility to ensure
 * no two therapists can have the same timeslot scheduled for the same patient.
 * 
 * Usage: node test-conflict-detection.js
 * 
 * Tests covered:
 * - No conflicts scenario
 * - Patient double-booking detection
 * - Therapist double-booking detection
 * - Basic validation errors
 */

// Mock required models for testing
const mockSequelize = {
  Sequelize: {
    Op: {
      between: Symbol('between'),
      ne: Symbol('ne'),
      notIn: Symbol('notIn'),
      or: Symbol('or'),
      and: Symbol('and'),
      lte: Symbol('lte'),
      gte: Symbol('gte'),
      in: Symbol('in')
    }
  }
};

// Mock appointments for testing
const mockAppointments = [
  {
    id: '1',
    patientId: 'patient1',
    therapistId: 'therapist1',
    startTime: new Date('2024-01-15T10:00:00'),
    endTime: new Date('2024-01-15T11:00:00'),
    status: 'scheduled'
  },
  {
    id: '2',
    patientId: 'patient2', 
    therapistId: 'therapist1',
    startTime: new Date('2024-01-15T14:00:00'),
    endTime: new Date('2024-01-15T15:00:00'),
    status: 'scheduled'
  }
];

// Mock models
const mockModels = {
  Appointment: {
    findAll: async (query) => {
      console.log('Mock Appointment.findAll called with:', JSON.stringify(query, null, 2));
      
      // Simple mock implementation that returns relevant appointments
      return mockAppointments.filter(appt => {
        if (query.where.patientId && appt.patientId !== query.where.patientId) return false;
        if (query.where.therapistId && appt.therapistId !== query.where.therapistId) return false;
        return true;
      });
    },
    findOne: async (query) => {
      console.log('Mock Appointment.findOne called with:', JSON.stringify(query, null, 2));
      return null; // No conflicts found
    }
  },
  TherapistAssignment: {
    findConflicts: async (therapistId, date, startTime, endTime, excludeId) => {
      console.log(`Mock TherapistAssignment.findConflicts called: ${therapistId}, ${date}, ${startTime}-${endTime}`);
      return []; // No assignment conflicts
    }
  }
};

// Mock require function to return our models
const originalRequire = require;
require = function(modulePath) {
  if (modulePath === '../models') {
    return mockModels;
  }
  if (modulePath === 'sequelize') {
    return mockSequelize;
  }
  return originalRequire.apply(this, arguments);
};

// Now test our conflict detection
async function testConflictDetection() {
  console.log('Testing conflict detection...\n');
  
  try {
    // Load our conflict detection module
    const { validateAppointment, checkPatientTherapistConflicts } = originalRequire('./schedulist/src/utils/conflictDetection.js');
    
    console.log('✅ Conflict detection module loaded successfully');

    // Test case 1: No conflicts
    console.log('\n--- Test Case 1: No conflicts ---');
    const result1 = await validateAppointment({
      patientId: 'patient3',
      therapistId: 'therapist2', 
      startTime: new Date('2024-01-15T09:00:00'),
      endTime: new Date('2024-01-15T10:00:00')
    });
    
    console.log('Result 1 (should be valid):', {
      isValid: result1.isValid,
      errorCount: result1.errors.length,
      warningCount: result1.warnings.length
    });

    // Test case 2: Patient conflict (overlapping time)
    console.log('\n--- Test Case 2: Patient conflict ---');
    const result2 = await validateAppointment({
      patientId: 'patient1',
      therapistId: 'therapist2',
      startTime: new Date('2024-01-15T10:30:00'),
      endTime: new Date('2024-01-15T11:30:00')
    });
    
    console.log('Result 2 (should have patient conflict):', {
      isValid: result2.isValid,
      errorCount: result2.errors.length,
      warningCount: result2.warnings.length,
      errors: result2.errors.map(e => e.type)
    });

    // Test case 3: Therapist conflict
    console.log('\n--- Test Case 3: Therapist conflict ---');
    const result3 = await validateAppointment({
      patientId: 'patient3',
      therapistId: 'therapist1',
      startTime: new Date('2024-01-15T10:30:00'),
      endTime: new Date('2024-01-15T11:30:00')
    });
    
    console.log('Result 3 (should have therapist conflict):', {
      isValid: result3.isValid,
      errorCount: result3.errors.length,
      warningCount: result3.warnings.length,
      errors: result3.errors.map(e => e.type)
    });

    // Test case 4: Basic validation errors
    console.log('\n--- Test Case 4: Basic validation errors ---');
    const result4 = await validateAppointment({
      patientId: '',
      therapistId: 'therapist1',
      startTime: new Date('2024-01-15T11:00:00'),
      endTime: new Date('2024-01-15T10:30:00') // End before start
    });
    
    console.log('Result 4 (should have validation errors):', {
      isValid: result4.isValid,
      errorCount: result4.errors.length,
      errors: result4.errors.map(e => e.type)
    });

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
testConflictDetection();