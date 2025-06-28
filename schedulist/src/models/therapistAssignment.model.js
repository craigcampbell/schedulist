module.exports = (sequelize, DataTypes) => {
  const TherapistAssignment = sequelize.define('TherapistAssignment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Core references
    patientTimeBlockId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'PatientTimeBlocks',
        key: 'id'
      }
    },
    therapistId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Patients',
        key: 'id'
      },
      comment: 'Denormalized for easier querying'
    },
    // Assignment time details
    assignedDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'The date for this assignment'
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Start time of therapist assignment within the time block'
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'End time of therapist assignment within the time block'
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Duration of this assignment in minutes'
    },
    // Assignment type and status
    assignmentType: {
      type: DataTypes.ENUM('primary', 'substitute', 'backup', 'support'),
      defaultValue: 'primary',
      comment: 'Type of assignment - primary is main therapist, substitute fills in, etc.'
    },
    status: {
      type: DataTypes.ENUM('assigned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
      defaultValue: 'assigned'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    // Assignment method
    assignmentMethod: {
      type: DataTypes.ENUM('auto', 'manual', 'preferred', 'emergency'),
      defaultValue: 'auto',
      comment: 'How this assignment was created'
    },
    confidenceScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Auto-assignment confidence score (0.0-1.0) for assignments made by algorithm'
    },
    // Service details
    serviceType: {
      type: DataTypes.ENUM('direct', 'indirect', 'supervision', 'noOw', 'lunch', 'circle', 'cleaning'),
      allowNull: false,
      defaultValue: 'direct'
    },
    billableHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Actual billable hours for this assignment (may differ from duration)'
    },
    contractHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Hours to deduct from patient contract'
    },
    // Location and logistics
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Locations',
        key: 'id'
      }
    },
    travelTimeMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Estimated travel time to/from this assignment'
    },
    setupTimeMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Setup/preparation time for this assignment'
    },
    // Scheduling constraints and preferences
    isFlexible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Can this assignment be moved or modified'
    },
    canExtend: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Can this assignment be extended if needed'
    },
    canReduce: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Can this assignment be reduced if needed'
    },
    requiresPrep: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Does this assignment require preparation time'
    },
    // Continuity and consistency
    continuityGroupId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Groups assignments that should maintain therapist continuity'
    },
    previousAssignmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'TherapistAssignments',
        key: 'id'
      },
      comment: 'Links to previous assignment in a series for continuity tracking'
    },
    // Assignment quality metrics
    patientRapport: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'unknown'),
      defaultValue: 'unknown',
      comment: 'Quality of therapist-patient relationship'
    },
    skillMatch: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'unknown'),
      defaultValue: 'unknown',
      comment: 'How well therapist skills match patient needs'
    },
    // Notifications and communication
    therapistNotified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Has therapist been notified of this assignment'
    },
    notificationSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When notification was sent to therapist'
    },
    therapistConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When therapist confirmed the assignment'
    },
    // Notes and special instructions
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Assignment-specific notes and instructions'
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Internal notes not visible to therapist'
    },
    // Linked appointment
    appointmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Appointments',
        key: 'id'
      },
      comment: 'Links to the created appointment record'
    },
    // Metadata
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
    assignedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      comment: 'Who made this assignment (for manual assignments)'
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['patientTimeBlockId']
      },
      {
        fields: ['therapistId', 'assignedDate']
      },
      {
        fields: ['patientId', 'assignedDate']
      },
      {
        fields: ['assignedDate', 'startTime', 'endTime']
      },
      {
        fields: ['status']
      },
      {
        fields: ['locationId', 'assignedDate']
      },
      {
        fields: ['continuityGroupId']
      },
      {
        fields: ['assignmentType', 'status']
      },
      {
        unique: true,
        fields: ['therapistId', 'assignedDate', 'startTime', 'endTime'],
        name: 'unique_therapist_time_assignment'
      }
    ]
  });

  // Helper method to get full datetime objects
  TherapistAssignment.prototype.getStartDateTime = function() {
    const date = new Date(this.assignedDate);
    const [hours, minutes] = this.startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  TherapistAssignment.prototype.getEndDateTime = function() {
    const date = new Date(this.assignedDate);
    const [hours, minutes] = this.endTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Helper method to check if assignment overlaps with another time range
  TherapistAssignment.prototype.overlapsWithTime = function(startTime, endTime, date = null) {
    const assignmentDate = date || this.assignedDate;
    if (date && date !== this.assignedDate) return false;

    const assignmentStart = this.getStartDateTime();
    const assignmentEnd = this.getEndDateTime();
    const rangeStart = new Date(`${assignmentDate} ${startTime}`);
    const rangeEnd = new Date(`${assignmentDate} ${endTime}`);

    return assignmentStart < rangeEnd && assignmentEnd > rangeStart;
  };

  // Helper method to check if assignment conflicts with another assignment
  TherapistAssignment.prototype.conflictsWith = function(otherAssignment) {
    if (this.therapistId !== otherAssignment.therapistId) return false;
    if (this.assignedDate !== otherAssignment.assignedDate) return false;
    
    return this.overlapsWithTime(otherAssignment.startTime, otherAssignment.endTime);
  };

  // Helper method to calculate total time including prep and travel
  TherapistAssignment.prototype.getTotalTimeMinutes = function() {
    return this.durationMinutes + (this.travelTimeMinutes || 0) + (this.setupTimeMinutes || 0);
  };

  // Helper method to validate assignment
  TherapistAssignment.prototype.validateAssignment = function() {
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

    // Validate billable hours vs duration
    if (this.billableHours && this.billableHours > (this.durationMinutes / 60)) {
      errors.push('Billable hours cannot exceed assignment duration');
    }

    // Validate contract hours
    if (this.contractHours && this.contractHours > (this.durationMinutes / 60)) {
      errors.push('Contract hours cannot exceed assignment duration');
    }

    // Validate confidence score
    if (this.confidenceScore !== null && (this.confidenceScore < 0 || this.confidenceScore > 1)) {
      errors.push('Confidence score must be between 0 and 1');
    }

    return errors;
  };

  // Helper method to check if assignment needs confirmation
  TherapistAssignment.prototype.needsConfirmation = function() {
    return this.status === 'assigned' && !this.therapistConfirmedAt;
  };

  // Helper method to check if assignment is active
  TherapistAssignment.prototype.isActive = function() {
    return ['assigned', 'confirmed', 'in_progress'].includes(this.status);
  };

  // Helper method to check if assignment is completed
  TherapistAssignment.prototype.isCompleted = function() {
    return ['completed', 'cancelled', 'no_show'].includes(this.status);
  };

  // Static method to find conflicts for a therapist
  TherapistAssignment.findConflicts = async function(therapistId, date, startTime, endTime, excludeAssignmentId = null) {
    const whereClause = {
      therapistId,
      assignedDate: date,
      status: ['assigned', 'confirmed', 'in_progress']
    };

    if (excludeAssignmentId) {
      whereClause.id = { [sequelize.Sequelize.Op.ne]: excludeAssignmentId };
    }

    const assignments = await this.findAll({
      where: whereClause
    });

    return assignments.filter(assignment => 
      assignment.overlapsWithTime(startTime, endTime)
    );
  };

  // Static method to get therapist workload for a date
  TherapistAssignment.getTherapistWorkload = async function(therapistId, date) {
    const assignments = await this.findAll({
      where: {
        therapistId,
        assignedDate: date,
        status: ['assigned', 'confirmed', 'in_progress', 'completed']
      },
      order: [['startTime', 'ASC']]
    });

    const totalMinutes = assignments.reduce((sum, assignment) => {
      return sum + assignment.getTotalTimeMinutes();
    }, 0);

    return {
      assignments,
      totalMinutes,
      totalHours: totalMinutes / 60,
      assignmentCount: assignments.length
    };
  };

  return TherapistAssignment;
};