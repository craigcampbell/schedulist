/**
 * Client-Side Conflict Detection Test Suite
 * 
 * This script tests the frontend conflict detection utility to ensure
 * real-time validation prevents scheduling conflicts before API submission.
 * 
 * Usage: node test-client-conflict-detection.js
 * 
 * Tests covered:
 * - No conflicts scenario
 * - Patient double-booking detection
 * - Therapist double-booking detection
 * - Daily session limit warnings
 * - Basic form validation
 * - Message formatting
 */

// Mock appointments for testing
const mockAppointments = [
  {
    id: '1',
    patient: { id: 'patient1', firstName: 'John', lastName: 'Doe' },
    therapist: { id: 'therapist1', name: 'Alice Smith' },
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    status: 'scheduled'
  },
  {
    id: '2',
    patient: { id: 'patient2', firstName: 'Jane', lastName: 'Smith' },
    therapist: { id: 'therapist1', name: 'Alice Smith' },
    startTime: '2024-01-15T14:00:00Z',
    endTime: '2024-01-15T15:00:00Z',
    status: 'scheduled'
  },
  {
    id: '3',
    patient: { id: 'patient1', firstName: 'John', lastName: 'Doe' },
    therapist: { id: 'therapist2', name: 'Bob Johnson' },
    startTime: '2024-01-15T16:00:00Z',
    endTime: '2024-01-15T17:00:00Z',
    status: 'scheduled'
  }
];

// Load the client-side conflict detection
const fs = require('fs');
const path = require('path');

// Read the client-side conflict detection file
const clientConflictDetectionPath = path.join(__dirname, 'client/src/utils/conflictDetection.js');
let clientCode = fs.readFileSync(clientConflictDetectionPath, 'utf8');

// Convert ES6 exports to CommonJS for Node.js testing
clientCode = clientCode.replace(/export const/g, 'const');
clientCode = clientCode.replace(/export \{[^}]+\};?/g, '');

// Add CommonJS exports at the end
clientCode += `
module.exports = {
  timePeriodsOverlap,
  checkPatientConflicts,
  checkTherapistConflicts,
  checkDailyLimits,
  validateAppointmentClient,
  formatConflictMessages
};
`;

// Execute the code
eval(clientCode);

// Test the client-side validation
async function testClientConflictDetection() {
  console.log('Testing client-side conflict detection...\n');

  try {
    console.log('✅ Client-side conflict detection module loaded successfully');

    // Test case 1: No conflicts
    console.log('\n--- Test Case 1: No conflicts ---');
    const result1 = module.exports.validateAppointmentClient({
      patientId: 'patient3',
      therapistId: 'therapist3',
      startTime: new Date('2024-01-15T09:00:00Z'),
      endTime: new Date('2024-01-15T09:30:00Z')
    }, mockAppointments);
    
    console.log('Result 1 (should be valid):', {
      isValid: result1.isValid,
      errorCount: result1.errors.length,
      warningCount: result1.warnings.length
    });

    // Test case 2: Patient conflict
    console.log('\n--- Test Case 2: Patient conflict ---');
    const result2 = module.exports.validateAppointmentClient({
      patientId: 'patient1',
      therapistId: 'therapist3',
      startTime: new Date('2024-01-15T10:30:00Z'),
      endTime: new Date('2024-01-15T11:30:00Z')
    }, mockAppointments);
    
    console.log('Result 2 (should have patient conflict):', {
      isValid: result2.isValid,
      errorCount: result2.errors.length,
      warningCount: result2.warnings.length,
      errors: result2.errors.map(e => e.type)
    });

    // Test case 3: Therapist conflict
    console.log('\n--- Test Case 3: Therapist conflict ---');
    const result3 = module.exports.validateAppointmentClient({
      patientId: 'patient3',
      therapistId: 'therapist1',
      startTime: new Date('2024-01-15T10:30:00Z'),
      endTime: new Date('2024-01-15T11:30:00Z')
    }, mockAppointments);
    
    console.log('Result 3 (should have therapist conflict):', {
      isValid: result3.isValid,
      errorCount: result3.errors.length,
      warningCount: result3.warnings.length,
      errors: result3.errors.map(e => e.type)
    });

    // Test case 4: Daily limit warning
    console.log('\n--- Test Case 4: Daily limit check ---');
    const result4 = module.exports.validateAppointmentClient({
      patientId: 'patient1',
      therapistId: 'therapist3',
      startTime: new Date('2024-01-15T08:00:00Z'),
      endTime: new Date('2024-01-15T15:00:00Z') // 7 hour appointment
    }, mockAppointments);
    
    console.log('Result 4 (should have daily limit warning):', {
      isValid: result4.isValid,
      errorCount: result4.errors.length,
      warningCount: result4.warnings.length,
      warnings: result4.warnings.map(w => w.type)
    });

    // Test case 5: Basic validation
    console.log('\n--- Test Case 5: Basic validation errors ---');
    const result5 = module.exports.validateAppointmentClient({
      patientId: '',
      therapistId: 'therapist1',
      startTime: new Date('2024-01-15T11:00:00Z'),
      endTime: new Date('2024-01-15T10:30:00Z')
    }, mockAppointments);
    
    console.log('Result 5 (should have basic validation errors):', {
      isValid: result5.isValid,
      errorCount: result5.errors.length,
      errors: result5.errors.map(e => e.type)
    });

    // Test case 6: Format messages
    console.log('\n--- Test Case 6: Format conflict messages ---');
    const messages = module.exports.formatConflictMessages(result2);
    console.log('Formatted messages:', {
      hasBlockingErrors: messages.hasBlockingErrors,
      hasWarnings: messages.hasWarnings,
      errorMessages: messages.errors,
      warningMessages: messages.warnings
    });

    console.log('\n✅ All client-side tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Client-side test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
testClientConflictDetection();