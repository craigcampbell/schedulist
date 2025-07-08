const { User, Role, Patient, Appointment } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('sequelize');

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
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'active', 'createdAt', 'updatedAt'],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });
    
    // Format the response to include roles
    const formattedTherapists = therapists.map(therapist => {
      const roles = therapist.Roles ? therapist.Roles.map(role => role.name) : [];
      return {
        id: therapist.id,
        firstName: therapist.firstName,
        lastName: therapist.lastName,
        email: therapist.email,
        phone: therapist.phone,
        active: therapist.active,
        createdAt: therapist.createdAt,
        updatedAt: therapist.updatedAt,
        roles: roles,
        name: `${therapist.firstName} ${therapist.lastName}`
      };
    });
    
    // Filter to make sure therapist role is included
    const filteredTherapists = formattedTherapists.filter(t => t.roles.includes('therapist'));
    
    return res.status(200).json(filteredTherapists);
    
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
 * return list of unassigned Patients
 * 
*/
const getUnassignedPatients = async (req, res) => {
  try {
    const { therapistId } = req.query; // Get from query params instead
    const userId = req.user.id;
    
    // If no therapist ID is provided, return all patients not assigned to the current BCBA
    if (!therapistId) {
      // Get all patients in the organization
      const allPatients = await Patient.findAll({
        where: { organizationId: req.user.organizationId },
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'active', 'status', 'createdAt', 'updatedAt']
      });
      
      // Get patients assigned to the BCBA
      const assignedPatients = await Patient.findAll({
        include: [
          {
            model: User,
            as: 'Assignees',
            where: { id: userId },
            attributes: [],
            through: { attributes: [] }
          }
        ],
        attributes: ['id']
      });
      
      const assignedPatientIds = assignedPatients.map(p => p.id);
      
      // Filter out assigned patients
      const unassignedPatients = allPatients.filter(p => !assignedPatientIds.includes(p.id));
      
      return res.status(200).json(unassignedPatients);
    }
    
    // If a therapist ID is provided, return all patients not assigned to that therapist
    const therapist = await User.findByPk(therapistId);

    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Get all patients assigned to the therapist
    const assignedPatients = await Patient.findAll({
      include: [
        {
          model: User,
          as: 'Assignees',
          where: { id: therapistId },
          attributes: [],
          through: { attributes: [] }
        }
      ],
      attributes: ['id']
    });
    
    const assignedPatientIds = assignedPatients.map(p => p.id);
    
    // Get all patients in the organization not assigned to the therapist
    const unassignedPatients = await Patient.findAll({
      where: { 
        organizationId: req.user.organizationId,
        id: { [Op.notIn]: assignedPatientIds }
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'active', 'status', 'createdAt', 'updatedAt']
    });

    return res.status(200).json(unassignedPatients);

  } catch (error) {
    console.error('Error fetching unassigned patients:', error);
    return res.status(500).json({ message: 'Error fetching unassigned patients', error: error.message });
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

/**
 * Get available therapists for assignment (organizational level)
 */
const getAvailableTherapists = async (req, res) => {
  try {
    const bcbaId = req.user.id;
    const { organizationId } = req.user;
    
    // Get user with organization
    const user = await User.findByPk(bcbaId, {
      attributes: ['id', 'organizationId']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all therapists in the same organization
    const therapistRole = await Role.findOne({ where: { name: 'therapist' } });
    
    if (!therapistRole) {
      return res.status(404).json({ message: 'Therapist role not found' });
    }
    
    const therapists = await User.findAll({
      include: [
        {
          model: Role,
          where: { id: therapistRole.id },
          through: { attributes: [] }
        }
      ],
      where: { 
        organizationId: user.organizationId,
        active: true
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'active']
    });
    
    return res.status(200).json(therapists);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching available therapists', error: error.message });
  }
};

/**
 * Get available BCBAs for assignment (organizational level)
 */
const getAvailableBCBAs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { organizationId } = req.user;
    
    // Get user with organization
    const user = await User.findByPk(userId, {
      attributes: ['id', 'organizationId']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all BCBAs in the same organization
    const bcbaRole = await Role.findOne({ where: { name: 'bcba' } });
    
    if (!bcbaRole) {
      return res.status(404).json({ message: 'BCBA role not found' });
    }
    
    const bcbas = await User.findAll({
      include: [
        {
          model: Role,
          where: { id: bcbaRole.id },
          through: { attributes: [] }
        }
      ],
      where: { 
        organizationId: user.organizationId,
        active: true
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'active'],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });
    
    // Format the response
    const formattedBcbas = bcbas.map(bcba => ({
      id: bcba.id,
      firstName: bcba.firstName,
      lastName: bcba.lastName,
      email: bcba.email,
      active: bcba.active,
      name: `${bcba.firstName} ${bcba.lastName}`,
      roles: ['bcba'] // Add the roles array for consistency
    }));
    
    return res.status(200).json(formattedBcbas);
    
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching available BCBAs', error: error.message });
  }
};

/**
 * Get patients with their assigned BCBAs and therapists
 */
const getPatientsWithAssignments = async (req, res) => {
  try {
    console.log('getPatientsWithAssignments called by user:', req.user);
    
    // Check if req.user exists and has necessary properties
    if (!req.user || !req.user.id || !req.user.organizationId) {
      console.error('Missing user data in request:', req.user);
      return res.status(401).json({ message: 'User data incomplete or missing' });
    }
    
    const userId = req.user.id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const isBcba = req.user.roles && req.user.roles.includes('bcba');
    
    // If user doesn't have admin or bcba roles, they shouldn't access this endpoint
    if (!isAdmin && !isBcba) {
      console.warn(`User ${userId} attempted to access patients without proper role`);
      return res.status(403).json({ message: 'Not authorized to access this resource' });
    }
    
    let whereClause = {};
    
    // Admins can see all patients in their organization
    if (isAdmin) {
      whereClause = { organizationId: req.user.organizationId };
    } 
    // BCBAs can see all patients in their organization (temporary fix for development)
    // TODO: In production, this should be restricted to assigned patients only
    else if (isBcba) {
      whereClause = { organizationId: req.user.organizationId };
    }
    
    console.log('Fetching patients with whereClause:', whereClause);
    
    // Get patients with their assignees
    try {
      const patients = await Patient.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'Assignees',
            include: [
              {
                model: Role,
                attributes: ['name']
              }
            ],
            through: { attributes: [] }
          },
          {
            model: User,
            as: 'PrimaryBCBA',
            attributes: ['id', 'firstName', 'lastName'],
            required: false
          }
        ]
        // Note: Cannot order by virtual fields (firstName, lastName) in SQL query
        // Will sort in JavaScript after decryption
      });
      
      console.log(`Found ${patients.length} patients`);
      
      // Debug first patient
      if (patients.length > 0) {
        console.log('First patient raw data:', {
          id: patients[0].id,
          encryptedFirstName: patients[0].encryptedFirstName?.substring(0, 20) + '...',
          firstName: patients[0].firstName,
          lastName: patients[0].lastName
        });
      }
      
      // Format response to group assignees by role
      const formattedPatients = patients.map(patient => {
        const patientData = {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          status: patient.status,
          color: patient.color,
          primaryBCBA: patient.PrimaryBCBA ? {
            id: patient.PrimaryBCBA.id,
            name: `${patient.PrimaryBCBA.firstName} ${patient.PrimaryBCBA.lastName}`
          } : null,
          bcbas: [],
          therapists: []
        };
        
        // Group assignees by role
        if (patient.Assignees && Array.isArray(patient.Assignees)) {
          patient.Assignees.forEach(assignee => {
            if (!assignee || !assignee.Roles || !Array.isArray(assignee.Roles)) {
              console.warn('Assignee or Roles missing/invalid:', assignee);
              return; // Skip this assignee
            }
            
            const role = assignee.Roles.find(r => r && (r.name === 'bcba' || r.name === 'therapist'));
            
            if (role) {
              if (role.name === 'bcba') {
                patientData.bcbas.push({
                  id: assignee.id,
                  firstName: assignee.firstName || '',
                  lastName: assignee.lastName || '',
                  name: `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()
                });
              } else if (role.name === 'therapist') {
                patientData.therapists.push({
                  id: assignee.id,
                  firstName: assignee.firstName || '',
                  lastName: assignee.lastName || '',
                  name: `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()
                });
              }
            }
          });
        }
        
        return patientData;
      });
      
      // Sort patients by lastName, then firstName (after decryption)
      formattedPatients.sort((a, b) => {
        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });
      
      return res.status(200).json(formattedPatients);
    } catch (error) {
      console.error('Error in Patient.findAll:', error);
      return res.status(500).json({ 
        message: 'Error retrieving patient data', 
        error: error.message,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error('Error fetching patients with assignments:', error);
    return res.status(500).json({ 
      message: 'Error fetching patients with assignments', 
      error: error.message,
      stack: error.stack // Include stack trace for debugging
    });
  }
};

/**
 * Set primary BCBA for a patient
 */
const setPrimaryBCBA = async (req, res) => {
  try {
    const { patientId, bcbaId } = req.body;
    
    if (!patientId || !bcbaId) {
      return res.status(400).json({ message: 'Patient ID and BCBA ID are required' });
    }
    
    // Verify both exist
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const bcba = await User.findByPk(bcbaId, {
      include: [
        {
          model: Role,
          where: { name: 'bcba' },
          through: { attributes: [] }
        }
      ]
    });
    
    if (!bcba) {
      return res.status(404).json({ message: 'BCBA not found' });
    }
    
    // Ensure the BCBA is assigned to the patient
    await patient.addAssignee(bcba);
    
    // Set primary BCBA
    patient.primaryBcbaId = bcbaId;
    await patient.save();
    
    return res.status(200).json({
      message: 'Primary BCBA set successfully',
      patient: {
        id: patient.id,
        primaryBcbaId: patient.primaryBcbaId
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error setting primary BCBA', error: error.message });
  }
};

/**
 * Assign or unassign a therapist from a patient
 */
const updateTherapistAssignment = async (req, res) => {
  try {
    const { patientId, therapistId, action } = req.body;
    
    if (!patientId || !therapistId || !action) {
      return res.status(400).json({ message: 'Patient ID, therapist ID, and action are required' });
    }
    
    if (action !== 'assign' && action !== 'unassign') {
      return res.status(400).json({ message: 'Action must be either "assign" or "unassign"' });
    }
    
    // Verify both exist
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const therapist = await User.findByPk(therapistId, {
      include: [
        {
          model: Role,
          where: { name: 'therapist' },
          through: { attributes: [] }
        }
      ]
    });
    
    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }
    
    // Check authorization - only admin or an assigned BCBA can modify assignments
    const userId = req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    
    if (!isAdmin) {
      const isAssignedBcba = await patient.hasAssignee(userId);
      
      if (!isAssignedBcba) {
        return res.status(403).json({ message: 'Not authorized to modify this patient\'s assignments' });
      }
    }
    
    // Update assignment
    if (action === 'assign') {
      await patient.addAssignee(therapist);
    } else {
      await patient.removeAssignee(therapist);
    }
    
    return res.status(200).json({
      message: `Therapist ${action === 'assign' ? 'assigned to' : 'unassigned from'} patient successfully`,
      patient: {
        id: patient.id
      },
      therapist: {
        id: therapist.id
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating therapist assignment', error: error.message });
  }
};

/**
 * Assign or unassign a BCBA from a patient
 */
const updateBCBAAssignment = async (req, res) => {
  try {
    const { patientId, bcbaId, action } = req.body;
    
    if (!patientId || !bcbaId || !action) {
      return res.status(400).json({ message: 'Patient ID, BCBA ID, and action are required' });
    }
    
    if (action !== 'assign' && action !== 'unassign') {
      return res.status(400).json({ message: 'Action must be either "assign" or "unassign"' });
    }
    
    // Verify both exist
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const bcba = await User.findByPk(bcbaId, {
      include: [
        {
          model: Role,
          where: { name: 'bcba' },
          through: { attributes: [] }
        }
      ]
    });
    
    if (!bcba) {
      return res.status(404).json({ message: 'BCBA not found' });
    }
    
    // Only admins or the primary BCBA can modify BCBA assignments
    const userId = req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    
    if (!isAdmin && patient.primaryBcbaId !== userId) {
      return res.status(403).json({ message: 'Not authorized to modify BCBA assignments for this patient' });
    }
    
    // Check if unassigning the primary BCBA
    if (action === 'unassign' && patient.primaryBcbaId === bcbaId) {
      return res.status(400).json({ message: 'Cannot unassign the primary BCBA. Please set another BCBA as primary first.' });
    }
    
    // Update assignment
    if (action === 'assign') {
      await patient.addAssignee(bcba);
    } else {
      await patient.removeAssignee(bcba);
    }
    
    return res.status(200).json({
      message: `BCBA ${action === 'assign' ? 'assigned to' : 'unassigned from'} patient successfully`,
      patient: {
        id: patient.id
      },
      bcba: {
        id: bcba.id
      }
    });
    
  } catch (error) {
    return res.status(500).json({ message: 'Error updating BCBA assignment', error: error.message });
  }
};

module.exports = {
  getTherapists,
  addTherapist,
  updateTherapist,
  assignPatients,
  getDashboardSummary,
  getAvailableTherapists,
  getAvailableBCBAs,
  getPatientsWithAssignments,
  setPrimaryBCBA,
  updateTherapistAssignment,
  updateBCBAAssignment,
  getUnassignedPatients
};