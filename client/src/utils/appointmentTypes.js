/**
 * Appointment type definitions and color configurations
 * 
 * This file provides a centralized configuration for all appointment types,
 * their display properties, and business rules.
 */

export const APPOINTMENT_TYPES = {
  direct: {
    value: 'direct',
    label: 'Direct Service',
    description: 'Direct therapy session with a patient',
    requiresPatient: true,
    icon: '👤',
    colors: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-800 dark:text-blue-200',
      border: 'border-blue-300 dark:border-blue-700',
      hover: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
      badge: 'bg-blue-500 text-white'
    }
  },
  indirect: {
    value: 'indirect',
    label: 'Indirect Service',
    description: 'Documentation, prep work, or other non-patient activities',
    requiresPatient: false,
    icon: '📋',
    colors: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-800 dark:text-purple-200',
      border: 'border-purple-300 dark:border-purple-700',
      hover: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
      badge: 'bg-purple-500 text-white'
    }
  },
  supervision: {
    value: 'supervision',
    label: 'Supervision',
    description: 'Supervision sessions with other therapists',
    requiresPatient: false,
    icon: '👥',
    colors: {
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-800 dark:text-indigo-200',
      border: 'border-indigo-300 dark:border-indigo-700',
      hover: 'hover:bg-indigo-200 dark:hover:bg-indigo-900/50',
      badge: 'bg-indigo-500 text-white'
    }
  },
  lunch: {
    value: 'lunch',
    label: 'Lunch Break',
    description: 'Scheduled lunch break',
    requiresPatient: false,
    icon: '🍽️',
    colors: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-200',
      border: 'border-green-300 dark:border-green-700',
      hover: 'hover:bg-green-200 dark:hover:bg-green-900/50',
      badge: 'bg-green-500 text-white'
    }
  },
  noOw: {
    value: 'noOw',
    label: 'No Show/Out',
    description: 'Patient no-show or therapist out',
    requiresPatient: false,
    icon: '❌',
    colors: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-200',
      border: 'border-red-300 dark:border-red-700',
      hover: 'hover:bg-red-200 dark:hover:bg-red-900/50',
      badge: 'bg-red-500 text-white'
    }
  },
  circle: {
    value: 'circle',
    label: 'Circle Time',
    description: 'Group circle time activities',
    requiresPatient: false,
    icon: '⭕',
    colors: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      border: 'border-yellow-300 dark:border-yellow-700',
      hover: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
      badge: 'bg-yellow-500 text-white'
    }
  },
  cleaning: {
    value: 'cleaning',
    label: 'Cleaning',
    description: 'Scheduled cleaning time',
    requiresPatient: false,
    icon: '🧹',
    colors: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-200',
      border: 'border-orange-300 dark:border-orange-700',
      hover: 'hover:bg-orange-200 dark:hover:bg-orange-900/50',
      badge: 'bg-orange-500 text-white'
    }
  },
  parentTraining: {
    value: 'parentTraining',
    label: 'Parent Training',
    description: 'Training sessions with parents (BCBA only)',
    requiresPatient: false,
    requiresBCBA: true,
    icon: '👨‍👩‍👧',
    colors: {
      bg: 'bg-teal-100 dark:bg-teal-900/30',
      text: 'text-teal-800 dark:text-teal-200',
      border: 'border-teal-300 dark:border-teal-700',
      hover: 'hover:bg-teal-200 dark:hover:bg-teal-900/50',
      badge: 'bg-teal-500 text-white'
    }
  }
};

/**
 * Get appointment type configuration
 * @param {string} type - The appointment type value
 * @returns {Object} The appointment type configuration
 */
export const getAppointmentType = (type) => {
  return APPOINTMENT_TYPES[type] || APPOINTMENT_TYPES.direct;
};

/**
 * Get all appointment types as an array for dropdowns
 * @param {Object} options - Options object
 * @param {boolean} options.isBCBA - Whether the current user is a BCBA
 * @returns {Array} Array of appointment type objects
 */
export const getAppointmentTypeOptions = (options = {}) => {
  const { isBCBA = false } = options;
  
  return Object.values(APPOINTMENT_TYPES)
    .filter(type => {
      // If type requires BCBA and user is not BCBA, exclude it
      if (type.requiresBCBA && !isBCBA) {
        return false;
      }
      return true;
    })
    .map(type => ({
      value: type.value,
      label: type.label,
      description: type.description,
      requiresPatient: type.requiresPatient,
      icon: type.icon
    }));
};

/**
 * Get color classes for an appointment type
 * @param {string} type - The appointment type value
 * @returns {Object} Object containing all color classes
 */
export const getAppointmentColors = (type) => {
  const appointmentType = getAppointmentType(type);
  return appointmentType.colors;
};

/**
 * Check if appointment type requires a patient
 * @param {string} type - The appointment type value
 * @returns {boolean} True if patient is required
 */
export const requiresPatient = (type) => {
  const appointmentType = getAppointmentType(type);
  return appointmentType.requiresPatient;
};

/**
 * Check if appointment type is restricted to BCBAs only
 * @param {string} type - The appointment type value
 * @returns {boolean} True if restricted to BCBAs
 */
export const requiresBCBA = (type) => {
  const appointmentType = getAppointmentType(type);
  return appointmentType.requiresBCBA || false;
};

/**
 * Get display label for appointment
 * @param {Object} appointment - The appointment object
 * @returns {string} Display label
 */
export const getAppointmentDisplayLabel = (appointment) => {
  const type = getAppointmentType(appointment.serviceType);
  
  // For direct services, show patient name if available
  if (appointment.serviceType === 'direct' && appointment.patient) {
    return appointment.patient.firstName && appointment.patient.lastName
      ? `${appointment.patient.firstName.substring(0, 2)}${appointment.patient.lastName.substring(0, 2)}`
      : appointment.title || type.label;
  }
  
  // For other services, show the service type label
  return appointment.title || type.label;
};

/**
 * Legacy color mapping for backward compatibility
 */
export const SERVICE_COLORS = Object.entries(APPOINTMENT_TYPES).reduce((acc, [key, type]) => {
  acc[key] = `${type.colors.bg} ${type.colors.text} ${type.colors.border}`;
  return acc;
}, {});