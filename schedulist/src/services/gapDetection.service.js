const { 
  PatientTimeBlock, 
  TherapistAssignment, 
  ScheduleCoverage, 
  Patient, 
  User,
  Location 
} = require('../models');
const { Op } = require('sequelize');

/**
 * Gap Detection and Coverage Analysis Service
 * 
 * This service provides comprehensive gap detection and coverage analysis
 * for patient schedules, identifying uncovered time slots and providing
 * recommendations for resolution.
 */

/**
 * Detect coverage gaps for a specific patient and date range
 */
const detectCoverageGaps = async (patientId, startDate, endDate) => {
  const gaps = [];

  // Get all time blocks for the patient in the date range
  const timeBlocks = await PatientTimeBlock.findAll({
    where: {
      patientId,
      blockDate: {
        [Op.between]: [startDate, endDate]
      },
      isActive: true,
      assignmentStatus: { [Op.in]: ['unassigned', 'assigned'] }
    },
    include: [
      {
        model: TherapistAssignment,
        as: 'Assignments',
        where: { 
          status: { [Op.in]: ['assigned', 'confirmed', 'in_progress'] }
        },
        required: false
      }
    ],
    order: [['blockDate', 'ASC'], ['startTime', 'ASC']]
  });

  // Analyze each time block for gaps
  for (const timeBlock of timeBlocks) {
    const blockGaps = analyzeTimeBlockGaps(timeBlock);
    
    if (blockGaps.length > 0) {
      gaps.push({
        timeBlockId: timeBlock.id,
        patientId: timeBlock.patientId,
        blockDate: timeBlock.blockDate,
        timeBlock: {
          startTime: timeBlock.startTime,
          endTime: timeBlock.endTime,
          durationMinutes: timeBlock.durationMinutes,
          serviceType: timeBlock.serviceType,
          priority: timeBlock.priority
        },
        gaps: blockGaps,
        totalGapMinutes: blockGaps.reduce((sum, gap) => sum + gap.durationMinutes, 0),
        coveragePercentage: calculateBlockCoveragePercentage(timeBlock),
        severity: calculateGapSeverity(blockGaps, timeBlock)
      });
    }
  }

  return gaps;
};

/**
 * Analyze gaps within a specific time block
 */
const analyzeTimeBlockGaps = (timeBlock) => {
  const assignments = timeBlock.Assignments || [];
  
  if (assignments.length === 0) {
    // Entire block is uncovered
    return [{
      type: 'uncovered',
      startTime: timeBlock.startTime,
      endTime: timeBlock.endTime,
      durationMinutes: timeBlock.durationMinutes,
      description: 'No therapist assigned to this time block'
    }];
  }

  // Sort assignments by start time
  const sortedAssignments = assignments.sort((a, b) => {
    const timeA = new Date(`2000-01-01 ${a.startTime}`);
    const timeB = new Date(`2000-01-01 ${b.startTime}`);
    return timeA - timeB;
  });

  const gaps = [];
  let currentTime = timeBlock.startTime;

  // Check for gaps between assignments
  for (const assignment of sortedAssignments) {
    if (assignment.startTime > currentTime) {
      // Gap found before this assignment
      const gapStart = new Date(`2000-01-01 ${currentTime}`);
      const gapEnd = new Date(`2000-01-01 ${assignment.startTime}`);
      const gapDuration = (gapEnd - gapStart) / (1000 * 60);

      gaps.push({
        type: 'partial',
        startTime: currentTime,
        endTime: assignment.startTime,
        durationMinutes: gapDuration,
        description: `Gap before assignment starting at ${assignment.startTime}`
      });
    }

    // Update current time to end of this assignment
    currentTime = assignment.endTime > currentTime ? assignment.endTime : currentTime;
  }

  // Check for gap at the end
  if (currentTime < timeBlock.endTime) {
    const gapStart = new Date(`2000-01-01 ${currentTime}`);
    const gapEnd = new Date(`2000-01-01 ${timeBlock.endTime}`);
    const gapDuration = (gapEnd - gapStart) / (1000 * 60);

    gaps.push({
      type: 'partial',
      startTime: currentTime,
      endTime: timeBlock.endTime,
      durationMinutes: gapDuration,
      description: `Gap after last assignment ending at ${currentTime}`
    });
  }

  return gaps;
};

/**
 * Calculate coverage percentage for a time block
 */
const calculateBlockCoveragePercentage = (timeBlock) => {
  const assignments = timeBlock.Assignments || [];
  
  if (assignments.length === 0) {
    return 0;
  }

  const totalCoveredMinutes = assignments.reduce((sum, assignment) => {
    return sum + assignment.durationMinutes;
  }, 0);

  return Math.min(totalCoveredMinutes / timeBlock.durationMinutes, 1.0);
};

