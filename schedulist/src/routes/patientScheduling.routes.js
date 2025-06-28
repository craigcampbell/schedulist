const express = require('express');
const { check, validationResult } = require('express-validator');
const patientSchedulingController = require('../controllers/patientScheduling.controller');
const gapDetectionService = require('../services/gapDetection.service');
const { verifyToken, isBCBA, hasPatientAccess, authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Middleware to validate request data
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Apply auth middleware to all routes
router.use(verifyToken);

/**
 * PATIENT SCHEDULE TEMPLATE ROUTES
 */

// Create a new patient schedule template
router.post(
  '/templates',
  isBCBA,
  [
    check('patientId', 'Patient ID is required').isUUID(),
    check('name', 'Template name is required').not().isEmpty().isLength({ min: 1, max: 100 }),
    check('effectiveStartDate', 'Effective start date is required').isISO8601(),
    check('locationId', 'Location ID is required').isUUID(),
    check('weeklySchedule', 'Weekly schedule is required').isObject(),
  ],
  validate,
  patientSchedulingController.createScheduleTemplate
);

// Get schedule templates for a patient
router.get(
  '/templates/patient/:patientId',
  [
    check('patientId', 'Patient ID must be valid UUID').isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { PatientScheduleTemplate, Patient, Location, User } = require('../models');

      const templates = await PatientScheduleTemplate.findAll({
        where: { patientId },
        include: [
          {
            model: Patient,
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: Location,
            attributes: ['id', 'name']
          },
          {
            model: User,
            as: 'CreatedBy',
            attributes: ['id', 'firstName', 'lastName']
          }
        ],
        order: [['effectiveStartDate', 'DESC']]
      });

      return res.status(200).json({
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          effectiveStartDate: template.effectiveStartDate,
          effectiveEndDate: template.effectiveEndDate,
          status: template.status,
          isActive: template.isActive,
          totalWeeklyHours: template.getTotalWeeklyHours(),
          patient: template.Patient,
          location: template.Location,
          createdBy: template.CreatedBy,
          createdAt: template.createdAt
        }))
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error fetching schedule templates', 
        error: error.message 
      });
    }
  }
);

// Get a specific schedule template
router.get(
  '/templates/:templateId',
  [
    check('templateId', 'Template ID must be valid UUID').isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { PatientScheduleTemplate, Patient, Location } = require('../models');

      const template = await PatientScheduleTemplate.findByPk(templateId, {
        include: [
          { model: Patient, attributes: ['id', 'firstName', 'lastName'] },
          { model: Location, attributes: ['id', 'name'] }
        ]
      });

      if (!template) {
        return res.status(404).json({ message: 'Schedule template not found' });
      }

      return res.status(200).json({
        template: {
          ...template.toJSON(),
          weeklySchedule: {
            sunday: template.sundaySchedule,
            monday: template.mondaySchedule,
            tuesday: template.tuesdaySchedule,
            wednesday: template.wednesdaySchedule,
            thursday: template.thursdaySchedule,
            friday: template.fridaySchedule,
            saturday: template.saturdaySchedule
          },
          totalWeeklyHours: template.getTotalWeeklyHours(),
          validationErrors: template.validateSchedule()
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error fetching schedule template', 
        error: error.message 
      });
    }
  }
);

/**
 * TIME BLOCK GENERATION AND MANAGEMENT ROUTES
 */

