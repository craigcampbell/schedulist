import { format, addMinutes, parseISO } from 'date-fns';

// Standard lunch time slots (11:00 AM - 1:30 PM)
const LUNCH_TIME_SLOTS = [
  "11:00-11:30", "11:30-12:00", "12:00-12:30", "12:30-1:00", "1:00-1:30"
];

// Convert time string to minutes for comparison
const parseTimeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if appointment overlaps with time slot
const isAppointmentInTimeSlot = (appointment, timeSlot) => {
  const [slotStart, slotEnd] = timeSlot.split('-');
  const slotStartTime = parseTimeToMinutes(slotStart);
  const slotEndTime = parseTimeToMinutes(slotEnd);
  
  const appStart = new Date(appointment.startTime);
  const appEnd = new Date(appointment.endTime);
  
  const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
  const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
  
  return (
    (appStartMinutes >= slotStartTime && appStartMinutes < slotEndTime) ||
    (appEndMinutes > slotStartTime && appEndMinutes <= slotEndTime) ||
    (appStartMinutes <= slotStartTime && appEndMinutes >= slotEndTime)
  );
};

/**
 * Validate therapist schedule and identify lunch break issues
 */
export const validateTherapistLunchBreak = (therapistId, appointments, selectedDate) => {
  const therapistApps = appointments.filter(app => 
    app.therapistId === therapistId && 
    app.startTime && 
    format(new Date(app.startTime), 'yyyy-MM-dd') === format(new Date(selectedDate), 'yyyy-MM-dd')
  );

  const validation = {
    hasLunch: false,
    lunchSlot: null,
    needsLunch: false,
    workingHours: 0,
    busyLunchSlots: [],
    availableLunchSlots: [],
    warnings: []
  };

  // Check if therapist has lunch scheduled
  const lunchAppointment = therapistApps.find(app => app.serviceType === 'lunch');
  if (lunchAppointment) {
    validation.hasLunch = true;
    validation.lunchSlot = {
      startTime: lunchAppointment.startTime,
      endTime: lunchAppointment.endTime
    };
  }

  // Calculate working hours (excluding lunch and indirect time)
  validation.workingHours = therapistApps
    .filter(app => app.serviceType === 'direct')
    .reduce((total, app) => {
      const duration = (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60 * 60);
      return total + duration;
    }, 0);

  // Check if therapist needs lunch (working >4 hours)
  validation.needsLunch = validation.workingHours >= 4;

  // Find busy and available lunch slots
  LUNCH_TIME_SLOTS.forEach(slot => {
    const isBusy = therapistApps.some(app => isAppointmentInTimeSlot(app, slot));
    if (isBusy) {
      validation.busyLunchSlots.push(slot);
    } else {
      validation.availableLunchSlots.push(slot);
    }
  });

  // Generate warnings
  if (validation.needsLunch && !validation.hasLunch) {
    if (validation.availableLunchSlots.length > 0) {
      validation.warnings.push({
        type: 'missing_lunch_can_schedule',
        message: `Missing lunch break. ${validation.availableLunchSlots.length} slots available.`,
        severity: 'warning',
        suggestedSlots: validation.availableLunchSlots
      });
    } else {
      validation.warnings.push({
        type: 'missing_lunch_no_slots',
        message: 'Missing lunch break. No available lunch slots.',
        severity: 'error'
      });
    }
  }

  if (validation.hasLunch && !validation.needsLunch) {
    validation.warnings.push({
      type: 'unnecessary_lunch',
      message: 'Lunch scheduled but working <4 hours.',
      severity: 'info'
    });
  }

  return validation;
};

/**
 * Suggest optimal lunch slot for a therapist
 */
export const suggestLunchSlot = (therapistId, appointments, selectedDate, teamMembers = []) => {
  const validation = validateTherapistLunchBreak(therapistId, appointments, selectedDate);
  
  if (!validation.needsLunch || validation.hasLunch) {
    return null;
  }

  if (validation.availableLunchSlots.length === 0) {
    return null;
  }

  // Score each available slot based on:
  // 1. Optimal lunch time (12:00-1:00 PM preferred)
  // 2. Team lunch coverage (don't leave patients uncovered)
  // 3. Break between sessions
  
  const scoredSlots = validation.availableLunchSlots.map(slot => {
    let score = 0;
    
    // Prefer 12:00-12:30 and 12:30-1:00 slots
    if (slot === '12:00-12:30' || slot === '12:30-1:00') {
      score += 10;
    } else if (slot === '11:30-12:00' || slot === '1:00-1:30') {
      score += 5;
    }
    
    // Check if this creates a good break between sessions
    const [slotStart] = slot.split('-');
    const slotStartMinutes = parseTimeToMinutes(slotStart);
    
    const therapistApps = appointments.filter(app => 
      app.therapistId === therapistId && 
      format(new Date(app.startTime), 'yyyy-MM-dd') === format(new Date(selectedDate), 'yyyy-MM-dd')
    ).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    // Find sessions before and after this slot
    let sessionBefore = null;
    let sessionAfter = null;
    
    for (const app of therapistApps) {
      const appStartMinutes = new Date(app.startTime).getHours() * 60 + new Date(app.startTime).getMinutes();
      const appEndMinutes = new Date(app.endTime).getHours() * 60 + new Date(app.endTime).getMinutes();
      
      if (appEndMinutes <= slotStartMinutes) {
        sessionBefore = app;
      } else if (appStartMinutes >= slotStartMinutes + 30) {
        if (!sessionAfter) sessionAfter = app;
      }
    }
    
    // Bonus if this creates a natural break
    if (sessionBefore && sessionAfter) {
      score += 15;
    } else if (sessionBefore || sessionAfter) {
      score += 8;
    }
    
    // Check team coverage - avoid leaving too many therapists at lunch
    if (teamMembers.length > 0) {
      const teamLunchCount = teamMembers.filter(member => {
        if (member.id === therapistId) return false;
        const memberValidation = validateTherapistLunchBreak(member.id, appointments, selectedDate);
        return memberValidation.hasLunch && 
               memberValidation.lunchSlot &&
               isTimeSlotsOverlapping(slot, formatTimeSlot(memberValidation.lunchSlot));
      }).length;
      
      // Penalty if too many team members already at lunch
      if (teamLunchCount >= Math.floor(teamMembers.length / 2)) {
        score -= 20;
      }
    }
    
    return { slot, score };
  });
  
  // Return the highest scoring slot
  scoredSlots.sort((a, b) => b.score - a.score);
  return scoredSlots[0]?.slot || null;
};

