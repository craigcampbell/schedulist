const { Appointment, Patient, User, Location } = require('../models');
const { Op } = require('sequelize');

/**
 * Get schedule by view type and date range
 */
const getSchedule = async (req, res) => {
  try {
    const { view = 'daily', date, locationId, therapistId, bcbaId } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    const isBcba = req.user.roles.includes('bcba');
    
    // Parse date or use current date
    const baseDate = date ? new Date(date) : new Date();
    
    // Set start and end dates based on view
    let startDate, endDate;
    
    switch (view.toLowerCase()) {
      case 'daily':
        startDate = new Date(baseDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        // Start of the week (Sunday)
        startDate = new Date(baseDate);
        startDate.setDate(baseDate.getDate() - baseDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        
        // End of the week (Saturday)
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        // Start of the month
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
        
        // End of the month
        endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      default:
        return res.status(400).json({ message: 'Invalid view type. Use daily, weekly, or monthly.' });
    }
    
    // Build query conditions
    const where = {
      startTime: {
        [Op.between]: [startDate, endDate]
      }
    };
    
    // Filter by location if provided
    if (locationId) {
      where.locationId = locationId;
    }
    
    // Filter by therapist/bcba based on role and provided IDs
    if (therapistId) {
      where.therapistId = therapistId;
    } else if (bcbaId) {
      where.bcbaId = bcbaId;
    } else if (!isAdmin) {
      if (isBcba) {
        // BCBA can see their own assigned sessions
        where.bcbaId = userId;
      } else {
        // Regular therapists can only see their own schedule
        where.therapistId = userId;
      }
    }
    
    // Fetch appointments
    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: Patient,
          attributes: ['id', 'firstName', 'lastName', 'status'],
        },
        {
          model: User,
          as: 'Therapist',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'BCBA',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Location,
          attributes: ['id', 'name', 'workingHoursStart', 'workingHoursEnd']
        }
      ],
      order: [['startTime', 'ASC']]
    });
    
    // Format response
    const formattedAppointments = appointments.map(appt => ({
      id: appt.id,
      title: appt.title,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      patient: appt.Patient ? {
        id: appt.Patient.id,
        // Only return first name and last initial for privacy
        firstName: appt.Patient.firstName,
        lastInitial: appt.Patient.lastName ? appt.Patient.lastName.charAt(0) : '',
        status: appt.Patient.status
      } : null,
      therapist: appt.Therapist ? {
        id: appt.Therapist.id,
        name: `${appt.Therapist.firstName} ${appt.Therapist.lastName}`
      } : null,
      bcba: appt.BCBA ? {
        id: appt.BCBA.id,
        name: `${appt.BCBA.firstName} ${appt.BCBA.lastName}`
      } : null,
      location: appt.Location ? {
        id: appt.Location.id,
        name: appt.Location.name,
        workingHours: {
          start: appt.Location.workingHoursStart,
          end: appt.Location.workingHoursEnd
        }
      } : null,
      recurring: appt.recurring,
      recurringPattern: appt.recurringPattern,
      excludeWeekends: appt.excludeWeekends,
      excludeHolidays: appt.excludeHolidays
    }));
    
    // If no appointments but we have a location, return working hours
    let locationWorkingHours = null;
    if (formattedAppointments.length === 0 && locationId) {
      const location = await Location.findByPk(locationId);
      if (location) {
        locationWorkingHours = {
          start: location.workingHoursStart,
          end: location.workingHoursEnd
        };
      }
    }
    
    return res.status(200).json({
      view,
      startDate,
      endDate,
      appointments: formattedAppointments,
      locationWorkingHours
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching schedule', error: error.message });
  }
};

/**
 * Get appointments for a specific patient
 */
const getPatientSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10, includePast = false } = req.query;
    
    // Build query conditions
    const where = {
      patientId
    };
    
    // Only include future appointments unless past is requested
    if (!includePast || includePast === 'false') {
      where.startTime = {
        [Op.gte]: new Date()
      };
    }
    
    // Fetch appointments
    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: User,
          as: 'Therapist',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Location,
          attributes: ['id', 'name']
        }
      ],
      order: includePast ? [['startTime', 'DESC']] : [['startTime', 'ASC']],
      limit: parseInt(limit)
    });
    
    // Format response
    const formattedAppointments = appointments.map(appt => ({
      id: appt.id,
      title: appt.title,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      therapist: appt.Therapist ? {
        id: appt.Therapist.id,
        name: `${appt.Therapist.firstName} ${appt.Therapist.lastName}`
      } : null,
      location: appt.Location ? {
        id: appt.Location.id,
        name: appt.Location.name
      } : null,
      recurring: appt.recurring
    }));
    
    return res.status(200).json(formattedAppointments);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching patient schedule', error: error.message });
  }
};

