/**
 * Client-side conflict detection utility
 * 
 * This utility provides real-time validation to prevent double-booking
 * before submitting to the backend API.
 */

/**
 * Check if two time periods overlap
 * @param {Date} start1 - Start time of first period
 * @param {Date} end1 - End time of first period  
 * @param {Date} start2 - Start time of second period
 * @param {Date} end2 - End time of second period
 * @returns {boolean} True if periods overlap
 */
export const timePeriodsOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

/**
 * Check for patient conflicts in existing appointments
 * @param {string} patientId - Patient ID
 * @param {Date} startTime - Appointment start time
 * @param {Date} endTime - Appointment end time
 * @param {Array} existingAppointments - Array of existing appointments
 * @param {string} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Conflict result
 */
export const checkPatientConflicts = (patientId, startTime, endTime, existingAppointments, excludeAppointmentId = null) => {
  const conflicts = {
    hasConflict: false,
    conflictingAppointments: [],
    errors: [],
    warnings: []
  };

  if (!patientId || !startTime || !endTime || !existingAppointments) {
    return conflicts;
  }

  // Filter appointments for this patient (excluding cancelled/no-show)
  const patientAppointments = existingAppointments.filter(appt => 
    appt.patient?.id === patientId && 
    appt.id !== excludeAppointmentId &&
    !['cancelled', 'no-show'].includes(appt.status)
  );

  // Check for time overlaps
  const conflictingAppts = patientAppointments.filter(appt => {
    const apptStart = new Date(appt.startTime);
    const apptEnd = new Date(appt.endTime);
    return timePeriodsOverlap(startTime, endTime, apptStart, apptEnd);
  });

  if (conflictingAppts.length > 0) {
    conflicts.hasConflict = true;
    conflicts.conflictingAppointments = conflictingAppts;
    conflicts.errors.push({
      type: 'patient_double_booking',
      message: `Patient already has ${conflictingAppts.length} appointment(s) scheduled during this time`,
      details: conflictingAppts.map(appt => ({
        id: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        therapist: appt.therapist?.name || 'Unassigned'
      }))
    });
  }

  return conflicts;
};

/**
 * Check for therapist conflicts in existing appointments
 * @param {string} therapistId - Therapist ID
 * @param {Date} startTime - Appointment start time
 * @param {Date} endTime - Appointment end time
 * @param {Array} existingAppointments - Array of existing appointments
 * @param {string} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Conflict result
 */
export const checkTherapistConflicts = (therapistId, startTime, endTime, existingAppointments, excludeAppointmentId = null) => {
  const conflicts = {
    hasConflict: false,
    conflictingAppointments: [],
    errors: [],
    warnings: []
  };

  if (!therapistId || !startTime || !endTime || !existingAppointments) {
    return conflicts;
  }

  // Filter appointments for this therapist (excluding cancelled/no-show)
  const therapistAppointments = existingAppointments.filter(appt => 
    appt.therapist?.id === therapistId && 
    appt.id !== excludeAppointmentId &&
    !['cancelled', 'no-show'].includes(appt.status)
  );

  // Check for time overlaps
  const conflictingAppts = therapistAppointments.filter(appt => {
    const apptStart = new Date(appt.startTime);
    const apptEnd = new Date(appt.endTime);
    return timePeriodsOverlap(startTime, endTime, apptStart, apptEnd);
  });

  if (conflictingAppts.length > 0) {
    conflicts.hasConflict = true;
    conflicts.conflictingAppointments = conflictingAppts;
    conflicts.errors.push({
      type: 'therapist_double_booking',
      message: `Therapist already has ${conflictingAppts.length} appointment(s) scheduled during this time`,
      details: conflictingAppts.map(appt => ({
        id: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        patient: appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : 'Unknown'
      }))
    });
  }

  // Check for nearby appointments (warning for tight scheduling)
  const bufferMinutes = 15;
  const bufferStart = new Date(startTime.getTime() - bufferMinutes * 60000);
  const bufferEnd = new Date(endTime.getTime() + bufferMinutes * 60000);

  const nearbyAppts = therapistAppointments.filter(appt => {
    const apptStart = new Date(appt.startTime);
    const apptEnd = new Date(appt.endTime);
    
    // Check if existing appointment ends within buffer before new appointment
    if (apptEnd > bufferStart && apptEnd <= startTime) return true;
    
    // Check if existing appointment starts within buffer after new appointment
    if (apptStart >= endTime && apptStart < bufferEnd) return true;
    
    return false;
  });

  if (nearbyAppts.length > 0) {
    conflicts.warnings.push({
      type: 'tight_scheduling',
      message: `Therapist has appointments within ${bufferMinutes} minutes of this time slot`,
      details: nearbyAppts.map(appt => ({
        id: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        patient: appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : 'Unknown'
      }))
    });
  }

  return conflicts;
};

/**
 * Check for daily session limits for a patient
 * @param {string} patientId - Patient ID
 * @param {Date} appointmentDate - Date of the appointment
 * @param {number} sessionDurationHours - Duration of new session in hours
 * @param {Array} existingAppointments - Array of existing appointments
 * @param {number} dailyLimit - Daily hour limit (default: 8)
 * @returns {Object} Daily limit check result
 */
