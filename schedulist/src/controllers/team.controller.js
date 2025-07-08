const { Team, User, Patient, Role } = require('../models');
const { Op } = require('sequelize');

// Get all teams for a BCBA's organization
const getTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    // Get teams where the user is the lead BCBA or in the same organization
    const teams = await Team.findAll({
      include: [
        {
          model: User,
          as: 'LeadBCBA',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          where: {
            organizationId: organizationId
          }
        },
        {
          model: User,
          as: 'Members',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          through: { attributes: [] },
          include: [{
            model: Role,
            attributes: ['name'],
            through: { attributes: [] }
          }]
        }
      ],
      order: [['name', 'ASC']]
    });

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ 
      message: 'Failed to fetch teams',
      error: error.message 
    });
  }
};

// Create a new team
const createTeam = async (req, res) => {
  try {
    const { name, color, leadBcbaId } = req.body;
    const userId = req.user.id;

    // Validate that the user is a BCBA or admin
    const currentUser = await User.findByPk(userId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });
    const isBCBA = currentUser.Roles.some(role => role.name === 'bcba');
    const isAdmin = currentUser.Roles.some(role => role.name === 'admin');
    
    if (!isBCBA && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only BCBAs or admins can create teams' 
      });
    }

    // Use the requesting user as lead if not specified
    const finalLeadBcbaId = leadBcbaId || userId;

    // Create the team
    const team = await Team.create({
      name,
      color: color || '#4B5563',
      leadBcbaId: finalLeadBcbaId
    });

    // Fetch the created team with associations
    const createdTeam = await Team.findByPk(team.id, {
      include: [
        {
          model: User,
          as: 'LeadBCBA',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'Members',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          through: { attributes: [] }
        }
      ]
    });

    res.status(201).json(createdTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ 
      message: 'Failed to create team',
      error: error.message 
    });
  }
};

// Update a team
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const userId = req.user.id;

    // Find the team
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({ 
        message: 'Team not found' 
      });
    }

    // Check if user is the lead BCBA or admin
    const currentUser = await User.findByPk(userId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });
    const isAdmin = currentUser.Roles.some(role => role.name === 'admin');
    
    if (team.leadBcbaId !== userId && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only the team lead or admin can update the team' 
      });
    }

    // Update the team
    await team.update({
      name: name || team.name,
      color: color || team.color
    });

    // Fetch updated team with associations
    const updatedTeam = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: 'LeadBCBA',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'Members',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          through: { attributes: [] }
        }
      ]
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ 
      message: 'Failed to update team',
      error: error.message 
    });
  }
};

// Add a member to a team
const addTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: newMemberId } = req.body;
    const requestingUserId = req.user.id;

    // Find the team
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({ 
        message: 'Team not found' 
      });
    }

    // Check if user is the lead BCBA or admin
    const currentUser = await User.findByPk(requestingUserId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });
    const isAdmin = currentUser.Roles.some(role => role.name === 'admin');
    
    if (team.leadBcbaId !== requestingUserId && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only the team lead or admin can add members' 
      });
    }

    // Check if the new member is a therapist
    const newMember = await User.findByPk(newMemberId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });

    if (!newMember) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    const isTherapist = newMember.Roles.some(role => role.name === 'therapist');
    if (!isTherapist) {
      return res.status(400).json({ 
        message: 'Only therapists can be added as team members' 
      });
    }

    // Check if user is already in another team
    const existingTeam = await Team.findOne({
      include: [{
        model: User,
        as: 'Members',
        where: { id: newMemberId }
      }]
    });

    if (existingTeam && existingTeam.id !== id) {
      return res.status(400).json({ 
        message: 'Therapist is already in another team' 
      });
    }

    // Add member to team
    await team.addMember(newMember);

    // Return updated team
    const updatedTeam = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: 'LeadBCBA',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'Members',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          through: { attributes: [] }
        }
      ]
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ 
      message: 'Failed to add team member',
      error: error.message 
    });
  }
};

// Remove a member from a team
const removeTeamMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const requestingUserId = req.user.id;

    // Find the team
    const team = await Team.findByPk(id);
    
    if (!team) {
      return res.status(404).json({ 
        message: 'Team not found' 
      });
    }

    // Check if user is the lead BCBA or admin
    const currentUser = await User.findByPk(requestingUserId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });
    const isAdmin = currentUser.Roles.some(role => role.name === 'admin');
    
    if (team.leadBcbaId !== requestingUserId && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only the team lead or admin can remove members' 
      });
    }

    // Find the member
    const member = await User.findByPk(memberId);
    
    if (!member) {
      return res.status(404).json({ 
        message: 'Member not found' 
      });
    }

    // Remove member from team
    await team.removeMember(member);

    // Return updated team
    const updatedTeam = await Team.findByPk(id, {
      include: [
        {
          model: User,
          as: 'LeadBCBA',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'Members',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          through: { attributes: [] }
        }
      ]
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ 
      message: 'Failed to remove team member',
      error: error.message 
    });
  }
};

// Delete a team
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the team
    const team = await Team.findByPk(id, {
      include: [{
        model: User,
        as: 'Members'
      }]
    });
    
    if (!team) {
      return res.status(404).json({ 
        message: 'Team not found' 
      });
    }

    // Check if user is the lead BCBA or admin
    const currentUser = await User.findByPk(userId, {
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });
    const isAdmin = currentUser.Roles.some(role => role.name === 'admin');
    
    if (team.leadBcbaId !== userId && !isAdmin) {
      return res.status(403).json({ 
        message: 'Only the team lead or admin can delete the team' 
      });
    }

    // Log the team deletion for audit purposes
    console.log(`Deleting team ${team.name} (${team.id}) with ${team.Members?.length || 0} members`);

    // Delete the team (this will automatically remove all TeamMembers associations due to CASCADE)
    await team.destroy();

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ 
      message: 'Failed to delete team',
      error: error.message 
    });
  }
};

module.exports = {
  getTeams,
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam
};