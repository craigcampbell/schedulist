const { 
  Patient, 
  PatientScheduleTemplate, 
  PatientTimeBlock, 
  TherapistAssignment, 
  ScheduleCoverage, 
  User, 
  Location, 
  Appointment 
} = require('../models');
const { Op } = require('sequelize');

/**
 * Create a patient schedule template
 */
const createScheduleTemplate = async (req, res) => {
  try {
    const {
      patientId,
      name,
      description,
      effectiveStartDate,
      effectiveEndDate,
      locationId,
      weeklySchedule,
      preferences = {},
      settings = {}
    } = req.body;

    // Validate patient exists
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Validate location exists
    const location = await Location.findByPk(locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Create schedule template
    const template = await PatientScheduleTemplate.create({
      patientId,
      name,
      description,
      effectiveStartDate,
      effectiveEndDate,
      locationId,
      mondaySchedule: weeklySchedule.monday || [],
      tuesdaySchedule: weeklySchedule.tuesday || [],
      wednesdaySchedule: weeklySchedule.wednesday || [],
      thursdaySchedule: weeklySchedule.thursday || [],
      fridaySchedule: weeklySchedule.friday || [],
      saturdaySchedule: weeklySchedule.saturday || [],
      sundaySchedule: weeklySchedule.sunday || [],
      preferredTherapistIds: preferences.preferredTherapistIds || [],
      excludedTherapistIds: preferences.excludedTherapistIds || [],
      allowSplitSessions: settings.allowSplitSessions !== undefined ? settings.allowSplitSessions : true,
      minimumSessionDuration: settings.minimumSessionDuration || 30,
      maximumSessionDuration: settings.maximumSessionDuration || 240,
      preferredSessionDuration: settings.preferredSessionDuration || 60,
      generateWeeksInAdvance: settings.generateWeeksInAdvance || 4,
      autoAssignTherapists: settings.autoAssignTherapists !== undefined ? settings.autoAssignTherapists : true,
      createdById: req.user.id,
      status: 'active'
    });

    // Validate the schedule
    const validationErrors = template.validateSchedule();
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Schedule validation failed', 
        errors: validationErrors 
      });
    }

    // Auto-generate time blocks if requested
    if (req.body.generateTimeBlocks) {
      await generateTimeBlocksFromTemplate(template.id, req.user.id);
    }

    return res.status(201).json({
      message: 'Schedule template created successfully',
      template: {
        id: template.id,
        name: template.name,
        status: template.status,
        totalWeeklyHours: template.getTotalWeeklyHours()
      }
    });

  } catch (error) {
    console.error('Error creating schedule template:', error);
    return res.status(500).json({ 
      message: 'Error creating schedule template', 
      error: error.message 
    });
  }
};

/**
 * Generate time blocks from a schedule template
 */