/**
 * Calculate gap severity based on gaps and time block importance
 */
const calculateGapSeverity = (gaps, timeBlock) => {
  if (gaps.length === 0) return 'none';

  const totalGapMinutes = gaps.reduce((sum, gap) => sum + gap.durationMinutes, 0);
  const gapPercentage = totalGapMinutes / timeBlock.durationMinutes;

  // Factor in time block priority
  const priorityMultiplier = {
    'low': 1.0,
    'medium': 1.2,
    'high': 1.5,
    'critical': 2.0
  }[timeBlock.priority] || 1.0;

  const adjustedGapPercentage = gapPercentage * priorityMultiplier;

  if (adjustedGapPercentage >= 0.8) return 'critical';
  if (adjustedGapPercentage >= 0.5) return 'high';
  if (adjustedGapPercentage >= 0.2) return 'medium';
  return 'low';
};

/**
 * Find potential therapists to fill coverage gaps
 */
const findGapResolutionOptions = async (gapInfo) => {
  const { timeBlockId, blockDate, gaps } = gapInfo;

  // Get the time block with patient info
  const timeBlock = await PatientTimeBlock.findByPk(timeBlockId, {
    include: [
      {
        model: Patient,
        include: [{ model: Location, as: 'DefaultLocation' }]
      }
    ]
  });

  if (!timeBlock) {
    return [];
  }

  const resolutionOptions = [];

  // For each gap, find available therapists
  for (const gap of gaps) {
    const availableTherapists = await findAvailableTherapists(
      blockDate,
      gap.startTime,
      gap.endTime,
      timeBlock.locationId,
      timeBlock.Patient
    );

    const gapResolution = {
      gap,
      timeBlockId,
      availableTherapists: availableTherapists.map(therapist => ({
        therapistId: therapist.id,
        name: `${therapist.firstName} ${therapist.lastName}`,
        score: therapist.score,
        reason: therapist.reason,
        isPreferred: therapist.isPreferred,
        canCover: true,
        estimatedEffort: calculateAssignmentEffort(gap.durationMinutes, therapist)
      })),
      resolutionStrategies: generateResolutionStrategies(gap, availableTherapists, timeBlock)
    };

    resolutionOptions.push(gapResolution);
  }

  return resolutionOptions;
};

/**
 * Find available therapists for a specific time slot
 */
const findAvailableTherapists = async (date, startTime, endTime, locationId, patient) => {
  const { Role } = require('../models');
  
  // Get all therapists
  const allTherapists = await User.findAll({
    include: [
      {
        model: Role,
        where: { name: { [Op.in]: ['therapist', 'bcba'] } }
      }
    ],
    where: {
      isActive: true
    }
  });

  const availableTherapists = [];

  for (const therapist of allTherapists) {
    // Skip excluded therapists
    if (patient.excludedTherapistIds && patient.excludedTherapistIds.includes(therapist.id)) {
      continue;
    }

    // Check for conflicts
    const conflicts = await TherapistAssignment.findConflicts(
      therapist.id,
      date,
      startTime,
      endTime
    );

    if (conflicts.length > 0) {
      continue;
    }

    // Calculate availability score
    const score = await calculateTherapistAvailabilityScore(
      therapist,
      date,
      startTime,
      endTime,
      patient
    );

    availableTherapists.push({
      ...therapist.toJSON(),
      score,
      reason: generateAvailabilityReason(therapist, patient, score),
      isPreferred: patient.preferredTherapistIds && patient.preferredTherapistIds.includes(therapist.id)
    });
  }

  // Sort by score (best first)
  return availableTherapists.sort((a, b) => b.score - a.score);
};

/**
 * Calculate therapist availability score for gap filling
 */
const calculateTherapistAvailabilityScore = async (therapist, date, startTime, endTime, patient) => {
  let score = 0.5; // Base score

  // Preferred therapist bonus
  if (patient.preferredTherapistIds && patient.preferredTherapistIds.includes(therapist.id)) {
    const preferenceIndex = patient.preferredTherapistIds.indexOf(therapist.id);
    score += 0.3 - (preferenceIndex * 0.05);
  }

  // Check current workload
  const workload = await TherapistAssignment.getTherapistWorkload(therapist.id, date);
  
  // Prefer therapists with moderate workload (not too light, not too heavy)
  if (workload.totalHours >= 2 && workload.totalHours <= 6) {
    score += 0.1;
  } else if (workload.totalHours > 7) {
    score -= 0.15;
  }

  // Continuity bonus - has worked with this patient recently
  const recentAssignments = await TherapistAssignment.findAll({
    where: {
      patientId: patient.id,
      therapistId: therapist.id,
      assignedDate: {
        [Op.gte]: new Date(new Date(date).getTime() - (14 * 24 * 60 * 60 * 1000)) // Last 14 days
      }
    },
    limit: 3
  });

  if (recentAssignments.length > 0) {
    score += 0.15 + (recentAssignments.length * 0.05); // More recent work = higher score
  }

  // Same-day continuity bonus - already assigned to this patient today
  const sameDayAssignments = await TherapistAssignment.findAll({
    where: {
      patientId: patient.id,
      therapistId: therapist.id,
      assignedDate: date
    }
  });

  if (sameDayAssignments.length > 0) {
    score += 0.2; // Strong preference for same therapist
  }

  return Math.min(score, 1.0);
};

