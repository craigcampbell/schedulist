module.exports = (sequelize, DataTypes) => {
  const PatientTimeBlock = sequelize.define('PatientTimeBlock', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Patients',
        key: 'id'
      }
    },
    scheduleTemplateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'PatientScheduleTemplates',
        key: 'id'
      },
      comment: 'Reference to the template that generated this block (null for manually created blocks)'
    },
    // Time block details
    blockDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'The specific date for this time block'
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Start time of the block (HH:MM format)'
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'End time of the block (HH:MM format)'
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Duration of the block in minutes'
    },
    // Service requirements
    serviceType: {
      type: DataTypes.ENUM('direct', 'indirect', 'supervision', 'noOw', 'lunch', 'circle', 'cleaning'),
      allowNull: false,
      defaultValue: 'direct'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      comment: 'Priority level for therapist assignment'
    },
    skillsRequired: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of required skills or certifications for assigned therapist'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special instructions or notes for this time block'
    },
    // Location and preferences
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Locations',
        key: 'id'
      }
    },
    preferredTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of preferred therapist UUIDs in priority order'
    },
    excludedTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of therapist UUIDs that should not be assigned to this block'
    },
    // Assignment status
    assignmentStatus: {
      type: DataTypes.ENUM('unassigned', 'assigned', 'covered', 'cancelled', 'completed'),
      defaultValue: 'unassigned'
    },
    coveragePercentage: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Percentage of time block covered by therapist assignments (0.0 - 1.0)'
    },
    // Scheduling constraints
    canSplit: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this block can be split among multiple therapists'
    },
    minimumContinuousMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minimum continuous time required from a single therapist'
    },
    requiresPrimaryTherapist: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this block requires the patients primary therapist'
    },
    allowSubstitutions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether substitute therapists are allowed for this block'
    },
    // Recurring and series information
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recurringGroupId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Groups related recurring time blocks together'
    },
    recurringPattern: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Pattern for recurring blocks: {frequency: "weekly", interval: 1, endDate: "2024-12-31"}'
    },
    // Status and metadata
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'),
      defaultValue: 'scheduled'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    updatedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['patientId', 'blockDate']
      },
      {
        fields: ['blockDate', 'startTime', 'endTime']
      },
      {
        fields: ['assignmentStatus']
      },
      {
        fields: ['locationId', 'blockDate']
      },
      {
        fields: ['scheduleTemplateId']
      },
      {
        fields: ['recurringGroupId']
      },
      {
        unique: true,
        fields: ['patientId', 'blockDate', 'startTime', 'endTime'],
        name: 'unique_patient_time_block'
      }
    ]
  });

  // Helper method to get full datetime objects
  PatientTimeBlock.prototype.getStartDateTime = function() {
    const date = new Date(this.blockDate);
    const [hours, minutes] = this.startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  PatientTimeBlock.prototype.getEndDateTime = function() {
    const date = new Date(this.blockDate);
    const [hours, minutes] = this.endTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Helper method to check if block overlaps with another time range
  PatientTimeBlock.prototype.overlapsWithTime = function(startTime, endTime, date = null) {
    const blockDate = date || this.blockDate;
    if (date && date !== this.blockDate) return false;

    const blockStart = this.getStartDateTime();
    const blockEnd = this.getEndDateTime();
    const rangeStart = new Date(`${blockDate} ${startTime}`);
    const rangeEnd = new Date(`${blockDate} ${endTime}`);

    return blockStart < rangeEnd && blockEnd > rangeStart;
  };

  // Helper method to check if fully covered by assignments
  PatientTimeBlock.prototype.isFullyCovered = function() {
    return this.coveragePercentage >= 1.0;
  };

  // Helper method to get coverage gaps
  PatientTimeBlock.prototype.getCoverageGaps = function(assignments = []) {
    if (!assignments.length) {
      return [{
        startTime: this.startTime,
        endTime: this.endTime,
        durationMinutes: this.durationMinutes
      }];
    }

    // Sort assignments by start time
    const sortedAssignments = assignments.sort((a, b) => {
      const timeA = new Date(`2000-01-01 ${a.startTime}`);
      const timeB = new Date(`2000-01-01 ${b.startTime}`);
      return timeA - timeB;
    });

    const gaps = [];
    let currentTime = this.startTime;

    sortedAssignments.forEach(assignment => {
      if (assignment.startTime > currentTime) {
        // Gap found
        const gapStart = new Date(`2000-01-01 ${currentTime}`);
        const gapEnd = new Date(`2000-01-01 ${assignment.startTime}`);
        const gapDuration = (gapEnd - gapStart) / (1000 * 60);

        gaps.push({
          startTime: currentTime,
          endTime: assignment.startTime,
          durationMinutes: gapDuration
        });
      }
      currentTime = assignment.endTime > currentTime ? assignment.endTime : currentTime;
    });

    // Check for gap at the end
    if (currentTime < this.endTime) {
      const gapStart = new Date(`2000-01-01 ${currentTime}`);
      const gapEnd = new Date(`2000-01-01 ${this.endTime}`);
      const gapDuration = (gapEnd - gapStart) / (1000 * 60);

      gaps.push({
        startTime: currentTime,
        endTime: this.endTime,
        durationMinutes: gapDuration
      });
    }

    return gaps;
  };

  // Helper method to validate time block
  PatientTimeBlock.prototype.validateBlock = function() {
    const errors = [];

    // Validate time format and logic
    const start = new Date(`2000-01-01 ${this.startTime}`);
    const end = new Date(`2000-01-01 ${this.endTime}`);
    const calculatedDuration = (end - start) / (1000 * 60);

    if (start >= end) {
      errors.push('End time must be after start time');
    }

    if (Math.abs(calculatedDuration - this.durationMinutes) > 1) {
      errors.push(`Duration mismatch: calculated ${calculatedDuration} minutes, stored ${this.durationMinutes} minutes`);
    }

    if (this.durationMinutes < this.minimumContinuousMinutes) {
      errors.push(`Block duration (${this.durationMinutes} min) is less than minimum continuous time (${this.minimumContinuousMinutes} min)`);
    }

    // Validate coverage percentage
    if (this.coveragePercentage < 0 || this.coveragePercentage > 1) {
      errors.push('Coverage percentage must be between 0 and 1');
    }

    return errors;
  };

  // Helper method to generate series of recurring blocks
  PatientTimeBlock.generateRecurringBlocks = function(templateBlock, startDate, endDate) {
    const blocks = [];
    
    if (!templateBlock.isRecurring || !templateBlock.recurringPattern) {
      return [templateBlock];
    }

    const pattern = templateBlock.recurringPattern;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const blockData = { ...templateBlock };
      blockData.blockDate = current.toISOString().split('T')[0];
      blockData.id = undefined; // Let database generate new ID
      
      blocks.push(blockData);

      // Advance by pattern interval
      switch (pattern.frequency) {
        case 'daily':
          current.setDate(current.getDate() + (pattern.interval || 1));
          break;
        case 'weekly':
          current.setDate(current.getDate() + (7 * (pattern.interval || 1)));
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + (pattern.interval || 1));
          break;
        default:
          current.setDate(current.getDate() + 1);
      }
    }

    return blocks;
  };

  return PatientTimeBlock;
};