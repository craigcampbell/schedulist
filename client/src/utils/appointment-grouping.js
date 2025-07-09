/**
 * Groups consecutive appointments for the same patient into blocks
 * @param {Array} appointments - Array of appointments sorted by start time
 * @returns {Array} Array of appointment groups
 */
export function groupConsecutiveAppointments(appointments) {
  if (!appointments || appointments.length === 0) return [];

  // Temporarily disable grouping to see individual appointments
  return appointments.map(appointment => ({
    id: `group-${appointment.id}`,
    patientId: appointment.patientId,
    patient: appointment.patient,
    therapistId: appointment.therapistId,
    therapist: appointment.therapist,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    serviceType: appointment.serviceType,
    location: appointment.location,
    appointments: [appointment],
    totalDuration: getDurationInMinutes(appointment.startTime, appointment.endTime),
    isGroup: false
  }));
}

/**
 * Get duration in minutes between two times
 */
function getDurationInMinutes(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / (1000 * 60);
}

/**
 * Check if an appointment group spans multiple time slots
 */
export function getSpannedTimeSlots(group, timeSlotMap) {
  const startTime = new Date(group.startTime);
  const endTime = new Date(group.endTime);
  
  const startHour = startTime.getHours() + (startTime.getMinutes() / 60);
  const endHour = endTime.getHours() + (endTime.getMinutes() / 60);
  
  const spannedSlots = [];
  
  Object.entries(timeSlotMap).forEach(([slot, [slotStart, slotEnd]]) => {
    // Check if this slot is within the appointment group's time range
    if (slotStart >= startHour && slotEnd <= endHour) {
      spannedSlots.push(slot);
    } else if (
      (startHour >= slotStart && startHour < slotEnd) || // Starts in this slot
      (endHour > slotStart && endHour <= slotEnd) || // Ends in this slot
      (startHour <= slotStart && endHour >= slotEnd) // Spans across this slot
    ) {
      spannedSlots.push(slot);
    }
  });
  
  return spannedSlots;
}

/**
 * Get the position of a group within a time slot (for partial overlaps)
 */
export function getGroupPositionInSlot(group, timeSlot, timeSlotMap) {
  const [slotStart, slotEnd] = timeSlotMap[timeSlot] || [];
  if (!slotStart || !slotEnd) return null;
  
  const groupStart = new Date(group.startTime);
  const groupEnd = new Date(group.endTime);
  
  const groupStartHour = groupStart.getHours() + (groupStart.getMinutes() / 60);
  const groupEndHour = groupEnd.getHours() + (groupEnd.getMinutes() / 60);
  
  // Calculate relative positions within the slot
  const isFirstSlot = groupStartHour >= slotStart && groupStartHour < slotEnd;
  const isLastSlot = groupEndHour > slotStart && groupEndHour <= slotEnd;
  const isMiddleSlot = groupStartHour <= slotStart && groupEndHour >= slotEnd;
  
  return {
    isFirstSlot,
    isLastSlot,
    isMiddleSlot,
    isOnlySlot: isFirstSlot && isLastSlot
  };
}