/**
 * Generate human-readable reason for therapist availability
 */
const generateAvailabilityReason = (therapist, patient, score) => {
  const reasons = [];

  if (patient.preferredTherapistIds && patient.preferredTherapistIds.includes(therapist.id)) {
    reasons.push('Preferred therapist');
  }

  if (score > 0.8) {
    reasons.push('Excellent match');
  } else if (score > 0.6) {
    reasons.push('Good match');
  } else if (score > 0.4) {
    reasons.push('Available');
  } else {
    reasons.push('Limited availability');
  }

  return reasons.join(', ');
};

/**
 * Calculate effort required for assignment
 */
const calculateAssignmentEffort = (durationMinutes, therapist) => {
  // Base effort calculation
  let effort = 'low';

  if (durationMinutes >= 120) {
    effort = 'high';
  } else if (durationMinutes >= 60) {
    effort = 'medium';
  }

  return effort;
};

/**
 * Generate resolution strategies for a gap
 */
const generateResolutionStrategies = (gap, availableTherapists, timeBlock) => {
  const strategies = [];

  if (availableTherapists.length > 0) {
    // Strategy 1: Direct assignment to best available therapist
    strategies.push({
      type: 'direct_assignment',
      description: `Assign ${availableTherapists[0].firstName} ${availableTherapists[0].lastName} to cover the ${gap.durationMinutes}-minute gap`,
      therapistId: availableTherapists[0].id,
      confidence: availableTherapists[0].score,
      effort: 'low',
      impact: gap.durationMinutes >= 60 ? 'high' : 'medium'
    });

    // Strategy 2: Split assignment if gap is large and multiple therapists available
    if (gap.durationMinutes >= 60 && availableTherapists.length >= 2 && timeBlock.canSplit) {
      strategies.push({
        type: 'split_assignment',
        description: `Split the ${gap.durationMinutes}-minute gap between multiple therapists`,
        therapistIds: availableTherapists.slice(0, 2).map(t => t.id),
        confidence: Math.min(...availableTherapists.slice(0, 2).map(t => t.score)),
        effort: 'medium',
        impact: 'high'
      });
    }
  }

  // Strategy 3: Extend existing assignment if applicable
  if (timeBlock.Assignments && timeBlock.Assignments.length > 0) {
    strategies.push({
      type: 'extend_assignment',
      description: `Extend an existing assignment to cover the gap`,
      existingAssignmentId: timeBlock.Assignments[0].id,
      confidence: 0.7,
      effort: 'low',
      impact: 'medium'
    });
  }

  // Strategy 4: Reschedule recommendation if no immediate solution
  if (availableTherapists.length === 0) {
    strategies.push({
      type: 'reschedule',
      description: `Consider rescheduling this ${gap.durationMinutes}-minute session to a time with better therapist availability`,
      confidence: 0.5,
      effort: 'high',
      impact: 'medium'
    });
  }

  return strategies;
};

/**
 * Generate comprehensive coverage report for location
 */