// Generate time blocks from a template
router.post(
  '/templates/:templateId/generate',
  isBCBA,
  [
    check('templateId', 'Template ID must be valid UUID').isUUID(),
    check('weeksToGenerate', 'Weeks to generate must be a positive number').optional().isInt({ min: 1, max: 12 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { weeksToGenerate } = req.body;

      const blocksGenerated = await patientSchedulingController.generateTimeBlocksFromTemplate(
        templateId, 
        req.user.id
      );

      return res.status(201).json({
        message: 'Time blocks generated successfully',
        blocksGenerated
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error generating time blocks', 
        error: error.message 
      });
    }
  }
);

// Get patient time blocks for a date range
router.get(
  '/time-blocks/patient/:patientId',
  [
    check('patientId', 'Patient ID must be valid UUID').isUUID(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { startDate, endDate } = req.query;
      const { PatientTimeBlock, TherapistAssignment, User } = require('../models');
      const { Op } = require('sequelize');

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

      return res.status(200).json({
        timeBlocks: timeBlocks.map(block => ({
          id: block.id,
          blockDate: block.blockDate,
          startTime: block.startTime,
          endTime: block.endTime,
          durationMinutes: block.durationMinutes,
          serviceType: block.serviceType,
          assignmentStatus: block.assignmentStatus,
          coveragePercentage: block.coveragePercentage,
          priority: block.priority,
          canSplit: block.canSplit,
          assignments: block.Assignments,
          gaps: block.getCoverageGaps(block.Assignments)
        }))
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error fetching time blocks', 
        error: error.message 
      });
    }
  }
);

/**
 * THERAPIST ASSIGNMENT ROUTES
 */

// Auto-assign therapists to patient time blocks
router.post(
  '/assign/auto',
  isBCBA,
  [
    check('patientId', 'Patient ID is required').isUUID(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
  ],
  validate,
  patientSchedulingController.autoAssignTherapists
);

// Manually assign therapist to a time block
router.post(
  '/assign/manual',
  isBCBA,
  [
    check('timeBlockId', 'Time block ID is required').isUUID(),
    check('therapistId', 'Therapist ID is required').isUUID(),
    check('startTime', 'Start time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    check('endTime', 'End time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  ],
  validate,
  async (req, res) => {
    try {
      const { timeBlockId, therapistId, startTime, endTime, notes } = req.body;
      const { PatientTimeBlock, TherapistAssignment, User } = require('../models');

      // Get the time block
      const timeBlock = await PatientTimeBlock.findByPk(timeBlockId);
      if (!timeBlock) {
        return res.status(404).json({ message: 'Time block not found' });
      }

      // Verify therapist exists
      const therapist = await User.findByPk(therapistId);
      if (!therapist) {
        return res.status(404).json({ message: 'Therapist not found' });
      }

      // Calculate duration
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      const durationMinutes = (end - start) / (1000 * 60);

      // Check for conflicts
      const conflicts = await TherapistAssignment.findConflicts(
        therapistId,
        timeBlock.blockDate,
        startTime,
        endTime
      );

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          message: 'Therapist has conflicting assignments at this time',
          conflicts: conflicts.map(c => ({
            id: c.id,
            startTime: c.startTime,
            endTime: c.endTime,
            patientId: c.patientId
          }))
        });
      }

      // Create assignment
      const assignment = await TherapistAssignment.create({
        patientTimeBlockId: timeBlockId,
        therapistId,
        patientId: timeBlock.patientId,
        assignedDate: timeBlock.blockDate,
        startTime,
        endTime,
        durationMinutes,
        serviceType: timeBlock.serviceType,
        locationId: timeBlock.locationId,
        assignmentMethod: 'manual',
        priority: timeBlock.priority,
        notes,
        createdById: req.user.id,
        assignedById: req.user.id
      });

      // Update time block coverage
      const allAssignments = await TherapistAssignment.findAll({
        where: { patientTimeBlockId: timeBlockId }
      });
      
      const totalCoveredMinutes = allAssignments.reduce((sum, a) => sum + a.durationMinutes, 0);
      const coveragePercentage = Math.min(totalCoveredMinutes / timeBlock.durationMinutes, 1.0);

      await timeBlock.update({
        assignmentStatus: coveragePercentage >= 1.0 ? 'assigned' : 'partial',
        coveragePercentage,
        updatedById: req.user.id
      });

      return res.status(201).json({
        message: 'Therapist assigned successfully',
        assignment: {
          id: assignment.id,
          therapistId: assignment.therapistId,
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          durationMinutes: assignment.durationMinutes
        },
        updatedCoverage: coveragePercentage
      });

    } catch (error) {
      return res.status(500).json({ 
        message: 'Error creating manual assignment', 
        error: error.message 
      });
    }
  }
);