const generateTimeBlocksFromTemplate = async (templateId, userId) => {
  const template = await PatientScheduleTemplate.findByPk(templateId);
  if (!template) {
    throw new Error('Schedule template not found');
  }

  const startDate = new Date(template.effectiveStartDate);
  const weeksToGenerate = template.generateWeeksInAdvance;
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (weeksToGenerate * 7));

  const timeBlocks = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daySchedule = template.getScheduleForDay(dayOfWeek);

    if (daySchedule && daySchedule.length > 0) {
      for (const scheduleBlock of daySchedule) {
        // Calculate duration if not provided
        let durationMinutes = scheduleBlock.duration;
        if (!durationMinutes && scheduleBlock.startTime && scheduleBlock.endTime) {
          const start = new Date(`2000-01-01 ${scheduleBlock.startTime}`);
          const end = new Date(`2000-01-01 ${scheduleBlock.endTime}`);
          durationMinutes = (end - start) / (1000 * 60);
        }

        const timeBlock = {
          patientId: template.patientId,
          scheduleTemplateId: template.id,
          blockDate: currentDate.toISOString().split('T')[0],
          startTime: scheduleBlock.startTime,
          endTime: scheduleBlock.endTime,
          durationMinutes: durationMinutes,
          serviceType: scheduleBlock.serviceType || 'direct',
          priority: scheduleBlock.priority || 'medium',
          locationId: template.locationId,
          preferredTherapistIds: template.preferredTherapistIds,
          excludedTherapistIds: template.excludedTherapistIds,
          canSplit: template.allowSplitSessions,
          minimumContinuousMinutes: template.minimumSessionDuration,
          isRecurring: true,
          assignmentStatus: 'unassigned',
          createdById: userId
        };

        timeBlocks.push(timeBlock);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Bulk create time blocks
  if (timeBlocks.length > 0) {
    await PatientTimeBlock.bulkCreate(timeBlocks);
  }

  return timeBlocks.length;
};

/**
 * Auto-assign therapists to patient time blocks
 */
const autoAssignTherapists = async (req, res) => {
  try {
    const { 
      patientId, 
      startDate, 
      endDate, 
      forceReassign = false,
      prioritizePreferred = true 
    } = req.body;

    // Get unassigned time blocks for the patient in the date range
    const whereClause = {
      patientId,
      blockDate: {
        [Op.between]: [startDate, endDate]
      }
    };

    if (!forceReassign) {
      whereClause.assignmentStatus = 'unassigned';
    }

    const timeBlocks = await PatientTimeBlock.findAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          include: [{ model: Location, as: 'DefaultLocation' }]
        }
      ],
      order: [['blockDate', 'ASC'], ['startTime', 'ASC']]
    });

    if (timeBlocks.length === 0) {
      return res.status(200).json({ 
        message: 'No time blocks found for assignment',
        assignedCount: 0
      });
    }

    const assignmentResults = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process each time block
    for (const timeBlock of timeBlocks) {
      try {
        const assignment = await findBestTherapistAssignment(timeBlock, prioritizePreferred);
        
        if (assignment) {
          // Create the therapist assignment
          await TherapistAssignment.create({
            patientTimeBlockId: timeBlock.id,
            therapistId: assignment.therapistId,
            patientId: timeBlock.patientId,
            assignedDate: timeBlock.blockDate,
            startTime: timeBlock.startTime,
            endTime: timeBlock.endTime,
            durationMinutes: timeBlock.durationMinutes,
            serviceType: timeBlock.serviceType,
            locationId: timeBlock.locationId,
            assignmentMethod: assignment.method,
            confidenceScore: assignment.confidenceScore,
            priority: timeBlock.priority,
            createdById: req.user.id,
            assignedById: req.user.id
          });

          // Update time block status
          await timeBlock.update({
            assignmentStatus: 'assigned',
            coveragePercentage: 1.0,
            updatedById: req.user.id
          });

          assignmentResults.successful++;
        } else {
          assignmentResults.failed++;
          assignmentResults.errors.push({
            timeBlockId: timeBlock.id,
            date: timeBlock.blockDate,
            time: `${timeBlock.startTime}-${timeBlock.endTime}`,
            reason: 'No available therapist found'
          });
        }
      } catch (error) {
        assignmentResults.failed++;
        assignmentResults.errors.push({
          timeBlockId: timeBlock.id,
          date: timeBlock.blockDate,
          time: `${timeBlock.startTime}-${timeBlock.endTime}`,
          reason: error.message
        });
      }
    }

    // Generate coverage analysis for the affected dates
    const uniqueDates = [...new Set(timeBlocks.map(tb => tb.blockDate))];
    for (const date of uniqueDates) {
      await generateCoverageAnalysis(patientId, date, req.user.id);
    }

    return res.status(200).json({
      message: 'Auto-assignment completed',
      results: assignmentResults,
      totalBlocks: timeBlocks.length
    });

  } catch (error) {
    console.error('Error in auto-assignment:', error);
    return res.status(500).json({ 
      message: 'Error during auto-assignment', 
      error: error.message 
    });
  }
};

/**
 * Find the best therapist for a time block assignment
 */