export const checkDailyLimits = (patientId, appointmentDate, sessionDurationHours, existingAppointments, dailyLimit = 8) => {
  const result = {
    exceedsLimit: false,
    currentDailyHours: 0,
    newTotalHours: 0,
    warnings: []
  };

  if (!patientId || !appointmentDate || !existingAppointments) {
    return result;
  }

  // Get start and end of the appointment date
  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(appointmentDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Filter appointments for this patient on this day
  const dailyAppointments = existingAppointments.filter(appt => {
    if (appt.patient?.id !== patientId) return false;
    if (['cancelled', 'no-show'].includes(appt.status)) return false;
    
    const apptDate = new Date(appt.startTime);
    return apptDate >= dayStart && apptDate <= dayEnd;
  });

  // Calculate current daily hours
  result.currentDailyHours = dailyAppointments.reduce((total, appt) => {
    const start = new Date(appt.startTime);
    const end = new Date(appt.endTime);
    const hours = (end - start) / (1000 * 60 * 60);
    return total + hours;
  }, 0);

  result.newTotalHours = result.currentDailyHours + sessionDurationHours;

  if (result.newTotalHours > dailyLimit) {
    result.exceedsLimit = true;
    result.warnings.push({
      type: 'daily_limit_exceeded',
      message: `Patient will have ${result.newTotalHours.toFixed(1)} hours scheduled for this day (limit: ${dailyLimit} hours)`,
      details: {
        currentHours: result.currentDailyHours,
        sessionHours: sessionDurationHours,
        totalHours: result.newTotalHours,
        limit: dailyLimit
      }
    });
  } else if (result.newTotalHours > dailyLimit * 0.8) {
    // Warning at 80% of daily limit
    result.warnings.push({
      type: 'approaching_daily_limit',
      message: `Patient will have ${result.newTotalHours.toFixed(1)} hours scheduled (approaching ${dailyLimit} hour limit)`,
      details: {
        currentHours: result.currentDailyHours,
        sessionHours: sessionDurationHours,
        totalHours: result.newTotalHours,
        limit: dailyLimit
      }
    });
  }

  return result;
};

/**
 * Comprehensive appointment validation combining all checks
 * @param {Object} appointmentData - Appointment data
 * @param {Array} existingAppointments - Array of existing appointments
 * @param {string} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Complete validation result
 */
export const validateAppointmentClient = (appointmentData, existingAppointments, excludeAppointmentId = null) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    conflicts: []
  };

  const { patientId, therapistId, startTime, endTime } = appointmentData;

  // Convert string dates to Date objects if needed
  const startDateTime = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDateTime = typeof endTime === 'string' ? new Date(endTime) : endTime;

  // Basic validation
  if (!patientId) {
    validation.isValid = false;
    validation.errors.push({ type: 'missing_patient', message: 'Patient is required' });
  }

  if (!startDateTime || !endDateTime) {
    validation.isValid = false;
    validation.errors.push({ type: 'missing_times', message: 'Start and end times are required' });
    return validation;
  }

  if (startDateTime >= endDateTime) {
    validation.isValid = false;
    validation.errors.push({ type: 'invalid_time_range', message: 'End time must be after start time' });
  }

  const durationMinutes = (endDateTime - startDateTime) / (1000 * 60);
  if (durationMinutes < 30) {
    validation.isValid = false;
    validation.errors.push({ type: 'minimum_duration', message: 'Appointment must be at least 30 minutes long' });
  }

  // Skip conflict detection if basic validation failed
  if (!validation.isValid) {
    return validation;
  }

  // Check patient conflicts
  const patientConflicts = checkPatientConflicts(
    patientId, 
    startDateTime, 
    endDateTime, 
    existingAppointments, 
    excludeAppointmentId
  );

  if (patientConflicts.hasConflict) {
    validation.isValid = false;
    validation.errors.push(...patientConflicts.errors);
    validation.conflicts.push(...patientConflicts.conflictingAppointments);
  }

  // Check therapist conflicts (if therapist is assigned)
  if (therapistId) {
    const therapistConflicts = checkTherapistConflicts(
      therapistId, 
      startDateTime, 
      endDateTime, 
      existingAppointments, 
      excludeAppointmentId
    );

    if (therapistConflicts.hasConflict) {
      validation.isValid = false;
      validation.errors.push(...therapistConflicts.errors);
      validation.conflicts.push(...therapistConflicts.conflictingAppointments);
    }

    validation.warnings.push(...therapistConflicts.warnings);
  }

  // Check daily limits
  const sessionHours = durationMinutes / 60;
  const dailyLimitCheck = checkDailyLimits(
    patientId,
    startDateTime,
    sessionHours,
    existingAppointments
  );

  validation.warnings.push(...dailyLimitCheck.warnings);

  return validation;
};

/**
 * Format conflict messages for display
 * @param {Object} validation - Validation result from validateAppointmentClient
 * @returns {Object} Formatted messages
 */
export const formatConflictMessages = (validation) => {
  const messages = {
    errors: [],
    warnings: [],
    hasBlockingErrors: validation.errors.length > 0,
    hasWarnings: validation.warnings.length > 0
  };

  // Format error messages
  validation.errors.forEach(error => {
    switch (error.type) {
      case 'patient_double_booking':
        messages.errors.push(`❌ ${error.message}`);
        break;
      case 'therapist_double_booking':
        messages.errors.push(`❌ ${error.message}`);
        break;
      case 'minimum_duration':
        messages.errors.push(`❌ ${error.message}`);
        break;
      case 'invalid_time_range':
        messages.errors.push(`❌ ${error.message}`);
        break;
      default:
        messages.errors.push(`❌ ${error.message}`);
    }
  });

  // Format warning messages
  validation.warnings.forEach(warning => {
    switch (warning.type) {
      case 'tight_scheduling':
        messages.warnings.push(`⚠️ ${warning.message}`);
        break;
      case 'daily_limit_exceeded':
        messages.warnings.push(`⚠️ ${warning.message}`);
        break;
      case 'approaching_daily_limit':
        messages.warnings.push(`⚠️ ${warning.message}`);
        break;
      default:
        messages.warnings.push(`⚠️ ${warning.message}`);
    }
  });

  return messages;
};