/**
 * COVERAGE ANALYSIS ROUTES
 */

// Get schedule coverage analysis
router.get(
  '/coverage',
  patientSchedulingController.getScheduleCoverage
);

// Get patient schedule overview
router.get(
  '/overview/patient/:patientId',
  [
    check('patientId', 'Patient ID must be valid UUID').isUUID(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
  ],
  validate,
  patientSchedulingController.getPatientScheduleOverview
);

/**
 * GAP DETECTION ROUTES
 */

// Detect coverage gaps for a patient
router.get(
  '/gaps/patient/:patientId',
  [
    check('patientId', 'Patient ID must be valid UUID').isUUID(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { startDate, endDate } = req.query;

      const gaps = await gapDetectionService.detectCoverageGaps(patientId, startDate, endDate);

      return res.status(200).json({
        gaps,
        summary: {
          totalGaps: gaps.length,
          totalGapMinutes: gaps.reduce((sum, gap) => sum + gap.totalGapMinutes, 0),
          criticalGaps: gaps.filter(g => g.severity === 'critical').length,
          highGaps: gaps.filter(g => g.severity === 'high').length
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error detecting coverage gaps', 
        error: error.message 
      });
    }
  }
);

// Get gap resolution options
router.post(
  '/gaps/resolve-options',
  isBCBA,
  [
    check('timeBlockId', 'Time block ID is required').isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { timeBlockId } = req.body;
      const { PatientTimeBlock } = require('../models');

      // Get the time block
      const timeBlock = await PatientTimeBlock.findByPk(timeBlockId);
      if (!timeBlock) {
        return res.status(404).json({ message: 'Time block not found' });
      }

      // Detect gaps for this specific time block
      const gaps = await gapDetectionService.detectCoverageGaps(
        timeBlock.patientId, 
        timeBlock.blockDate, 
        timeBlock.blockDate
      );

      const blockGap = gaps.find(g => g.timeBlockId === timeBlockId);
      if (!blockGap) {
        return res.status(200).json({ 
          message: 'No gaps found for this time block',
          resolutionOptions: []
        });
      }

      const resolutionOptions = await gapDetectionService.findGapResolutionOptions(blockGap);

      return res.status(200).json({
        gaps: blockGap.gaps,
        resolutionOptions
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error finding gap resolution options', 
        error: error.message 
      });
    }
  }
);

// Auto-resolve simple gaps
router.post(
  '/gaps/auto-resolve',
  isBCBA,
  [
    check('patientId', 'Patient ID is required').isUUID(),
    check('date', 'Date is required').isISO8601(),
    check('maxGapsToResolve', 'Max gaps must be a positive number').optional().isInt({ min: 1, max: 10 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { patientId, date, maxGapsToResolve = 5 } = req.body;

      const result = await gapDetectionService.autoResolveGaps(
        patientId, 
        date, 
        req.user.id,
        maxGapsToResolve
      );

      return res.status(200).json({
        message: 'Auto-resolution completed',
        ...result
      });
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error auto-resolving gaps', 
        error: error.message 
      });
    }
  }
);

// Generate location coverage report
router.get(
  '/coverage/location/:locationId/report',
  isBCBA,
  [
    check('locationId', 'Location ID must be valid UUID').isUUID(),
    check('startDate', 'Start date is required').isISO8601(),
    check('endDate', 'End date is required').isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const { locationId } = req.params;
      const { startDate, endDate } = req.query;

      const report = await gapDetectionService.generateLocationCoverageReport(
        locationId, 
        startDate, 
        endDate
      );

      return res.status(200).json(report);
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error generating coverage report', 
        error: error.message 
      });
    }
  }
);

module.exports = router;