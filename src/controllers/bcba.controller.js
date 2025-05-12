const { User, Role, Patient, Appointment } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all therapists managed by this BCBA
 */
const getTherapists = async (req, res) => {
  try {
    const bcbaId = req.user.id;
    
    // Get all therapists with therapist role
    const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
    
    if (!therapistRole) {
      return res.status(404).json({ message: 'Therapist role not found' });
    }
    
    // For BCBAs, we need to filter to only show therapists that share patients with them
    const bcbaPatients = await Patient.findAll({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: bcbaId },
          attributes: [],
          through: { attributes: [] }
        }
      ]
    });
    
    const patientIds = bcbaPatients.map(patient => patient.id);
    
    // Find therapists that are assigned to the same patients as the BCBA
    const therapists = await User.findAll({
      include: [
        {
          model: Role,
          where: { id: therapistRole.id },
          attributes: [],
          through: { attributes: [] }
        },
        {
          model: Patient,
          as: 'Patients',
          where: { id: { [Op.in]: patientIds } },
          attributes: [],
          through: { attributes: [] },
          required: false
        }
      ],
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'active', 'createdAt', 'updatedAt']
    });
    
    return res.status(200).json(therapists);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching therapists', error: error.message });
  }
};

/**
 * Add a therapist (create a new user with therapist role)
 */
const addTherapist = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ where: { email } });
    
    if (userExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Create the user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      active: true
    });
    
    // Assign therapist role
    const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
    await user.addRole(therapistRole);
    
    return res.status(201).json({
      message: 'Therapist added successfully',
      therapist: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error adding therapist', error: error.message });
  }
};

/**
 * Update a therapist
 */
const updateTherapist = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, active } = req.body;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (active !== undefined) user.active = active;
    
    await user.save();
    
    return res.status(200).json({
      message: 'Therapist updated successfully',
      therapist: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        active: user.active
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating therapist', error: error.message });
  }
};

/**
 * Assign patients to a therapist
 */
const assignPatients = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientIds } = req.body;
    
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({ message: 'Patient IDs must be a non-empty array' });
    }
    
    const therapist = await User.findByPk(id);
    
    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Get existing patient assignments
    const existingAssignments = await therapist.getPatients();
    const existingIds = existingAssignments.map(patient => patient.id);
    
    // Get all patients that need to be assigned
    const patients = await Patient.findAll({
      where: { id: { [Op.in]: patientIds } }
    });
    
    if (patients.length !== patientIds.length) {
      return res.status(404).json({ message: 'One or more patients not found' });
    }
    
    // Add the new assignments (sequelize will handle duplicates)
    await therapist.addPatients(patients);
    
    // Get updated assignments for response
    const updatedAssignments = await therapist.getPatients({
      attributes: ['id', 'status']
    });
    
    return res.status(200).json({
      message: 'Patients assigned successfully',
      therapist: {
        id: therapist.id,
        name: `${therapist.firstName} ${therapist.lastName}`
      },
      patients: updatedAssignments.map(patient => ({
        id: patient.id,
        status: patient.status
      }))
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error assigning patients', error: error.message });
  }
};

/**
 * Get BCBA dashboard summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const bcbaId = req.user.id;
    
    // Get count of patients assigned to this BCBA
    const patientCount = await Patient.count({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: bcbaId },
          attributes: [],
          through: { attributes: [] }
        }
      ]
    });
    
    // Get count of active vs inactive patients
    const activePatientCount = await Patient.count({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: bcbaId },
          attributes: [],
          through: { attributes: [] }
        }
      ],
      where: { status: 'active' }
    });
    
    // Get count of therapists (users with therapist role that share patients)
    const bcbaPatients = await Patient.findAll({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: bcbaId },
          attributes: [],
          through: { attributes: [] }
        }
      ],
      attributes: ['id']
    });
    
    const patientIds = bcbaPatients.map(patient => patient.id);
    
    const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
    
    let therapistCount = 0;
    if (patientIds.length > 0 && therapistRole) {
      therapistCount = await User.count({
        include: [
          {
            model: Role,
            where: { id: therapistRole.id },
            attributes: [],
            through: { attributes: [] }
          },
          {
            model: Patient,
            as: 'Patients',
            where: { id: { [Op.in]: patientIds } },
            attributes: [],
            through: { attributes: [] }
          }
        ],
        distinct: true
      });
    }
    
    // Get upcoming appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingAppointmentsCount = await Appointment.count({
      include: [
        {
          model: Patient,
          include: [
            {
              model: User,
              as: 'Assignees',
              where: { id: bcbaId },
              attributes: [],
              through: { attributes: [] }
            }
          ]
        }
      ],
      where: {
        startTime: {
          [Op.between]: [today, nextWeek]
        },
        status: 'scheduled'
      }
    });
    
    return res.status(200).json({
      patientCount,
      activePatientCount,
      inactivePatientCount: patientCount - activePatientCount,
      therapistCount,
      upcomingAppointmentsCount
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
  }
};

module.exports = {
  getTherapists,
  addTherapist,
  updateTherapist,
  assignPatients,
  getDashboardSummary
};