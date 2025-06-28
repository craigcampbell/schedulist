module.exports = (sequelize, DataTypes) => {
  const PatientScheduleTemplate = sequelize.define('PatientScheduleTemplate', {
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Template name (e.g., "Weekly School Schedule", "Summer Intensive")'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Template description and notes'
    },
    effectiveStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When this schedule template becomes active'
    },
    effectiveEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this schedule template expires (null = indefinite)'
    },
    // Weekly schedule pattern
    mondaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks: [{startTime: "08:30", endTime: "17:30", serviceType: "direct", duration: 60}]'
    },
    tuesdaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Tuesday'
    },
    wednesdaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Wednesday'
    },
    thursdaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Thursday'
    },
    fridaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Friday'
    },
    saturdaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Saturday'
    },
    sundaySchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of time blocks for Sunday'
    },
    // Schedule preferences and constraints
    preferredTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of preferred therapist UUIDs in priority order'
    },
    excludedTherapistIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of therapist UUIDs that should not be assigned'
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Locations',
        key: 'id'
      },
      comment: 'Primary location for this schedule'
    },
    // Schedule settings
    allowSplitSessions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Allow multiple therapists for different time blocks in the same day'
    },
    minimumSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minimum session duration in minutes'
    },
    maximumSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 240,
      comment: 'Maximum session duration in minutes (4 hours)'
    },
    preferredSessionDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      comment: 'Preferred session duration in minutes'
    },
    // Auto-generation settings
    generateWeeksInAdvance: {
      type: DataTypes.INTEGER,
      defaultValue: 4,
      comment: 'How many weeks in advance to auto-generate schedule blocks'
    },
    autoAssignTherapists: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Automatically assign therapists based on availability and preferences'
    },
    // Status and metadata
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'),
      defaultValue: 'draft',
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      comment: 'BCBA who created this template'
    },
    updatedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      comment: 'Last user who updated this template'
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['patientId', 'isActive']
      },
      {
        fields: ['effectiveStartDate', 'effectiveEndDate']
      },
      {
        fields: ['locationId']
      }
    ]
  });

  // Helper method to get schedule for a specific day
  PatientScheduleTemplate.prototype.getScheduleForDay = function(dayOfWeek) {
    const dayNames = ['sundaySchedule', 'mondaySchedule', 'tuesdaySchedule', 'wednesdaySchedule', 'thursdaySchedule', 'fridaySchedule', 'saturdaySchedule'];
    return this[dayNames[dayOfWeek]] || [];
  };

  // Helper method to get total weekly hours
  PatientScheduleTemplate.prototype.getTotalWeeklyHours = function() {
    let totalMinutes = 0;
    const days = ['sundaySchedule', 'mondaySchedule', 'tuesdaySchedule', 'wednesdaySchedule', 'thursdaySchedule', 'fridaySchedule', 'saturdaySchedule'];
    
    days.forEach(daySchedule => {
      const schedule = this[daySchedule] || [];
      schedule.forEach(block => {
        if (block.duration) {
          totalMinutes += block.duration;
        } else if (block.startTime && block.endTime) {
          // Calculate duration from start/end times
          const start = new Date(`2000-01-01 ${block.startTime}`);
          const end = new Date(`2000-01-01 ${block.endTime}`);
          totalMinutes += (end - start) / (1000 * 60);
        }
      });
    });
    
    return totalMinutes / 60; // Convert to hours
  };

  // Helper method to validate schedule template
  PatientScheduleTemplate.prototype.validateSchedule = function() {
    const errors = [];
    const days = ['sundaySchedule', 'mondaySchedule', 'tuesdaySchedule', 'wednesdaySchedule', 'thursdaySchedule', 'fridaySchedule', 'saturdaySchedule'];
    
    days.forEach((daySchedule, dayIndex) => {
      const schedule = this[daySchedule] || [];
      
      // Check for overlapping time blocks
      for (let i = 0; i < schedule.length - 1; i++) {
        for (let j = i + 1; j < schedule.length; j++) {
          const block1 = schedule[i];
          const block2 = schedule[j];
          
          const start1 = new Date(`2000-01-01 ${block1.startTime}`);
          const end1 = new Date(`2000-01-01 ${block1.endTime}`);
          const start2 = new Date(`2000-01-01 ${block2.startTime}`);
          const end2 = new Date(`2000-01-01 ${block2.endTime}`);
          
          if ((start1 < end2 && end1 > start2)) {
            errors.push(`Overlapping time blocks on ${daySchedule}: ${block1.startTime}-${block1.endTime} and ${block2.startTime}-${block2.endTime}`);
          }
        }
      }
      
      // Validate time format and duration
      schedule.forEach((block, blockIndex) => {
        if (!block.startTime || !block.endTime) {
          errors.push(`Missing start or end time in ${daySchedule} block ${blockIndex}`);
        }
        
        if (block.startTime && block.endTime) {
          const start = new Date(`2000-01-01 ${block.startTime}`);
          const end = new Date(`2000-01-01 ${block.endTime}`);
          const duration = (end - start) / (1000 * 60);
          
          if (duration < this.minimumSessionDuration) {
            errors.push(`Session too short in ${daySchedule}: ${duration} minutes (minimum: ${this.minimumSessionDuration})`);
          }
          
          if (duration > this.maximumSessionDuration) {
            errors.push(`Session too long in ${daySchedule}: ${duration} minutes (maximum: ${this.maximumSessionDuration})`);
          }
        }
      });
    });
    
    return errors;
  };

  return PatientScheduleTemplate;
};