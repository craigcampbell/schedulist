const { User, Patient, Appointment, Note, Location } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all patients assigned to this therapist
 */
const getAssignedPatients = async (req, res) => {
  try {
    const { status } = req.query;
    const therapistId = req.user.id;
    
    // Build query
    const where = {};
    if (status) {
      where.status = status;
    }
    
    // Get patients assigned to this therapist
    const patients = await Patient.findAll({
      where,
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: therapistId },
          attributes: [],
          through: { attributes: [] }
        }
      ],
      order: [['updatedAt', 'DESC']]
    });
    
    // Format response with decrypted data
    const formattedPatients = patients.map(patient => ({
      id: patient.id,
      firstName: patient.firstName,
      lastInitial: patient.lastName ? patient.lastName.charAt(0) : '',
      dateOfBirth: patient.dateOfBirth,
      insuranceProvider: patient.insuranceProvider,
      requiredWeeklyHours: patient.requiredWeeklyHours,
      status: patient.status,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    }));
    
    return res.status(200).json(formattedPatients);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching patients', error: error.message });
  }
};

/**
 * Get therapist's upcoming schedule
 */
const getUpcomingSchedule = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const therapistId = req.user.id;
    
    // Calculate date range
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + parseInt(days));
    endDate.setHours(23, 59, 59, 999);
    
    // Get appointments
    const appointments = await Appointment.findAll({
      where: {
        therapistId,
        startTime: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: Patient,
          required: true
        },
        {
          model: Location,
          attributes: ['id', 'name', 'address'],
          required: false
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
        firstName: appt.Patient.firstName,
        lastName: appt.Patient.lastName,
        status: appt.Patient.status
      } : null,
      location: appt.Location ? {
        id: appt.Location.id,
        name: appt.Location.name,
        address: appt.Location.address
      } : null,
      notes: appt.notes
    }));
    
    return res.status(200).json({
      startDate,
      endDate,
      appointments: formattedAppointments
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching schedule', error: error.message });
  }
};

/**
 * Update appointment status
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const therapistId = req.user.id;
    
    // Find the appointment and ensure it belongs to this therapist
    const appointment = await Appointment.findOne({
      where: {
        id,
        therapistId
      }
    });
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or not assigned to you' });
    }
    
    // Update status
    appointment.status = status;
    if (notes !== undefined) {
      appointment.notes = notes;
    }
    
    await appointment.save();
    
    return res.status(200).json({
      message: 'Appointment status updated successfully',
      appointment: {
        id: appointment.id,
        status: appointment.status
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating appointment status', error: error.message });
  }
};

/**
 * Get therapist dashboard summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const therapistId = req.user.id;
    
    // Count assigned patients
    const patientCount = await Patient.count({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: therapistId },
          attributes: [],
          through: { attributes: [] }
        }
      ]
    });
    
    // Count today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayAppointmentsCount = await Appointment.count({
      where: {
        therapistId,
        startTime: {
          [Op.between]: [today, endOfDay]
        }
      }
    });
    
    // Count upcoming appointments
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingAppointmentsCount = await Appointment.count({
      where: {
        therapistId,
        startTime: {
          [Op.between]: [today, nextWeek]
        }
      }
    });
    
    // Count notes created in last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentNotesCount = await Note.count({
      where: {
        authorId: therapistId,
        createdAt: {
          [Op.gte]: lastWeek
        }
      }
    });
    
    return res.status(200).json({
      patientCount,
      todayAppointmentsCount,
      upcomingAppointmentsCount,
      recentNotesCount
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
  }
};

module.exports = {
  getAssignedPatients,
  getUpcomingSchedule,
  updateAppointmentStatus,
  getDashboardSummary
};