const generateLocationCoverageReport = async (locationId, startDate, endDate) => {
  // Get all patients with time blocks at this location
  const patientCoverages = await ScheduleCoverage.findAll({
    where: {
      locationId,
      coverageDate: {
        [Op.between]: [startDate, endDate]
      }
    },
    include: [
      {
        model: Patient,
        attributes: ['id', 'firstName', 'lastName', 'requiredWeeklyHours']
      }
    ],
    order: [
      ['coverageDate', 'ASC'],
      ['requiresAttention', 'DESC'],
      ['alertLevel', 'DESC']
    ]
  });

  // Detect gaps for all patients
  const allGaps = [];
  const patientIds = [...new Set(patientCoverages.map(pc => pc.patientId))];
  
  for (const patientId of patientIds) {
    const patientGaps = await detectCoverageGaps(patientId, startDate, endDate);
    allGaps.push(...patientGaps);
  }

  // Categorize gaps by severity
  const gapsBySeverity = {
    critical: allGaps.filter(g => g.severity === 'critical'),
    high: allGaps.filter(g => g.severity === 'high'),
    medium: allGaps.filter(g => g.severity === 'medium'),
    low: allGaps.filter(g => g.severity === 'low')
  };

  // Calculate summary statistics
  const totalGapMinutes = allGaps.reduce((sum, gap) => sum + gap.totalGapMinutes, 0);
  const averageCoverage = patientCoverages.length > 0 
    ? patientCoverages.reduce((sum, pc) => sum + pc.coveragePercentage, 0) / patientCoverages.length 
    : 0;

  // Find resolution options for critical and high severity gaps
  const priorityGaps = [...gapsBySeverity.critical, ...gapsBySeverity.high];
  const resolutionOptions = [];

  for (const gap of priorityGaps.slice(0, 10)) { // Limit to top 10 for performance
    const options = await findGapResolutionOptions(gap);
    resolutionOptions.push(...options);
  }

  return {
    summary: {
      totalPatients: patientIds.length,
      totalGaps: allGaps.length,
      totalGapMinutes,
      averageCoverage,
      criticalAlerts: patientCoverages.filter(pc => pc.alertLevel === 'critical').length,
      requiresAttention: patientCoverages.filter(pc => pc.requiresAttention).length
    },
    gapsBySeverity,
    patientCoverages: patientCoverages.map(pc => ({
      patientId: pc.patientId,
      patient: pc.Patient,
      coverageDate: pc.coverageDate,
      coveragePercentage: pc.coveragePercentage,
      alertLevel: pc.alertLevel,
      totalGapMinutes: pc.totalGapMinutes,
      recommendations: pc.recommendations
    })),
    resolutionOptions: resolutionOptions.slice(0, 20), // Top 20 resolution options
    dateRange: { startDate, endDate }
  };
};

/**
 * Auto-resolve simple gaps using available therapists
 */
const autoResolveGaps = async (patientId, date, userId, maxGapsToResolve = 5) => {
  const gaps = await detectCoverageGaps(patientId, date, date);
  const resolved = [];
  const failed = [];

  // Sort gaps by severity (critical first)
  const sortedGaps = gaps.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  // Attempt to resolve top gaps
  for (const gapInfo of sortedGaps.slice(0, maxGapsToResolve)) {
    try {
      const resolutionOptions = await findGapResolutionOptions(gapInfo);
      
      if (resolutionOptions.length > 0) {
        const bestOption = resolutionOptions[0];
        const directStrategy = bestOption.resolutionStrategies.find(s => s.type === 'direct_assignment');
        
        if (directStrategy && directStrategy.confidence > 0.6) {
          // Auto-assign the best available therapist
          for (const gap of gapInfo.gaps) {
            await TherapistAssignment.create({
              patientTimeBlockId: gapInfo.timeBlockId,
              therapistId: directStrategy.therapistId,
              patientId: gapInfo.patientId,
              assignedDate: gapInfo.blockDate,
              startTime: gap.startTime,
              endTime: gap.endTime,
              durationMinutes: gap.durationMinutes,
              serviceType: gapInfo.timeBlock.serviceType,
              locationId: gapInfo.timeBlock.locationId,
              assignmentMethod: 'auto',
              confidenceScore: directStrategy.confidence,
              createdById: userId,
              assignedById: userId
            });
          }

          // Update time block coverage
          await PatientTimeBlock.update(
            { 
              assignmentStatus: 'assigned',
              coveragePercentage: 1.0,
              updatedById: userId
            },
            { where: { id: gapInfo.timeBlockId } }
          );

          resolved.push({
            timeBlockId: gapInfo.timeBlockId,
            gaps: gapInfo.gaps,
            assignedTherapistId: directStrategy.therapistId,
            confidence: directStrategy.confidence
          });
        }
      }
    } catch (error) {
      failed.push({
        timeBlockId: gapInfo.timeBlockId,
        error: error.message
      });
    }
  }

  // Regenerate coverage analysis
  if (resolved.length > 0) {
    const { generateCoverageAnalysis } = require('../controllers/patientScheduling.controller');
    await generateCoverageAnalysis(patientId, date, userId);
  }

  return {
    resolved,
    failed,
    totalGapsProcessed: Math.min(sortedGaps.length, maxGapsToResolve)
  };
};

module.exports = {
  detectCoverageGaps,
  analyzeTimeBlockGaps,
  calculateBlockCoveragePercentage,
  calculateGapSeverity,
  findGapResolutionOptions,
  findAvailableTherapists,
  generateLocationCoverageReport,
  autoResolveGaps
};