/**
 * Find the next available slot for a therapist
 * @param {string} therapistId - Therapist ID
 * @param {string} locationId - Location ID
 * @param {Date} preferredDate - Preferred date (optional)
 * @param {number} durationMinutes - Session duration in minutes (default 30)
 * @returns {Object} - Next available time slot {startTime, endTime}
 */
const findNextAvailableSlot = async (therapistId, locationId, preferredDate = null, durationMinutes = 30) => {
  // Get location working hours
  const location = await Location.findByPk(locationId);
  if (!location) {
    throw new Error('Location not found');
  }
  
  // Parse working hours (format: "HH:MM")
  const [startHour, startMinute] = location.workingHoursStart.split(':').map(Number);
  const [endHour, endMinute] = location.workingHoursEnd.split(':').map(Number);
  
  // Set search start date (today or preferred date)
  const searchDate = preferredDate ? new Date(preferredDate) : new Date();
  searchDate.setHours(0, 0, 0, 0); // Reset to beginning of day
  
  // Create a 14-day window to search for available slots
  const searchEndDate = new Date(searchDate);
  searchEndDate.setDate(searchDate.getDate() + 14);
  
  // Get all appointments for this therapist in the search period
  const appointments = await Appointment.findAll({
    where: {
      therapistId,
      startTime: {
        [Op.between]: [searchDate, searchEndDate]
      }
    },
    order: [['startTime', 'ASC']]
  });
  
  // Loop through days until we find an available slot
  for (let currentDate = new Date(searchDate); currentDate <= searchEndDate; currentDate.setDate(currentDate.getDate() + 1)) {
    // Skip weekends if not preferred
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      continue;
    }
    
    // Set working hours for this day
    const dayStart = new Date(currentDate);
    dayStart.setHours(startHour, startMinute, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(endHour, endMinute, 0, 0);
    
    // Filter appointments for this day
    const dayAppointments = appointments.filter(appt => {
      const appointmentDate = new Date(appt.startTime);
      return appointmentDate.getDate() === currentDate.getDate() &&
             appointmentDate.getMonth() === currentDate.getMonth() &&
             appointmentDate.getFullYear() === currentDate.getFullYear();
    });
    
    // If no appointments, the first slot of the day is available
    if (dayAppointments.length === 0) {
      const endTime = new Date(dayStart);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);
      
      return {
        startTime: dayStart,
        endTime: endTime
      };
    }
    
    // Sort day appointments by start time
    dayAppointments.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    // Check for a slot before the first appointment
    const firstAppt = dayAppointments[0];
    const firstApptStart = new Date(firstAppt.startTime);
    
    const timeBeforeFirstAppt = (firstApptStart - dayStart) / (1000 * 60); // in minutes
    if (timeBeforeFirstAppt >= durationMinutes) {
      const endTime = new Date(dayStart);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);
      
      return {
        startTime: dayStart,
        endTime: endTime
      };
    }
    
    // Check for slots between appointments
    for (let i = 0; i < dayAppointments.length - 1; i++) {
      const currentApptEnd = new Date(dayAppointments[i].endTime);
      const nextApptStart = new Date(dayAppointments[i + 1].startTime);
      
      const timeBetween = (nextApptStart - currentApptEnd) / (1000 * 60); // in minutes
      
      if (timeBetween >= durationMinutes) {
        const endTime = new Date(currentApptEnd);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);
        
        return {
          startTime: currentApptEnd,
          endTime: endTime
        };
      }
    }
    
    // Check for a slot after the last appointment
    const lastAppt = dayAppointments[dayAppointments.length - 1];
    const lastApptEnd = new Date(lastAppt.endTime);
    
    const timeAfterLastAppt = (dayEnd - lastApptEnd) / (1000 * 60); // in minutes
    if (timeAfterLastAppt >= durationMinutes) {
      const endTime = new Date(lastApptEnd);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);
      
      return {
        startTime: lastApptEnd,
        endTime: endTime
      };
    }
  }
  
  // If no slots found in the search period, return null
  return null;
};

/**
 * Create a new appointment (BCBA only)
 */
