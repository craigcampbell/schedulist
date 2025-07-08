const { Patient, User, Appointment, Note, Team } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all patients (with filtering)
 * BCBA can see their assigned patients
 * Admin can see all patients
 */
const getAllPatients = async (req, res) => {
  try {
    const { status, search } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    
    // Base query conditions
    let where = {};
    
    // Apply status filter if provided
    if (status) {
      where.status = status;
    }
    
    // For non-admin users, only show assigned patients
    let include = [];
    
    if (!isAdmin) {
      include.push({
        model: User,
        as: 'Assignees',
        where: { id: userId },
        attributes: [],
        through: { attributes: [] }
      });
    }
    
    // Add Team to include
    include.push({
      model: Team,
      as: 'Team',
      attributes: ['id', 'name', 'color']
    });
    
    // Get patients
    const patients = await Patient.findAll({
      where,
      include,
      order: [['updatedAt', 'DESC']]
    });
    
    // Format response to include only necessary data and handle decryption
    const formattedPatients = patients.map(patient => ({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      insuranceProvider: patient.insuranceProvider,
      requiredWeeklyHours: patient.requiredWeeklyHours,
      teamId: patient.teamId,
      team: patient.Team ? {
        id: patient.Team.id,
        name: patient.Team.name,
        color: patient.Team.color
      } : null,
      status: patient.status,
      color: patient.color,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    }));
    
    return res.status(200).json(formattedPatients);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching patients', error: error.message });
  }
};

/**
 * Get patient by ID
 */
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const patient = await Patient.findByPk(id, {
      include: [
        {
          model: User,
          as: 'Assignees',
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Team,
          as: 'Team',
          attributes: ['id', 'name', 'color']
        },
        {
          model: Appointment,
          include: [
            {
              model: User,
              as: 'Therapist',
              attributes: ['id', 'firstName', 'lastName']
            }
          ],
          where: {
            startTime: {
              [Op.gte]: new Date()
            }
          },
          limit: 10,
          order: [['startTime', 'ASC']],
          required: false
        },
        {
          model: Note,
          include: [
            {
              model: User,
              as: 'Author',
              attributes: ['id', 'firstName', 'lastName']
            }
          ],
          limit: 10,
          order: [['createdAt', 'DESC']],
          required: false
        }
      ]
    });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Format response with decrypted fields
    const formattedPatient = {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      insuranceProvider: patient.insuranceProvider,
      insuranceId: patient.insuranceId,
      phone: patient.phone,
      address: patient.address,
      requiredWeeklyHours: patient.requiredWeeklyHours,
      status: patient.status,
      color: patient.color,
      assignees: patient.Assignees,
      upcomingAppointments: patient.Appointments.map(appt => ({
        id: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        therapist: appt.Therapist ? `${appt.Therapist.firstName} ${appt.Therapist.lastName}` : null
      })),
      recentNotes: patient.Notes.map(note => ({
        id: note.id,
        content: note.content,
        noteType: note.noteType,
        sessionDate: note.sessionDate,
        author: note.Author ? `${note.Author.firstName} ${note.Author.lastName}` : null,
        createdAt: note.createdAt
      })),
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };
    
    return res.status(200).json(formattedPatient);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching patient', error: error.message });
  }
};

/**
 * Create a new patient (BCBA and Admin only)
 */
const createPatient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      insuranceProvider,
      insuranceId,
      phone,
      address,
      requiredWeeklyHours,
      color,
      assigneeIds
    } = req.body;
    
    // Create the patient with virtual setters handling encryption
    const patient = await Patient.create({
      firstName,
      lastName,
      dateOfBirth,
      insuranceProvider,
      insuranceId,
      phone,
      address,
      requiredWeeklyHours,
      color,
      status: 'active'
    });
    
    // Assign the current user (BCBA) and any additional assignees
    const userIds = [...new Set([req.user.id, ...(assigneeIds || [])])];
    
    const assignees = await User.findAll({
      where: { id: { [Op.in]: userIds } }
    });
    
    await patient.setAssignees(assignees);
    
    return res.status(201).json({
      message: 'Patient created successfully',
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        status: patient.status,
        color: patient.color
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error creating patient', error: error.message });
  }
};

