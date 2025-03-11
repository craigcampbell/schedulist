const { Appointment, Patient, User, Location } = require('../models');
const { Op } = require('sequelize');

/**
 * Get schedule by view type and date range
 */
const getSchedule = async (req, res) => {
  try {
    const { view = 'daily', date, locationId, therapistId } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    const isBcba = req.user.roles.includes('bcba');
    
    // Parse date or use current date
    const baseDate = date ? new Date(date) : new Date();
    
    // Set start and end dates based on view
    let startDate, endDate;
    
    switch (view.toLowerCase()) {
      case 'daily':
        startDate = new Date(baseDate.setHours(0, 0, 0, 0));
        endDate = new Date(baseDate.setHours(23, 59, 59, 999));
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
    
    // Filter by therapist if provided, or use current user if not admin/bcba
    if (therapistId) {
      where.therapistId = therapistId;
    } else if (!isAdmin && !isBcba) {
      // Regular therapists can only see their own schedule
      where.therapistId = userId;
    }
    
    // Fetch appointments
    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: Patient,
          attributes: ['id', 'status'],
        },
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
      order: [['startTime', 'ASC']]
    });
    
    // Format response
    const formattedAppointments = appointments.map(appt => ({
      id: appt.id,
      title: appt.title,
      startTime: appt.startTime,
      endTime: appt.endTime,
      status: appt.status,
      patient: {
        id: appt.Patient.id,
        // Only return first name and last initial for privacy
        firstName: appt.Patient.firstName,
        lastInitial: appt.Patient.lastName ? appt.Patient.lastName.charAt(0) : '',
        status: appt.Patient.status
      },
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
    
    return res.status(200).json({
      view,
      startDate,
      endDate,
      appointments: formattedAppointments
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
 * Create a new appointment (BCBA only)
 */
const createAppointment = async (req, res) => {
  try {
    const {
      patientId,
      therapistId,
      locationId,
      startTime,
      endTime,
      title,
      notes,
      recurring,
      recurringPattern
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
    
    // Validate location exists
    const location = await Location.findByPk(locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    // Check for scheduling conflicts
    const conflictingAppointment = await Appointment.findOne({
      where: {
        therapistId,
        [Op.or]: [
          {
            startTime: {
              [Op.between]: [new Date(startTime), new Date(endTime)]
            }
          },
          {
            endTime: {
              [Op.between]: [new Date(startTime), new Date(endTime)]
            }
          }
        ]
      }
    });
    
    if (conflictingAppointment) {
      return res.status(409).json({ message: 'This time slot conflicts with an existing appointment' });
    }
    
    // Create the appointment
    const appointment = await Appointment.create({
      patientId,
      therapistId,
      locationId,
      startTime,
      endTime,
      title,
      notes,
      recurring: recurring || false,
      recurringPattern: recurringPattern || null,
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

module.exports = {
  getSchedule,
  getPatientSchedule,
  createAppointment,
  updateAppointment,
  deleteAppointment
};