const findBestTherapistAssignment = async (timeBlock, prioritizePreferred = true) => {
  const patient = timeBlock.Patient;
  const blockDate = timeBlock.blockDate;
  const startTime = timeBlock.startTime;
  const endTime = timeBlock.endTime;

  // Get available therapists for this location
  const { Role } = require('../models');
  const availableTherapists = await User.findAll({
    include: [
      {
        model: Role,
        where: { name: { [Op.in]: ['therapist', 'bcba'] } }
      }
    ],
    where: {
      isActive: true,
      // Add location filtering if needed
    }
  });

  if (availableTherapists.length === 0) {
    return null;
  }

  const candidateScores = [];

  for (const therapist of availableTherapists) {
    // Skip excluded therapists
    if (patient.excludedTherapistIds && patient.excludedTherapistIds.includes(therapist.id)) {
      continue;
    }

    // Check for conflicts
    const conflicts = await TherapistAssignment.findConflicts(
      therapist.id, 
      blockDate, 
      startTime, 
      endTime
    );

    if (conflicts.length > 0) {
      continue; // Skip therapists with conflicts
    }

    // Calculate assignment score
    let score = 0.5; // Base score

    // Preferred therapist bonus
    if (prioritizePreferred && patient.preferredTherapistIds) {
      const preferenceIndex = patient.preferredTherapistIds.indexOf(therapist.id);
      if (preferenceIndex !== -1) {
        score += 0.3 - (preferenceIndex * 0.05); // Higher score for higher preference
      }
    }

    // Check workload for the day
    const workload = await TherapistAssignment.getTherapistWorkload(therapist.id, blockDate);
    
    // Prefer therapists with lighter workload (but not zero - some consistency is good)
    if (workload.totalHours < 4) {
      score += 0.1;
    } else if (workload.totalHours > 7) {
      score -= 0.1;
    }

    // Continuity bonus - check if therapist worked with this patient recently
    const recentAssignments = await TherapistAssignment.findAll({
      where: {
        patientId: timeBlock.patientId,
        therapistId: therapist.id,
        assignedDate: {
          [Op.gte]: new Date(new Date(blockDate).getTime() - (7 * 24 * 60 * 60 * 1000)) // Last 7 days
        }
      },
      limit: 1
    });

    if (recentAssignments.length > 0) {
      score += 0.15; // Continuity bonus
    }

    candidateScores.push({
      therapistId: therapist.id,
      score: score,
      method: patient.preferredTherapistIds && patient.preferredTherapistIds.includes(therapist.id) ? 'preferred' : 'auto'
    });
  }

  // Sort by score (highest first) and return best candidate
  candidateScores.sort((a, b) => b.score - a.score);
  
  if (candidateScores.length > 0) {
    const best = candidateScores[0];
    return {
      therapistId: best.therapistId,
      method: best.method,
      confidenceScore: best.score
    };
  }

  return null;
};

/**
 * Generate coverage analysis for a patient on a specific date
 */
const generateCoverageAnalysis = async (patientId, coverageDate, userId = null) => {
  // Get all time blocks for this patient on this date
  const timeBlocks = await PatientTimeBlock.findAll({
    where: {
      patientId,
      blockDate: coverageDate,
      isActive: true
    },
    include: [
      {
        model: TherapistAssignment,
        as: 'Assignments',
        where: { status: ['assigned', 'confirmed', 'in_progress', 'completed'] },
        required: false
      }
    ]
  });

  // Get all assignments for this patient on this date
  const assignments = await TherapistAssignment.findAll({
    where: {
      patientId,
      assignedDate: coverageDate,
      status: ['assigned', 'confirmed', 'in_progress', 'completed']
    }
  });

  // Calculate coverage metrics
  const coverageData = await ScheduleCoverage.calculateCoverage(
    patientId, 
    coverageDate, 
    timeBlocks, 
    assignments
  );

  // Find or create coverage record
  const [coverage, created] = await ScheduleCoverage.findOrCreate({
    where: { patientId, coverageDate },
    defaults: {
      ...coverageData,
      locationId: timeBlocks[0]?.locationId,
      createdById: userId
    }
  });

  if (!created) {
    // Update existing coverage record
    await coverage.update({
      ...coverageData,
      calculatedAt: new Date(),
      isStale: false,
      staleSince: null
    });
  }

  // Update coverage status and generate recommendations
  coverage.updateCoverageStatus();
  coverage.calculateQualityScores(assignments);
  coverage.generateRecommendations();

  await coverage.save();

  return coverage;
};

/**
 * Get schedule coverage analysis
 */
const getScheduleCoverage = async (req, res) => {
  try {
    const { patientId, startDate, endDate, locationId } = req.query;

    const whereClause = {};
    
    if (patientId) {
      whereClause.patientId = patientId;
    }
    
    if (locationId) {
      whereClause.locationId = locationId;
    }

    if (startDate && endDate) {
      whereClause.coverageDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.coverageDate = {
        [Op.gte]: startDate
      };
    }

    const coverages = await ScheduleCoverage.findAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          attributes: ['id', 'firstName', 'lastName', 'status']
        },
        {
          model: User,
          as: 'PrimaryTherapist',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Location,
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['coverageDate', 'DESC'],
        ['requiresAttention', 'DESC'],
        ['alertLevel', 'DESC']
      ]
    });

    // Get summary statistics if multiple records
    let summary = null;
    if (coverages.length > 1) {
      summary = await ScheduleCoverage.getCoverageSummary(
        locationId, 
        startDate, 
        endDate
      );
    }

    return res.status(200).json({
      coverages: coverages.map(coverage => ({
        id: coverage.id,
        patientId: coverage.patientId,
        patient: coverage.Patient,
        coverageDate: coverage.coverageDate,
        coveragePercentage: coverage.coveragePercentage,
        coverageStatus: coverage.coverageStatus,
        alertLevel: coverage.alertLevel,
        requiresAttention: coverage.requiresAttention,
        totalGapMinutes: coverage.totalGapMinutes,
        gapCount: coverage.gapCount,
        totalTherapists: coverage.totalTherapists,
        primaryTherapist: coverage.PrimaryTherapist,
        recommendations: coverage.recommendations,
        calculatedAt: coverage.calculatedAt
      })),
      summary
    });

  } catch (error) {
    console.error('Error getting schedule coverage:', error);
    return res.status(500).json({ 
      message: 'Error getting schedule coverage', 
      error: error.message 
    });
  }
};