/**
 * Auto-schedule lunch breaks for all therapists needing them
 */
export const autoScheduleLunchBreaks = (appointments, therapists, selectedDate) => {
  const lunchSchedules = [];
  const errors = [];
  
  // Group therapists by teams
  const teamGroups = {};
  therapists.forEach(therapist => {
    const teamId = therapist.teamId || 'unassigned';
    if (!teamGroups[teamId]) {
      teamGroups[teamId] = [];
    }
    teamGroups[teamId].push(therapist);
  });
  
  // Schedule lunch for each team
  Object.values(teamGroups).forEach(teamMembers => {
    teamMembers.forEach(therapist => {
      const validation = validateTherapistLunchBreak(therapist.id, appointments, selectedDate);
      
      if (validation.needsLunch && !validation.hasLunch) {
        const suggestedSlot = suggestLunchSlot(therapist.id, appointments, selectedDate, teamMembers);
        
        if (suggestedSlot) {
          const [startTime, endTime] = suggestedSlot.split('-');
          const lunchStart = new Date(selectedDate);
          const [startHour, startMin] = startTime.split(':').map(Number);
          lunchStart.setHours(startHour, startMin, 0, 0);
          
          const lunchEnd = new Date(selectedDate);
          const [endHour, endMin] = endTime.split(':').map(Number);
          lunchEnd.setHours(endHour, endMin, 0, 0);
          
          lunchSchedules.push({
            therapistId: therapist.id,
            therapistName: `${therapist.firstName} ${therapist.lastName}`,
            startTime: lunchStart.toISOString(),
            endTime: lunchEnd.toISOString(),
            serviceType: 'lunch',
            slot: suggestedSlot
          });
        } else {
          errors.push({
            therapistId: therapist.id,
            therapistName: `${therapist.firstName} ${therapist.lastName}`,
            error: 'No available lunch slots'
          });
        }
      }
    });
  });
  
  return { lunchSchedules, errors };
};

/**
 * Validate entire team lunch coverage
 */
export const validateTeamLunchCoverage = (teamMembers, appointments, selectedDate) => {
  const coverage = {
    totalTherapists: teamMembers.length,
    therapistsNeedingLunch: 0,
    therapistsWithLunch: 0,
    simultaenousLunchSlots: {},
    warnings: []
  };
  
  teamMembers.forEach(member => {
    const validation = validateTherapistLunchBreak(member.id, appointments, selectedDate);
    
    if (validation.needsLunch) {
      coverage.therapistsNeedingLunch++;
      
      if (validation.hasLunch) {
        coverage.therapistsWithLunch++;
        
        // Track simultaneous lunch breaks
        const lunchSlot = formatTimeSlot(validation.lunchSlot);
        if (!coverage.simultaenousLunchSlots[lunchSlot]) {
          coverage.simultaenousLunchSlots[lunchSlot] = [];
        }
        coverage.simultaenousLunchSlots[lunchSlot].push({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`
        });
      }
    }
  });
  
  // Check for too many simultaneous lunch breaks
  Object.entries(coverage.simultaenousLunchSlots).forEach(([slot, therapists]) => {
    if (therapists.length >= Math.ceil(coverage.totalTherapists / 2)) {
      coverage.warnings.push({
        type: 'excessive_simultaneous_lunch',
        message: `${therapists.length} therapists at lunch during ${slot}. May impact coverage.`,
        severity: 'warning',
        slot,
        therapists
      });
    }
  });
  
  return coverage;
};

// Helper functions
const isTimeSlotsOverlapping = (slot1, slot2) => {
  const [start1, end1] = slot1.split('-').map(parseTimeToMinutes);
  const [start2, end2] = slot2.split('-').map(parseTimeToMinutes);
  
  return (start1 < end2 && end1 > start2);
};

const formatTimeSlot = (timeRange) => {
  const start = format(new Date(timeRange.startTime), 'H:mm');
  const end = format(new Date(timeRange.endTime), 'H:mm');
  return `${start}-${end}`;
};

/**
 * Generate lunch appointment data for API creation
 */
export const createLunchAppointmentData = (lunchSchedule, bcbaId, locationId) => {
  return {
    therapistId: lunchSchedule.therapistId,
    bcbaId: bcbaId,
    locationId: locationId,
    startTime: lunchSchedule.startTime,
    endTime: lunchSchedule.endTime,
    serviceType: 'lunch',
    title: 'Lunch Break',
    notes: 'Auto-scheduled lunch break',
    patientId: null // No patient for lunch breaks
  };
};