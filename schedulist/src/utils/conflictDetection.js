const { Appointment, TherapistAssignment, Location } = require('../models');
const { Op } = require('sequelize');

/**
 * Enhanced conflict detection utility for preventing double-booking and
 * enforcing scheduling rules including travel time, lunch breaks,
 * break time between sessions, and location-based constraints.
 */

/**
 * Check for patient-therapist double booking conflicts
 */
const checkPatientTherapistConflicts = async (patientId, therapistId, startTime, endTime, locationId, serviceType, excludeAppointmentId = null) => {
  const conflicts = {
    hasConflict: false,
    patientConflicts: [],
    therapistConflicts: [],
    errors: [],
    warnings: []
  };

  try {
    const timeOverlapCondition = {
      [Op.or]: [
        { startTime: { [Op.between]: [startTime, endTime] } },
        { endTime: { [Op.between]: [startTime, endTime] } },
        { [Op.and]: [{ startTime: { [Op.gte]: startTime } }, { endTime: { [Op.lte]: endTime } }] },
        { [Op.and]: [{ startTime: { [Op.lte]: startTime } }, { endTime: { [Op.gte]: endTime } }] }
      ]
    };

    // Check for patient conflicts
    if (patientId) {
      const patientConflictQuery = {
        patientId,
        ...timeOverlapCondition,
        status: { [Op.notIn]: ['cancelled', 'no-show'] }
      };

      if (excludeAppointmentId) {
        patientConflictQuery.id = { [Op.ne]: excludeAppointmentId };
      }

      const patientConflictingAppointments = await Appointment.findAll({
        where: patientConflictQuery,
        include: [
          {
            model: require('../models').User,
            as: 'Therapist',
            attributes: ['id', 'firstName', 'lastName']
          }
        ]
      });

      if (patientConflictingAppointments.length > 0) {
        conflicts.hasConflict = true;
        conflicts.patientConflicts = patientConflictingAppointments.map(appt => ({
          appointmentId: appt.id,
          therapistId: appt.therapistId,
          therapistName: appt.Therapist ? `${appt.Therapist.firstName} ${appt.Therapist.lastName}` : 'Unassigned',
          startTime: appt.startTime,
          endTime: appt.endTime,
          conflictType: 'patient_double_booking'
        }));

        conflicts.errors.push({
          type: 'patient_double_booking',
          message: `Patient already has an appointment scheduled during this time period`,
          details: conflicts.patientConflicts
        });
      }
    }

    // Check for therapist conflicts
    if (therapistId) {
      const therapistConflictQuery = {
        therapistId,
        ...timeOverlapCondition,
        status: { [Op.notIn]: ['cancelled', 'no-show'] }
      };

      if (excludeAppointmentId) {
        therapistConflictQuery.id = { [Op.ne]: excludeAppointmentId };
      }

      const therapistConflictingAppointments = await Appointment.findAll({
        where: therapistConflictQuery,
        include: [
          {
            model: require('../models').Patient,
            attributes: ['id', 'firstName', 'lastName']
          }
        ]
      });

      if (therapistConflictingAppointments.length > 0) {
        conflicts.hasConflict = true;
        conflicts.therapistConflicts = therapistConflictingAppointments.map(appt => ({
          appointmentId: appt.id,
          patientId: appt.patientId,
          patientName: appt.Patient ? `${appt.Patient.firstName} ${appt.Patient.lastName}` : 'Unknown',
          startTime: appt.startTime,
          endTime: appt.endTime,
          conflictType: 'therapist_double_booking'
        }));

        conflicts.errors.push({
          type: 'therapist_double_booking',
          message: `Therapist already has an appointment scheduled during this time period`,
          details: conflicts.therapistConflicts
        });
      }

      // Also check TherapistAssignment table for more granular conflicts
      const assignmentConflicts = await TherapistAssignment.findConflicts(
        therapistId,
        startTime.toISOString().split('T')[0],
        startTime.toTimeString().slice(0, 8),
        endTime.toTimeString().slice(0, 8),
        excludeAppointmentId
      );

      if (assignmentConflicts.length > 0) {
        conflicts.hasConflict = true;
        conflicts.therapistConflicts.push(...assignmentConflicts.map(assignment => ({
          assignmentId: assignment.id,
          patientId: assignment.patientId,
          startTime: assignment.getStartDateTime(),
          endTime: assignment.getEndDateTime(),
          conflictType: 'therapist_assignment_conflict'
        })));

        conflicts.errors.push({
          type: 'therapist_assignment_conflict',
          message: `Therapist has conflicting assignments during this time period`,
          details: assignmentConflicts
        });
      }
    }

    // Additional validation rules (travel time, lunch, breaks, location)
    await addBusinessRuleValidation(conflicts, patientId, therapistId, startTime, endTime, locationId, serviceType, excludeAppointmentId);

  } catch (error) {
    conflicts.hasConflict = true;
    conflicts.errors.push({
      type: 'validation_error',
      message: 'Error checking for conflicts',
      details: error.message
    });
  }

  return conflicts;
};

