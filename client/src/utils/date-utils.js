import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isValid } from 'date-fns';

// Format date for display
export const formatDate = (date, formatStr = 'PPP') => {
  if (!date) return '';
  
  // If it's a string, try to parse it
  if (typeof date === 'string') {
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) return date;
    return format(parsedDate, formatStr);
  }
  
  return format(date, formatStr);
};

// Format time for display
export const formatTime = (date, formatStr = 'h:mm a') => {
  if (!date) return '';
  
  // If it's a string, try to parse it
  if (typeof date === 'string') {
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) return date;
    return format(parsedDate, formatStr);
  }
  
  return format(date, formatStr);
};

// Get days for a week view
export const getWeekDays = (baseDate = new Date()) => {
  const start = startOfWeek(baseDate, { weekStartsOn: 0 });
  const end = endOfWeek(baseDate, { weekStartsOn: 0 });
  
  return eachDayOfInterval({ start, end });
};

// Get days for a month view
export const getMonthDays = (baseDate = new Date()) => {
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);
  
  return eachDayOfInterval({ start, end });
};

// Check if a date is today
export const isToday = (date) => {
  return isSameDay(date, new Date());
};

// Generate time slots for a day (e.g., 8 AM to 6 PM in 15-minute increments)
export const generateTimeSlots = (startHour = 8, endHour = 18, intervalMinutes = 15) => {
  const slots = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const time = new Date(today);
      time.setHours(hour, minute);
      slots.push(time);
    }
  }
  
  return slots;
};

// Calculate appointment position and height for calendar display
export const calculateAppointmentStyle = (appointment, hourHeight = 60, startHourOffset = 8) => {
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const endHour = end.getHours();
  const endMinute = end.getMinutes();
  
  // Adjust for the calendar starting at a specific hour (e.g., 8 AM)
  const adjustedStartMinutes = (startHour - startHourOffset) * 60 + startMinute;
  const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  
  const top = adjustedStartMinutes * (hourHeight / 60);
  const height = durationMinutes * (hourHeight / 60);
  
  return {
    top: `${top}px`,
    height: `${height}px`
  };
};