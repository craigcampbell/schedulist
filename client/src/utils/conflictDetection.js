/**
 * Client-side conflict detection utility
 *
 * Provides real-time validation for appointments including
 * travel time, lunch breaks, break time between sessions,
 * and location-based constraints.
 */
/**
 * Check if two time periods overlap
 */
export const timePeriodsOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

/**
 * Check for patient conflicts in existing appointments
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

  const patientAppointments = existingAppointments.filter(appt =>
    appt.patient?.id === patientId &&
    appt.id !== excludeAppointmentId &&
    !['cancelled', 'no-show'].includes(appt.status)
  );

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

  const therapistAppointments = existingAppointments.filter(appt =>
    appt.therapist?.id === therapistId &&
    appt.id !== excludeAppointmentId &&
    !['cancelled', 'no-show'].includes(appt.status)
  );

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

  return conflicts;
};

/**
 * Calculate required travel time between two locations based on their types
 *
 * Location types:
 *   - 'clinic': In-clinic location
 *   - 'home': Patient's home / remote location
 *   - 'school': School-based location
 */
export const calculateRequiredTravelTime = (fromLocation, toLocation) => {
  if (!fromLocation || !toLocation) return 0;
  if (fromLocation.id === toLocation.id) return 0;

  const fromType = fromLocation.locationType || 'clinic';
  const toType = toLocation.locationType || 'clinic';

  if (fromType === toType) {
    if (fromType === 'clinic') return 15;
    if (fromType === 'home') return 30;
    if (fromType === 'school') return 20;
    return 15;
  }

  if (fromType === 'clinic' && toType === 'home') return 30;
  if (fromType === 'home' && toType === 'clinic') return 30;
  if (fromType === 'clinic' && toType === 'school') return 25;
  if (fromType === 'school' && toType === 'clinic') return 25;
  if (fromType === 'home' && toType === 'school') return 25;
  if (fromType === 'school' && toType === 'home') return 25;

  return 30;
};

/**
 * Check travel time sufficiency between appointments for the same therapist
 */
export const checkTravelTimeConflicts = (therapistId, startTime, endTime, locationId, locations, existingAppointments) => {
  const conflicts = {
    hasConflict: false,
    errors: [],
    warnings: []
  };

  if (!therapistId || !locationId || !locations?.length) return conflicts;

  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const newLocation = locations.find(l => l.id === locationId);
  if (!newLocation) return conflicts;

  const therapistsDayApps = existingAppointments
    .filter(app =>
      app.therapist?.id === therapistId &&
      !['cancelled', 'no-show'].includes(app.status)
    )
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  // Check previous appointment
  const prevApp = therapistsDayApps
    .filter(app => new Date(app.endTime) <= startTime)
    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))[0];

  if (prevApp) {
    const prevLocation = locations.find(l => l.id === prevApp.locationId);
    if (prevLocation && prevLocation.id !== locationId) {
      const gapToPrev = (startTime - new Date(prevApp.endTime)) / (1000 * 60);
      const requiredTravelTime = calculateRequiredTravelTime(prevLocation, newLocation);

      if (requiredTravelTime > 0 && gapToPrev < requiredTravelTime) {
        conflicts.hasConflict = true;
        conflicts.errors.push({
          type: 'insufficient_travel_time',
          message: `Insufficient travel time: need ${requiredTravelTime} min between "${prevLocation.name}" and "${newLocation.name}" but only ${Math.round(gapToPrev)} min available.`
        });
      } else if (requiredTravelTime > 0 && gapToPrev < requiredTravelTime + 15) {
        conflicts.warnings.push({
          type: 'tight_travel_time',
          message: `Tight travel: ${Math.round(gapToPrev)} min from "${prevLocation.name}" to "${newLocation.name}". Add buffer.`
        });
      }
    }
  }

  // Check next appointment
  const nextApp = therapistsDayApps
    .filter(app => new Date(app.startTime) >= endTime)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

  if (nextApp) {
    const nextLocation = locations.find(l => l.id === nextApp.locationId);
    if (nextLocation && nextLocation.id !== locationId) {
      const gapToNext = (new Date(nextApp.startTime) - endTime) / (1000 * 60);
      const requiredTravelTime = calculateRequiredTravelTime(newLocation, nextLocation);

      if (requiredTravelTime > 0 && gapToNext < requiredTravelTime) {
        conflicts.hasConflict = true;
        conflicts.errors.push({
          type: 'insufficient_travel_time',
          message: `Insufficient travel time: need ${requiredTravelTime} min from "${newLocation.name}" to "${nextLocation.name}" after this appointment but only ${Math.round(gapToNext)} min.`
        });
      }
    }
  }

  return conflicts;
};