/**
 * Add business rule validation including travel time, lunch, breaks, and location constraints
 */
const addBusinessRuleValidation = async (conflicts, patientId, therapistId, startTime, endTime, locationId, serviceType, excludeAppointmentId = null) => {
  if (!therapistId) return;

  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch all therapist's appointments for the day (sorted by start time)
  const therapistsDayApps = await Appointment.findAll({
    where: {
      therapistId,
      startTime: { [Op.between]: [dayStart, dayEnd] },
      status: { [Op.notIn]: ['cancelled', 'no-show'] }
    },
    include: [
      { model: Location, attributes: ['id', 'name', 'locationType', 'address'] },
      { model: require('../models').Patient, attributes: ['id', 'firstName', 'lastName'] }
    ],
    order: [['startTime', 'ASC']]
  });

  // Exclude the appointment being edited
  const existingApps = excludeAppointmentId
    ? therapistsDayApps.filter(app => app.id !== excludeAppointmentId)
    : therapistsDayApps;

  // Sort apps by start time
  existingApps.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  // ============================================
  // RULE 1: Travel time between appointments at different locations
  // ============================================
  if (locationId) {
    const newLocation = await Location.findByPk(locationId, { attributes: ['id', 'name', 'locationType', 'address'] });

    if (newLocation) {
      // Check previous appointment (ends before this one starts)
      const prevApp = existingApps
        .filter(app => new Date(app.endTime) <= startTime)
        .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))[0];

      if (prevApp && prevApp.Location) {
        const prevLocation = prevApp.Location;
        const gapToPrev = (startTime - new Date(prevApp.endTime)) / (1000 * 60);

        // Calculate required travel time based on location types
        const requiredTravelTime = calculateRequiredTravelTime(prevLocation, newLocation);

        if (requiredTravelTime > 0 && gapToPrev < requiredTravelTime) {
          const prevLocationType = prevLocation.locationType || 'clinic';

          conflicts.warnings.push({
            type: 'insufficient_travel_time',
            message: `Only ${Math.round(gapToPrev)} min between ${prevLocationType} location "${prevLocation.name}" and ${newLocation.locationType || 'clinic'} location "${newLocation.name}". Need ${requiredTravelTime} min for travel.`,
            details: {
              previousLocation: prevLocation.name,
              previousLocationType: prevLocationType,
              newLocation: newLocation.name,
              newLocationType: newLocation.locationType || 'clinic',
              gapMinutes: Math.round(gapToPrev),
              requiredTravelMinutes: requiredTravelTime
            }
          });

          // Travel time conflict is a warning (not blocking) for now - can be escalated
          conflicts.hasConflict = true;
          conflicts.errors.push({
            type: 'insufficient_travel_time',
            message: `Insufficient travel time: need ${requiredTravelTime} min between "${prevLocation.name}" and "${newLocation.name}" but only ${Math.round(gapToPrev)} min available.`
          });
        } else if (requiredTravelTime > 0 && gapToPrev < requiredTravelTime + 15) {
          const prevLocationType = prevLocation.locationType || 'clinic';
          conflicts.warnings.push({
            type: 'tight_travel_time',
            message: `Tight travel schedule: ${Math.round(gapToPrev)} min for travel from ${prevLocationType} "${prevLocation.name}" to "${newLocation.name}". Consider adding buffer.`
          });
        }
      }

      // Check next appointment (starts after this one ends)
      const nextApp = existingApps
        .filter(app => new Date(app.startTime) >= endTime)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

      if (nextApp && nextApp.Location) {
        const nextLocation = nextApp.Location;
        const gapToNext = (new Date(nextApp.startTime) - endTime) / (1000 * 60);
        const requiredTravelTime = calculateRequiredTravelTime(newLocation, nextLocation);

        if (requiredTravelTime > 0 && gapToNext < requiredTravelTime) {
          const nextLocationType = nextLocation.locationType || 'clinic';
          conflicts.warnings.push({
            type: 'insufficient_travel_time',
            message: `Only ${Math.round(gapToNext)} min to travel from ${newLocation.locationType || 'clinic'} "${newLocation.name}" to ${nextLocationType} "${nextLocation.name}" after this appointment. Need ${requiredTravelTime} min.`
          });
        }
      }
    }
  }

  // ============================================
  // RULE 2: Minimum break time between sessions (15 minutes)
  // ============================================
  const bufferMinutes = 15;
  const bufferStartTime = new Date(startTime.getTime() - bufferMinutes * 60000);
  const bufferEndTime = new Date(endTime.getTime() + bufferMinutes * 60000);

  const nearbyAppointments = existingApps.filter(app => {
    const appEnd = new Date(app.endTime);
    const appStart = new Date(app.startTime);
    return (appEnd > bufferStartTime && appEnd <= startTime) ||
           (appStart >= endTime && appStart < bufferEndTime);
  });

  if (nearbyAppointments.length > 0) {
    conflicts.warnings.push({
      type: 'tight_scheduling',
      message: `Therapist has appointments within ${bufferMinutes} minutes of this time slot`,
      details: nearbyAppointments.map(appt => ({
        appointmentId: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime
      }))
    });
  }

  // ============================================
  // RULE 3: Lunch break validation
  // ============================================
  // Check if this is a non-lunch service for a therapist who needs lunch
  if (serviceType && serviceType !== 'lunch') {
    const newSessionHours = (endTime - startTime) / (1000 * 60 * 60);

    // Calculate total direct service hours for the day
    const directServiceHours = existingApps
      .filter(app => app.serviceType === 'direct' || app.serviceType === 'supervision')
      .reduce((total, app) => {
        return total + (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60 * 60);
      }, 0);

    const totalDirectHours = directServiceHours + newSessionHours;

    // Check if therapist has a lunch scheduled
    const hasLunch = existingApps.some(app => app.serviceType === 'lunch');

    if (totalDirectHours >= 4 && !hasLunch) {
      // Find available lunch window (11:00 AM - 1:30 PM)
      const lunchWindowStart = new Date(startTime);
      lunchWindowStart.setHours(11, 0, 0, 0);
      const lunchWindowEnd = new Date(startTime);
      lunchWindowEnd.setHours(13, 30, 0, 0);

      // Check if any available gap exists in the lunch window
      const appointmentsInLunchWindow = [...existingApps].filter(app => {
        const appStart = new Date(app.startTime);
        const appEnd = new Date(app.endTime);
        return appStart < lunchWindowEnd && appEnd > lunchWindowStart;
      });

      // Also consider this new appointment
      if (startTime < lunchWindowEnd && endTime > lunchWindowStart) {
        appointmentsInLunchWindow.push({ startTime, endTime });
      }

      appointmentsInLunchWindow.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // Find gaps in the lunch window
      let hasGap = false;
      let currentTime = lunchWindowStart;

      for (const app of appointmentsInLunchWindow) {
        const appStart = new Date(app.startTime);
        if (appStart > currentTime && (appStart - currentTime) >= 30 * 60000) {
          hasGap = true;
          break;
        }
        const appEnd = new Date(app.endTime);
        if (appEnd > currentTime) {
          currentTime = appEnd;
        }
      }
      if (lunchWindowEnd > currentTime && (lunchWindowEnd - currentTime) >= 30 * 60000) {
        hasGap = true;
      }

      if (hasGap) {
        conflicts.warnings.push({
          type: 'missing_lunch_can_schedule',
          message: `Therapist will have ${totalDirectHours.toFixed(1)} hours of direct service but no lunch break scheduled. Free lunch window slots available.`,
          severity: 'warning'
        });
      } else {
        conflicts.warnings.push({
          type: 'missing_lunch_no_slots',
          message: `Therapist will have ${totalDirectHours.toFixed(1)} hours of direct service but no lunch break scheduled AND no available lunch window slots.`,
          severity: 'error'
        });
      }
    }

    if (totalDirectHours >= 6 && !hasLunch) {
      conflicts.hasConflict = true;
      conflicts.errors.push({
        type: 'mandatory_lunch_missing',
        message: `Therapist requires a lunch break when scheduled for ${totalDirectHours.toFixed(1)}+ hours of direct service. Please schedule a lunch break.`
      });
    }

    if (hasLunch && totalDirectHours < 4) {
      conflicts.warnings.push({
        type: 'unnecessary_lunch',
        message: `Lunch break scheduled but therapist only has ${totalDirectHours.toFixed(1)} hours of direct service (< 4 hours minimum).`,
        severity: 'info'
      });
    }
  }

  // ============================================
  // RULE 4: Maximum consecutive session hours without a break
  // ============================================
  if (serviceType && serviceType !== 'lunch' && serviceType !== 'cleaning') {
    const sortedDayWithNew = [...existingApps
      .filter(app => app.serviceType !== 'lunch' && app.serviceType !== 'cleaning')
    ];

    // Insert the new appointment in sorted order
    let insertIdx = sortedDayWithNew.findIndex(a => new Date(a.startTime) > startTime);
    if (insertIdx === -1) insertIdx = sortedDayWithNew.length;

    // Find consecutive block that includes this new appointment
    const blockAppointments = [];
    let blockStart = startTime;
    let blockEnd = endTime;

    // Look backwards
    for (let i = sortedDayWithNew.length - 1; i >= 0; i--) {
      const app = sortedDayWithNew[i];
      const appEnd = new Date(app.endTime);
      const gap = (startTime - appEnd) / (1000 * 60);
      if (gap >= 0 && gap <= 30) {
        blockStart = new Date(Math.min(blockStart, new Date(app.startTime)));
        blockAppointments.push(app);
      } else if (appEnd <= startTime) {
        break;
      }
    }

    // Look forwards
    for (let i = 0; i < sortedDayWithNew.length; i++) {
      const app = sortedDayWithNew[i];
      const appStart = new Date(app.startTime);
      const gap = (appStart - endTime) / (1000 * 60);
      if (gap >= 0 && gap <= 30) {
        blockEnd = new Date(Math.max(blockEnd, new Date(app.endTime)));
        if (!blockAppointments.includes(app)) blockAppointments.push(app);
      } else if (appStart >= endTime) {
        break;
      }
    }

    const consecutiveHours = (blockEnd - blockStart) / (1000 * 60 * 60);

    if (consecutiveHours > 5) {
      conflicts.warnings.push({
        type: 'long_consecutive_block',
        message: `Therapist will have ${consecutiveHours.toFixed(1)} consecutive hours without a break. Consider adding a break or lunch.`
      });
    }
  }

  // ============================================
  // RULE 5: Daily session limits for patient
  // ============================================
  if (patientId) {
    const dailyAppointments = await Appointment.findAll({
      where: {
        patientId,
        startTime: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.notIn]: ['cancelled', 'no-show'] }
      }
    });

    const existingDailyHours = dailyAppointments
      .filter(a => a.id !== excludeAppointmentId)
      .reduce((total, appt) => {
        return total + (new Date(appt.endTime) - new Date(appt.startTime)) / (1000 * 60 * 60);
      }, 0);

    const newSessionHours = (endTime - startTime) / (1000 * 60 * 60);
    const totalDailyHours = existingDailyHours + newSessionHours;

    if (totalDailyHours > 8) {
      conflicts.warnings.push({
        type: 'daily_limit_exceeded',
        message: `Patient will have ${totalDailyHours.toFixed(1)} hours scheduled for this day (limit: 8 hours)`,
        details: { currentHours: existingDailyHours, newSessionHours, totalHours: totalDailyHours }
      });
    } else if (totalDailyHours > 6.4) {
      conflicts.warnings.push({
        type: 'approaching_daily_limit',
        message: `Patient approaching daily limit: ${totalDailyHours.toFixed(1)} hours scheduled (80% of 8 hour limit)`
      });
    }
  }
};

