/**
 * Utility functions for generating time slots based on location working hours
 */

/**
 * Convert time string (HH:MM) to minutes since midnight
 * @param {string} timeString - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
export const timeStringToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:MM)
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
export const minutesToTimeString = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 * @param {string} time24 - Time in HH:MM format (24-hour)
 * @returns {string} Time in 12-hour format with AM/PM
 */
export const formatTime12Hour = (time24) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Generate time slots for a location based on working hours
 * @param {Object} location - Location object with workingHoursStart and workingHoursEnd
 * @param {number} slotDuration - Duration of each slot in minutes (default: 30)
 * @param {string} format - Format type: 'excel' (7:30 AM), 'range' (7:30-8:00 AM), or 'simple' (7:30-8:00)
 * @returns {Array} Array of time slot strings in the specified format
 */
export const generateTimeSlots = (location, slotDuration = 30, format = 'excel') => {
  if (!location || !location.workingHoursStart || !location.workingHoursEnd) {
    // Fallback to default times if location data is missing
    return generateDefaultTimeSlots(format);
  }

  const startMinutes = timeStringToMinutes(location.workingHoursStart);
  const endMinutes = timeStringToMinutes(location.workingHoursEnd);
  const slots = [];

  for (let time = startMinutes; time < endMinutes; time += slotDuration) {
    const timeString = minutesToTimeString(time);
    const nextTime = minutesToTimeString(time + slotDuration);
    
    switch (format) {
      case 'excel':
        slots.push(formatTime12Hour(timeString));
        break;
      case 'range':
        slots.push(`${formatTime12Hour(timeString).replace(' AM', '').replace(' PM', '')}-${formatTime12Hour(nextTime).replace(' AM', '').replace(' PM', '')} ${formatTime12Hour(timeString).includes('PM') ? 'PM' : 'AM'}`);
        break;
      case 'simple':
        slots.push(`${timeString}-${nextTime}`);
        break;
      default:
        slots.push(formatTime12Hour(timeString));
    }
  }

  return slots;
};

/**
 * Generate default time slots for backward compatibility
 * @param {string} format - Format type: 'excel', 'range', or 'simple'
 * @returns {Array} Array of default time slot strings
 */
export const generateDefaultTimeSlots = (format = 'excel') => {
  const defaultSlots = [
    "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", 
    "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", 
    "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", 
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", 
    "5:30 PM"
  ];

  switch (format) {
    case 'range':
      return [
        "7:30-8:00 AM", "8:00-8:30 AM", "8:30-9:00 AM", "9:00-9:30 AM", "9:30-10:00 AM",
        "10:00-10:30 AM", "10:30-11:00 AM", "11:00-11:30 AM", "11:30-12:00 PM", "12:00-12:30 PM",
        "12:30-1:00 PM", "1:00-1:30 PM", "1:30-2:00 PM", "2:00-2:30 PM", "2:30-3:00 PM",
        "3:00-3:30 PM", "3:30-4:00 PM", "4:00-4:30 PM", "4:30-5:00 PM", "5:00-5:30 PM"
      ];
    case 'simple':
      return [
        "7:30-8:00", "8:00-8:30", "8:30-9:00", "9:00-9:30", "9:30-10:00",
        "10:00-10:30", "10:30-11:00", "11:00-11:30", "11:30-12:00", "12:00-12:30",
        "12:30-13:00", "13:00-13:30", "13:30-14:00", "14:00-14:30", "14:30-15:00",
        "15:00-15:30", "15:30-16:00", "16:00-16:30", "16:30-17:00", "17:00-17:30"
      ];
    default:
      return defaultSlots;
  }
};

/**
 * Generate time slot ranges for time calculations
 * @param {Array} timeSlots - Array of time slot strings
 * @param {string} format - Format type: 'excel', 'range', or 'simple'
 * @returns {Object} Object mapping time slots to their minute ranges
 */
export const generateTimeSlotRanges = (timeSlots, format = 'excel') => {
  const ranges = {};
  
  timeSlots.forEach((slot, index) => {
    const nextSlot = timeSlots[index + 1];
    
    let currentMinutes, endMinutes;
    
    switch (format) {
      case 'excel':
        // Format: "7:30 AM"
        const currentTime24 = convert12HourTo24Hour(slot);
        currentMinutes = timeStringToMinutes(currentTime24);
        if (nextSlot) {
          const nextTime24 = convert12HourTo24Hour(nextSlot);
          endMinutes = timeStringToMinutes(nextTime24);
        } else {
          endMinutes = currentMinutes + 30;
        }
        break;
        
      case 'range':
        // Format: "7:30-8:00 AM"
        const [startTime, endTime] = slot.split('-');
        const period = slot.includes('PM') ? 'PM' : 'AM';
        const startTime24 = convert12HourTo24Hour(`${startTime} ${period}`);
        const endTime24 = convert12HourTo24Hour(`${endTime} ${period}`);
        currentMinutes = timeStringToMinutes(startTime24);
        endMinutes = timeStringToMinutes(endTime24);
        break;
        
      case 'simple':
        // Format: "7:30-8:00"
        const [start, end] = slot.split('-');
        currentMinutes = timeStringToMinutes(start);
        endMinutes = timeStringToMinutes(end);
        break;
        
      default:
        currentMinutes = 0;
        endMinutes = 30;
    }
    
    ranges[slot] = {
      start: currentMinutes,
      end: endMinutes
    };
  });
  
  return ranges;
};