/**
 * Check lunch break validation for the therapist's day
 */
export const checkLunchBreaks = (therapistId, startTime, endTime, serviceType, existingAppointments) => {
  const result = {
    hasConflict: false,
    errors: [],
    warnings: []
  };

  if (!therapistId || serviceType === 'lunch') return result;

  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const therapistsDayApps = existingAppointments.filter(app =>
    app.therapist?.id === therapistId &&
    !['cancelled', 'no-show'].includes(app.status)
  );

  const hasLunch = therapistsDayApps.some(app => app.serviceType === 'lunch');

  const directServiceHours = therapistsDayApps
    .filter(app => app.serviceType === 'direct' || app.serviceType === 'supervision')
    .reduce((total, app) => {
      return total + (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60 * 60);
    }, 0);

  const newSessionHours = (endTime - startTime) / (1000 * 60 * 60);
  const totalDirectHours = directServiceHours + newSessionHours;

  if (totalDirectHours >= 6 && !hasLunch) {
    result.hasConflict = true;
    result.errors.push({
      type: 'mandatory_lunch_missing',
      message: `Therapist requires a lunch break when scheduled for ${totalDirectHours.toFixed(1)}+ hours of direct service.`
    });
  } else if (totalDirectHours >= 4 && !hasLunch) {
    result.warnings.push({
      type: 'missing_lunch_recommended',
      message: `Therapist will have ${totalDirectHours.toFixed(1)} hours of direct service but no lunch break scheduled.`
    });
  }

  if (hasLunch && totalDirectHours < 4) {
    result.warnings.push({
      type: 'unnecessary_lunch',
      message: `Lunch break scheduled but therapist only has ${totalDirectHours.toFixed(1)} hours of direct service.`
    });
  }

  return result;
};

/**
 * Check for break time between consecutive sessions
 */
export const checkBreakTimeConflicts = (therapistId, startTime, endTime, serviceType, existingAppointments) => {
  const result = {
    hasConflict: false,
    warnings: []
  };

  if (!therapistId || serviceType === 'lunch' || serviceType === 'cleaning') return result;

  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const therapistsDayApps = existingAppointments
    .filter(app =>
      app.therapist?.id === therapistId &&
      !['cancelled', 'no-show'].includes(app.status) &&
      app.serviceType !== 'lunch' &&
      app.serviceType !== 'cleaning'
    )
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  // Check for tight scheduling buffer (<15 min)
  const bufferMinutes = 15;
  const bufferStartTime = new Date(startTime.getTime() - bufferMinutes * 60000);
  const bufferEndTime = new Date(endTime.getTime() + bufferMinutes * 60000);

  const nearbyAppts = therapistsDayApps.filter(app => {
    const apptStart = new Date(app.startTime);
    const apptEnd = new Date(app.endTime);
    return (apptEnd > bufferStartTime && apptEnd <= startTime) ||
           (apptStart >= endTime && apptStart < bufferEndTime);
  });

  if (nearbyAppts.length > 0) {
    result.warnings.push({
      type: 'tight_scheduling',
      message: `Therapist has appointments within ${bufferMinutes} minutes of this time slot`
    });
  }

  // Check for long consecutive blocks (>5 hours without a break)
  let blockStart = startTime;
  let blockEnd = endTime;
  let consecutiveCount = 1;

  for (const app of therapistsDayApps) {
    const appStart = new Date(app.startTime);
    const appEnd = new Date(app.endTime);
    const gapBefore = (startTime - appEnd) / (1000 * 60);
    const gapAfter = (appStart - endTime) / (1000 * 60);

    if (gapBefore >= 0 && gapBefore <= 30) {
      blockStart = new Date(Math.min(blockStart, appStart));
      consecutiveCount++;
    }
    if (gapAfter >= 0 && gapAfter <= 30) {
      blockEnd = new Date(Math.max(blockEnd, appEnd));
      consecutiveCount++;
    }
  }

  const consecutiveHours = (blockEnd - blockStart) / (1000 * 60 * 60);

  if (consecutiveHours > 5) {
    result.warnings.push({
      type: 'long_consecutive_block',
      message: `Therapist will have ${consecutiveHours.toFixed(1)} consecutive hours without a break. Consider adding a break or lunch.`
    });
  }

  return result;
};