/**
 * Calculate required travel time between two locations based on their types.
 *
 * Location types:
 *   - 'clinic': In-clinic location
 *   - 'home': Patient's home / remote location
 *   - 'school': School-based location
 *
 * Travel time estimates:
 *   - clinic <-> clinic (same location): 0 min
 *   - clinic <-> clinic (different): 15 min
 *   - clinic <-> home: 30 min
 *   - clinic <-> school: 25 min
 *   - home <-> home: 30 min (between different homes)
 *   - home <-> school: 25 min
 *   - school <-> school: 20 min
 */
const calculateRequiredTravelTime = (fromLocation, toLocation) => {
  if (!fromLocation || !toLocation) return 0;

  // Same location - no travel needed
  if (fromLocation.id === toLocation.id) return 0;

  const fromType = fromLocation.locationType || 'clinic';
  const toType = toLocation.locationType || 'clinic';

  // Same type, different locations
  if (fromType === toType) {
    if (fromType === 'clinic') return 15;
    if (fromType === 'home') return 30;
    if (fromType === 'school') return 20;
    return 15;
  }

  // Cross-type travel
  if (fromType === 'clinic' && toType === 'home') return 30;
  if (fromType === 'home' && toType === 'clinic') return 30;
  if (fromType === 'clinic' && toType === 'school') return 25;
  if (fromType === 'school' && toType === 'clinic') return 25;
  if (fromType === 'home' && toType === 'school') return 25;
  if (fromType === 'school' && toType === 'home') return 25;

  return 30; // Default for unknown combinations
};

