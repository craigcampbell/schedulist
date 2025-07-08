const { Appointment, TherapistAssignment } = require('../models');
const { Op } = require('sequelize');

/**
 * Enhanced conflict detection utility for preventing double-booking
 * 
 * This utility provides comprehensive validation to ensure no two therapists
 * can have the same timeslot scheduled for the same patient, and prevents
 * therapist double-booking across all appointments.
 */

/**
 * Check for patient-therapist double booking conflicts
 * Prevents multiple therapists being scheduled for the same patient at overlapping times
 * 
 * @param {string} patientId - Patient ID
 * @param {string} therapistId - Therapist ID (can be null for unassigned appointments)
 * @param {Date} startTime - Appointment start time
 * @param {Date} endTime - Appointment end time
 * @param {string} excludeAppointmentId - Appointment ID to exclude from conflict check (for updates)
 * @returns {Object} Conflict detection result
 */
const checkPatientTherapistConflicts = async (patientId, therapistId, startTime, endTime, excludeAppointmentId = null) => {
  const conflicts = {
    hasConflict: false,
    patientConflicts: [],
    therapistConflicts: [],
    errors: [],
    warnings: []
  };

  try {
    // Base where clause for time overlap
    const timeOverlapCondition = {
      [Op.or]: [
        // New appointment starts during existing appointment
        {
          startTime: {
            [Op.between]: [startTime, endTime]
          }
        },
        // New appointment ends during existing appointment
        {
          endTime: {
            [Op.between]: [startTime, endTime]
          }
        },
        // New appointment completely encompasses existing appointment
        {
          [Op.and]: [
            { startTime: { [Op.gte]: startTime } },
            { endTime: { [Op.lte]: endTime } }
          ]
        },
        // Existing appointment completely encompasses new appointment
        {
          [Op.and]: [
            { startTime: { [Op.lte]: startTime } },
            { endTime: { [Op.gte]: endTime } }
          ]
        }
      ]
    };

    // Check for patient conflicts - same patient with any therapist at overlapping time
    const patientConflictQuery = {
      patientId,
      ...timeOverlapCondition,
      status: { [Op.notIn]: ['cancelled', 'no-show'] } // Exclude cancelled appointments
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

    // Check for therapist conflicts - same therapist with any patient at overlapping time
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
        startTime.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        startTime.toTimeString().slice(0, 8), // Convert to HH:MM:SS format
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

    // Additional validation rules
    await addBusinessRuleValidation(conflicts, patientId, therapistId, startTime, endTime);

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
 * Add business rule validation (extensible for future rules)
 */
const addBusinessRuleValidation = async (conflicts, patientId, therapistId, startTime, endTime) => {
  // Rule: Minimum gap between appointments for same therapist (15 minutes)
  if (therapistId) {
    const bufferMinutes = 15;
    const bufferStartTime = new Date(startTime.getTime() - bufferMinutes * 60000);
    const bufferEndTime = new Date(endTime.getTime() + bufferMinutes * 60000);

    const nearbyAppointments = await Appointment.findAll({
      where: {
        therapistId,
        [Op.or]: [
          {
            endTime: {
              [Op.between]: [bufferStartTime, startTime]
            }
          },
          {
            startTime: {
              [Op.between]: [endTime, bufferEndTime]
            }
          }
        ],
        status: { [Op.notIn]: ['cancelled', 'no-show'] }
      }
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
  }

  // Rule: Check for patient's daily session limits
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const dailyAppointments = await Appointment.findAll({
    where: {
      patientId,
      startTime: {
        [Op.between]: [dayStart, dayEnd]
      },
      status: { [Op.notIn]: ['cancelled', 'no-show'] }
    }
  });

  const dailyHours = dailyAppointments.reduce((total, appt) => {
    return total + (appt.endTime - appt.startTime) / (1000 * 60 * 60);
  }, 0);

  const newSessionHours = (endTime - startTime) / (1000 * 60 * 60);
  const totalDailyHours = dailyHours + newSessionHours;

  if (totalDailyHours > 8) {
    conflicts.warnings.push({
      type: 'daily_limit_exceeded',
      message: `Patient will have ${totalDailyHours.toFixed(1)} hours scheduled for this day (limit: 8 hours)`,
      details: { currentHours: dailyHours, newSessionHours, totalHours: totalDailyHours }
    });
  }
};

/**
 * Validate appointment creation/update
 * 
 * @param {Object} appointmentData - Appointment data
 * @param {string} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Validation result
 */
const validateAppointment = async (appointmentData, excludeAppointmentId = null) => {
  const { patientId, therapistId, startTime, endTime } = appointmentData;
  
  // Convert string dates to Date objects if needed
  const startDateTime = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDateTime = typeof endTime === 'string' ? new Date(endTime) : endTime;

  const validation = {
    isValid: true,
    conflicts: [],
    errors: [],
    warnings: []
  };

  // Basic validation
  if (!patientId) {
    validation.isValid = false;
    validation.errors.push({ type: 'missing_patient', message: 'Patient ID is required' });
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

  // Check for conflicts
  const conflictResult = await checkPatientTherapistConflicts(
    patientId, 
    therapistId, 
    startDateTime, 
    endDateTime, 
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
  validateAppointment
};