/**
 * Convert 12-hour time format to 24-hour format
 * @param {string} time12 - Time in 12-hour format (e.g., "2:30 PM")
 * @returns {string} Time in 24-hour format (e.g., "14:30")
 */
export const convert12HourTo24Hour = (time12) => {
  const [time, period] = time12.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Check if appointment overlaps with time slot
 * @param {Object} appointment - Appointment object with startTime and endTime
 * @param {string} timeSlot - Time slot string
 * @param {Object} timeSlotRanges - Time slot ranges object
 * @returns {boolean} True if appointment overlaps with time slot
 */
export const isAppointmentInTimeSlot = (appointment, timeSlot, timeSlotRanges) => {
  const slotRange = timeSlotRanges[timeSlot];
  if (!slotRange) return false;
  
  const appStart = new Date(appointment.startTime);
  const appEnd = new Date(appointment.endTime);
  
  const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
  const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
  
  return (
    (appStartMinutes >= slotRange.start && appStartMinutes < slotRange.end) ||
    (appEndMinutes > slotRange.start && appEndMinutes <= slotRange.end) ||
    (appStartMinutes <= slotRange.start && appEndMinutes >= slotRange.end)
  );
};

/**
 * Get the starting slot index for an appointment
 * @param {Object} appointment - Appointment object with startTime
 * @param {Array} timeSlots - Array of time slot strings
 * @param {Object} timeSlotRanges - Time slot ranges object
 * @returns {number} Index of the starting time slot
 */
export const getAppointmentStartSlotIndex = (appointment, timeSlots, timeSlotRanges) => {
  const start = new Date(appointment.startTime);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  
  const index = timeSlots.findIndex(slot => {
    const slotRange = timeSlotRanges[slot];
    return slotRange && startMinutes >= slotRange.start && startMinutes < slotRange.end;
  });
  
  return index;
};

/**
 * Calculate how many time slots an appointment spans
 * @param {Object} appointment - Appointment object with startTime and endTime
 * @param {Array} timeSlots - Array of time slot strings
 * @param {Object} timeSlotRanges - Time slot ranges object
 * @returns {number} Number of time slots the appointment spans
 */
export const calculateAppointmentSpan = (appointment, timeSlots, timeSlotRanges) => {
  const startIndex = getAppointmentStartSlotIndex(appointment, timeSlots, timeSlotRanges);
  if (startIndex === -1) return 1;
  
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const durationMinutes = (end - start) / (1000 * 60);
  
  // Find how many slots this duration spans
  let span = 1;
  let currentTime = start;
  
  while (currentTime < end) {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentSlot = timeSlots.find(slot => {
      const slotRange = timeSlotRanges[slot];
      return slotRange && currentMinutes >= slotRange.start && currentMinutes < slotRange.end;
    });
    
    if (!currentSlot) break;
    
    const slotRange = timeSlotRanges[currentSlot];
    const nextSlotTime = new Date(start);
    nextSlotTime.setHours(Math.floor(slotRange.end / 60), slotRange.end % 60, 0, 0);
    
    if (nextSlotTime >= end) break;
    
    currentTime = nextSlotTime;
    span++;
  }
  
  return span;
};

/**
 * Get time slots for a specific location or fallback to default
 * @param {Object} location - Location object
 * @param {string} format - Format type: 'excel', 'range', or 'simple'
 * @returns {Object} Object containing timeSlots and timeSlotRanges
 */
export const getLocationTimeSlots = (location, format = 'excel') => {
  const slotDuration = location?.slotDuration || 30; // Use location's slot duration or default to 30
  const timeSlots = generateTimeSlots(location, slotDuration, format);
  const timeSlotRanges = generateTimeSlotRanges(timeSlots, format);
  
  return {
    timeSlots,
    timeSlotRanges
  };
};

/**
 * Get the most common location from appointments
 * @param {Array} appointments - Array of appointment objects
 * @returns {Object|null} Location object or null if no location found
 */
export const getMostCommonLocation = (appointments) => {
  if (!appointments || appointments.length === 0) return null;
  
  const locationCounts = {};
  appointments.forEach(app => {
    if (app.location) {
      const locationId = app.location.id;
      locationCounts[locationId] = (locationCounts[locationId] || 0) + 1;
    }
  });
  
  if (Object.keys(locationCounts).length === 0) return null;
  
  const mostCommonLocationId = Object.keys(locationCounts).reduce((a, b) => 
    locationCounts[a] > locationCounts[b] ? a : b
  );
  
  return appointments.find(app => app.location?.id === mostCommonLocationId)?.location || null;
}; 