/**
 * Validate appointment creation/update
 *
 * @param {Object} appointmentData - Appointment data with optional locationId and serviceType
 * @param {string} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Validation result
 */
const validateAppointment = async (appointmentData, excludeAppointmentId = null) => {
  const { patientId, therapistId, startTime, endTime, locationId, serviceType } = appointmentData;

  const startDateTime = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDateTime = typeof endTime === 'string' ? new Date(endTime) : endTime;

  const validation = {
    isValid: true,
    conflicts: [],
    errors: [],
    warnings: []
  };

  // Basic validation
  if (!patientId && !serviceType) {
    validation.isValid = false;
    validation.errors.push({ type: 'missing_patient', message: 'Patient ID is required for direct services' });
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

  // Check for conflicts with enhanced rules
  const conflictResult = await checkPatientTherapistConflicts(
    patientId,
    therapistId || null,
    startDateTime,
    endDateTime,
    locationId || null,
    serviceType || null,
    excludeAppointmentId
  );

  if (conflictResult.hasConflict) {
    validation.isValid = false;
    validation.conflicts = conflictResult;
    validation.errors.push(...conflictResult.errors);
  }

  validation.warnings.push(...conflictResult.warnings);

  return validation;
};

module.exports = {
  checkPatientTherapistConflicts,
  validateAppointment,
  calculateRequiredTravelTime
};