/**
 * Check for daily session limits for a patient
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

  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(appointmentDate);
  dayEnd.setHours(23, 59, 59, 999);

  const dailyAppointments = existingAppointments.filter(appt => {
    if (appt.patient?.id !== patientId) return false;
    if (['cancelled', 'no-show'].includes(appt.status)) return false;

    const apptDate = new Date(appt.startTime);
    return apptDate >= dayStart && apptDate <= dayEnd;
  });

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
 */
export const validateAppointmentClient = (appointmentData, existingAppointments, locations = [], excludeAppointmentId = null) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    conflicts: []
  };

  const { patientId, therapistId, startTime, endTime, locationId, serviceType } = appointmentData;

  const startDateTime = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDateTime = typeof endTime === 'string' ? new Date(endTime) : endTime;

  // Basic validation
  if (!patientId && (!serviceType || serviceType === 'direct')) {
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

  if (!validation.isValid) {
    return validation;
  }

  // Check patient conflicts
  if (patientId) {
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
  }

  // Check therapist conflicts
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

    // Check travel time conflicts
    if (locationId) {
      const travelConflicts = checkTravelTimeConflicts(
        therapistId,
        startDateTime,
        endDateTime,
        locationId,
        locations,
        existingAppointments
      );

      if (travelConflicts.hasConflict) {
        validation.isValid = false;
        validation.errors.push(...travelConflicts.errors);
      }
      validation.warnings.push(...travelConflicts.warnings);
    }

    // Check lunch break requirements
    const lunchCheck = checkLunchBreaks(
      therapistId,
      startDateTime,
      endDateTime,
      serviceType,
      existingAppointments
    );

    if (lunchCheck.hasConflict) {
      validation.isValid = false;
      validation.errors.push(...lunchCheck.errors);
    }
    validation.warnings.push(...lunchCheck.warnings);

    // Check break time between sessions
    const breakCheck = checkBreakTimeConflicts(
      therapistId,
      startDateTime,
      endDateTime,
      serviceType,
      existingAppointments
    );

    validation.warnings.push(...breakCheck.warnings);
  }

  // Check daily limits
  if (patientId) {
    const sessionHours = durationMinutes / 60;
    const dailyLimitCheck = checkDailyLimits(
      patientId,
      startDateTime,
      sessionHours,
      existingAppointments
    );

    validation.warnings.push(...dailyLimitCheck.warnings);
  }

  return validation;
};

/**
 * Format conflict messages for display
 */
export const formatConflictMessages = (validation) => {
  const messages = {
    errors: [],
    warnings: [],
    hasBlockingErrors: validation.errors.length > 0,
    hasWarnings: validation.warnings.length > 0
  };

  validation.errors.forEach(error => {
    switch (error.type) {
      case 'patient_double_booking':
        messages.errors.push(`Patient conflict: ${error.message}`);
        break;
      case 'therapist_double_booking':
        messages.errors.push(`Therapist conflict: ${error.message}`);
        break;
      case 'insufficient_travel_time':
        messages.errors.push(`Travel time: ${error.message}`);
        break;
      case 'mandatory_lunch_missing':
        messages.errors.push(`Lunch required: ${error.message}`);
        break;
      case 'minimum_duration':
        messages.errors.push(`Duration: ${error.message}`);
        break;
      case 'invalid_time_range':
        messages.errors.push(`Time: ${error.message}`);
        break;
      default:
        messages.errors.push(`${error.message}`);
    }
  });

  validation.warnings.forEach(warning => {
    switch (warning.type) {
      case 'tight_scheduling':
        messages.warnings.push(`Tight schedule: ${warning.message}`);
        break;
      case 'tight_travel_time':
        messages.warnings.push(`Travel: ${warning.message}`);
        break;
      case 'missing_lunch_recommended':
        messages.warnings.push(`Lunch: ${warning.message}`);
        break;
      case 'unnecessary_lunch':
        messages.warnings.push(`Lunch: ${warning.message}`);
        break;
      case 'long_consecutive_block':
        messages.warnings.push(`Break needed: ${warning.message}`);
        break;
      case 'daily_limit_exceeded':
        messages.warnings.push(`Daily limit: ${warning.message}`);
        break;
      case 'approaching_daily_limit':
        messages.warnings.push(`Approaching limit: ${warning.message}`);
        break;
      default:
        messages.warnings.push(`${warning.message}`);
    }
  });

  return messages;
};