/**
 * Get patient schedule overview
 */
const getPatientScheduleOverview = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate } = req.query;

    // Get patient with schedule preferences
    const patient = await Patient.findByPk(patientId, {
      include: [
        { model: Location, as: 'DefaultLocation' },
        { model: User, as: 'PrimaryBCBA' },
        { 
          model: PatientScheduleTemplate, 
          as: 'ScheduleTemplates',
          where: { isActive: true },
          required: false
        }
      ]
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get time blocks for the date range
    const timeBlocks = await PatientTimeBlock.findAll({
      where: {
        patientId,
        blockDate: {
          [Op.between]: [startDate, endDate]
        },
        isActive: true
      },
      include: [
        {
          model: TherapistAssignment,
          as: 'Assignments',
          include: [
            {
              model: User,
              as: 'Therapist',
              attributes: ['id', 'firstName', 'lastName']
            }
          ]
        }
      ],
      order: [['blockDate', 'ASC'], ['startTime', 'ASC']]
    });

    // Get coverage data for the date range
    const coverages = await ScheduleCoverage.findAll({
      where: {
        patientId,
        coverageDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['coverageDate', 'ASC']]
    });

    // Calculate schedule statistics
    const totalBlocks = timeBlocks.length;
    const assignedBlocks = timeBlocks.filter(block => block.assignmentStatus === 'assigned').length;
    const totalRequiredHours = timeBlocks.reduce((sum, block) => sum + (block.durationMinutes / 60), 0);
    const totalAssignedHours = timeBlocks.reduce((sum, block) => {
      return sum + block.Assignments.reduce((assignSum, assignment) => {
        return assignSum + (assignment.durationMinutes / 60);
      }, 0);
    }, 0);

    const alertCounts = coverages.reduce((counts, coverage) => {
      counts[coverage.alertLevel] = (counts[coverage.alertLevel] || 0) + 1;
      return counts;
    }, {});

    return res.status(200).json({
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        requiredWeeklyHours: patient.requiredWeeklyHours,
        defaultLocation: patient.DefaultLocation,
        primaryBCBA: patient.PrimaryBCBA,
        scheduleTemplates: patient.ScheduleTemplates
      },
      schedule: {
        totalBlocks,
        assignedBlocks,
        unassignedBlocks: totalBlocks - assignedBlocks,
        coveragePercentage: totalRequiredHours > 0 ? (totalAssignedHours / totalRequiredHours) : 0,
        totalRequiredHours,
        totalAssignedHours,
        timeBlocks: timeBlocks.map(block => ({
          id: block.id,
          blockDate: block.blockDate,
          startTime: block.startTime,
          endTime: block.endTime,
          durationMinutes: block.durationMinutes,
          serviceType: block.serviceType,
          assignmentStatus: block.assignmentStatus,
          assignments: block.Assignments
        }))
      },
      coverage: {
        alertCounts,
        requiresAttention: coverages.filter(c => c.requiresAttention).length,
        averageCoverage: coverages.length > 0 
          ? coverages.reduce((sum, c) => sum + c.coveragePercentage, 0) / coverages.length 
          : 0,
        dailyCoverage: coverages
      }
    });

  } catch (error) {
    console.error('Error getting patient schedule overview:', error);
    return res.status(500).json({ 
      message: 'Error getting patient schedule overview', 
      error: error.message 
    });
  }
};

module.exports = {
  createScheduleTemplate,
  generateTimeBlocksFromTemplate,
  autoAssignTherapists,
  findBestTherapistAssignment,
  generateCoverageAnalysis,
  getScheduleCoverage,
  getPatientScheduleOverview
};