/**
 * Update a patient
 */
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      dateOfBirth,
      insuranceProvider,
      insuranceId,
      phone,
      address,
      requiredWeeklyHours,
      status,
      color,
      teamId,
      assigneeIds
    } = req.body;
    
    console.log('Updating patient:', id, 'with data:', req.body);
    
    const patient = await Patient.findByPk(id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Ensure the patient belongs to the user's organization
    if (patient.organizationId !== req.user.organizationId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update fields (virtual setters will handle encryption)
    if (firstName !== undefined) patient.firstName = firstName;
    if (lastName !== undefined) patient.lastName = lastName;
    if (dateOfBirth !== undefined) patient.dateOfBirth = dateOfBirth;
    if (insuranceProvider !== undefined) patient.insuranceProvider = insuranceProvider;
    if (insuranceId !== undefined) patient.insuranceId = insuranceId;
    if (phone !== undefined) patient.phone = phone;
    if (address !== undefined) patient.address = address;
    if (requiredWeeklyHours !== undefined) patient.requiredWeeklyHours = requiredWeeklyHours;
    if (status !== undefined) patient.status = status;
    if (color !== undefined) patient.color = color;
    if (teamId !== undefined) patient.teamId = teamId;
    
    try {
      await patient.save();
    } catch (saveError) {
      console.error('Error saving patient:', saveError);
      throw saveError;
    }
    
    // Update assignees if provided
    if (assigneeIds) {
      const assignees = await User.findAll({
        where: { id: { [Op.in]: assigneeIds } }
      });
      
      await patient.setAssignees(assignees);
    }
    
    return res.status(200).json({
      message: 'Patient updated successfully',
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        status: patient.status,
        color: patient.color
      }
    });
    
  } catch (error) {
    console.error('Error updating patient:', error);
    return res.status(500).json({ message: 'Error updating patient', error: error.message, stack: error.stack });
  }
};

/**
 * Delete a patient (soft delete by changing status to 'inactive')
 */
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    
    const patient = await Patient.findByPk(id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Soft delete by changing status
    patient.status = 'inactive';
    await patient.save();
    
    return res.status(200).json({
      message: 'Patient deleted successfully'
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting patient', error: error.message });
  }
};

/**
 * Get all notes for a patient
 */
const getPatientNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0, noteType } = req.query;
    
    // Check if patient exists
    const patientExists = await Patient.findByPk(id);
    
    if (!patientExists) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Build query
    const where = { patientId: id };
    if (noteType) {
      where.noteType = noteType;
    }
    
    // Get notes
    const notes = await Note.findAll({
      where,
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Format response with decrypted content
    const formattedNotes = notes.map(note => ({
      id: note.id,
      content: note.content, // This uses the virtual getter that decrypts
      noteType: note.noteType,
      sessionDate: note.sessionDate,
      author: note.Author ? `${note.Author.firstName} ${note.Author.lastName}` : null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }));
    
    return res.status(200).json(formattedNotes);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching patient notes', error: error.message });
  }
};

/**
 * Create a note for a patient
 */
const createPatientNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, noteType, sessionDate } = req.body;
    const authorId = req.user.id;
    
    // Check if patient exists
    const patientExists = await Patient.findByPk(id);
    
    if (!patientExists) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Create note (virtual setter will handle encryption)
    const note = await Note.create({
      content,
      noteType,
      sessionDate: sessionDate || new Date(),
      authorId,
      patientId: id
    });
    
    return res.status(201).json({
      message: 'Note created successfully',
      note: {
        id: note.id,
        noteType: note.noteType,
        sessionDate: note.sessionDate,
        createdAt: note.createdAt
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error creating note', error: error.message });
  }
};

/**
 * Check if a color is already used by another patient
 */
const checkDuplicateColor = async (req, res) => {
  try {
    const { color, excludePatientId } = req.query;
    
    console.log('checkDuplicateColor called with:', { color, excludePatientId });
    
    if (!color) {
      return res.status(400).json({ message: 'Color parameter is required' });
    }
    
    const where = { 
      color,
      organizationId: req.user.organizationId 
    };
    if (excludePatientId) {
      where.id = { [Op.ne]: excludePatientId };
    }
    
    console.log('Query where clause:', where);
    
    const patients = await Patient.findAll({
      where,
      attributes: ['id', 'encryptedFirstName', 'encryptedLastName', 'color']
    });
    
    console.log(`Found ${patients.length} patients with color ${color}`);
    
    // Sort patients by name after fetching (since we can't sort by virtual fields in SQL)
    const sortedPatients = patients
      .map(p => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return res.status(200).json({
      isDuplicate: patients.length > 0,
      patients: sortedPatients
    });
    
  } catch (error) {
    console.error('Error in checkDuplicateColor:', error);
    return res.status(500).json({ message: 'Error checking color duplicate', error: error.message, stack: error.stack });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientNotes,
  createPatientNote,
  checkDuplicateColor
};