const createAppointment = async (req, res) => {
  try {
    const {
      patientId,
      therapistId,
      bcbaId,
      locationId,
      startTime,
      endTime,
      title,
      notes,
      recurring,
      recurringPattern,
      excludeWeekends,
      excludeHolidays,
      useNextAvailableSlot
    } = req.body;
    
    // Validate patient exists
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Validate therapist exists
    const therapist = await User.findByPk(therapistId);
    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Validate BCBA exists
    const bcba = await User.findByPk(bcbaId || req.user.id);
    if (!bcba) {
      return res.status(404).json({ message: 'BCBA not found' });
    }
    
    // Validate location exists
    const location = await Location.findByPk(locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    // Calculate time slot based on user input or find next available
    let appointmentStart, appointmentEnd;
    
    if (useNextAvailableSlot) {
      // Find the next available slot for this therapist
      const durationMinutes = req.body.durationMinutes || 30; // Default to 30 minutes if not specified
      const slot = await findNextAvailableSlot(
        therapistId, 
        locationId, 
        req.body.preferredDate || null, 
        durationMinutes
      );
      
      if (!slot) {
        return res.status(409).json({ message: 'No available slots found for this therapist in the next 14 days' });
      }
      
      appointmentStart = slot.startTime;
      appointmentEnd = slot.endTime;
    } else {
      // Use provided times
      appointmentStart = new Date(startTime);
      appointmentEnd = new Date(endTime);
      
      // Validate minimum session time (30 minutes)
      const sessionDuration = (appointmentEnd - appointmentStart) / (1000 * 60);
      if (sessionDuration < 30) {
        return res.status(400).json({ message: 'Session duration must be at least 30 minutes' });
      }
      
      // Check for scheduling conflicts
      const conflictingAppointment = await Appointment.findOne({
        where: {
          therapistId,
          [Op.or]: [
            {
              startTime: {
                [Op.between]: [appointmentStart, appointmentEnd]
              }
            },
            {
              endTime: {
                [Op.between]: [appointmentStart, appointmentEnd]
              }
            },
            {
              [Op.and]: [
                { startTime: { [Op.lte]: appointmentStart } },
                { endTime: { [Op.gte]: appointmentEnd } }
              ]
            }
          ]
        }
      });
      
      if (conflictingAppointment) {
        return res.status(409).json({ message: 'This time slot conflicts with an existing appointment' });
      }
    }
    
    // Create the appointment
    const appointment = await Appointment.create({
      patientId,
      therapistId,
      bcbaId: bcbaId || req.user.id, // Use provided BCBA or current user (who must be a BCBA)
      locationId,
      startTime: appointmentStart,
      endTime: appointmentEnd,
      title,
      notes,
      recurring: recurring || false,
      recurringPattern: recurringPattern || null,
      excludeWeekends: excludeWeekends !== undefined ? excludeWeekends : true,
      excludeHolidays: excludeHolidays !== undefined ? excludeHolidays : true,
      status: 'scheduled'
    });
    
    return res.status(201).json({
      message: 'Appointment created successfully',
      appointment: {
        id: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error creating appointment', error: error.message });
  }
};

/**
 * Update an appointment
 */
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startTime,
      endTime,
      title,
      notes,
      status,
      therapistId,
      locationId
    } = req.body;
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check for scheduling conflicts if time is changed
    if ((startTime && startTime !== appointment.startTime.toISOString()) || 
        (endTime && endTime !== appointment.endTime.toISOString())) {
        
      const newTherapistId = therapistId || appointment.therapistId;
      
      const conflictingAppointment = await Appointment.findOne({
        where: {
          id: { [Op.ne]: id }, // Exclude the current appointment
          therapistId: newTherapistId,
          [Op.or]: [
            {
              startTime: {
                [Op.between]: [
                  new Date(startTime || appointment.startTime),
                  new Date(endTime || appointment.endTime)
                ]
              }
            },
            {
              endTime: {
                [Op.between]: [
                  new Date(startTime || appointment.startTime),
                  new Date(endTime || appointment.endTime)
                ]
              }
            }
          ]
        }
      });
      
      if (conflictingAppointment) {
        return res.status(409).json({ message: 'This time slot conflicts with an existing appointment' });
      }
    }
    
    // Update appointment fields
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;
    if (title) appointment.title = title;
    if (notes !== undefined) appointment.notes = notes;
    if (status) appointment.status = status;
    if (therapistId) appointment.therapistId = therapistId;
    if (locationId) appointment.locationId = locationId;
    
    await appointment.save();
    
    return res.status(200).json({
      message: 'Appointment updated successfully',
      appointment: {
        id: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating appointment', error: error.message });
  }
};

/**
 * Delete an appointment
 */
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    await appointment.destroy();
    
    return res.status(200).json({
      message: 'Appointment deleted successfully'
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting appointment', error: error.message });
  }
};

/**
 * Get next available slot for a therapist
 */
const getNextAvailableSlot = async (req, res) => {
  try {
    const { therapistId, locationId, preferredDate, durationMinutes = 30 } = req.query;
    
    // Validate therapist exists
    const therapist = await User.findByPk(therapistId);
    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Validate location exists
    const location = await Location.findByPk(locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    // Find next available slot
    const slot = await findNextAvailableSlot(
      therapistId,
      locationId,
      preferredDate ? new Date(preferredDate) : null,
      parseInt(durationMinutes)
    );
    
    if (!slot) {
      return res.status(404).json({ message: 'No available slots found for this therapist in the next 14 days' });
    }
    
    return res.status(200).json(slot);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error finding next available slot', error: error.message });
  }
};

module.exports = {
  getSchedule,
  getPatientSchedule,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getNextAvailableSlot,
  findNextAvailableSlot // Export for internal use by other controllers
};