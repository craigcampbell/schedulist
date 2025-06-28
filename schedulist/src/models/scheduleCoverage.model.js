module.exports = (sequelize, DataTypes) => {
  const ScheduleCoverage = sequelize.define('ScheduleCoverage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Core references
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Patients',
        key: 'id'
      }
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Locations',
        key: 'id'
      }
    },
    // Coverage period
    coverageDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'The date this coverage analysis applies to'
    },
    // Coverage analysis results
    totalRequiredMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Total minutes of therapy required for this patient on this date'
    },
    totalCoveredMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total minutes covered by therapist assignments'
    },
    totalGapMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total minutes not covered (gaps in schedule)'
    },
    coveragePercentage: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Percentage of required time covered (0.0 - 1.0)'
    },
    // Coverage quality metrics
    continuityScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Score indicating continuity of care (fewer therapist switches = higher score)'
    },
    preferenceScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Score indicating how well assignments match patient preferences'
    },
    skillMatchScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Score indicating how well therapist skills match patient needs'
    },
    // Gap analysis
    gapCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of uncovered time gaps'
    },
    largestGapMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Duration of the largest coverage gap in minutes'
    },
    criticalGaps: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of critical gaps: [{startTime, endTime, durationMinutes, priority}]'
    },
    // Coverage status and alerts
    coverageStatus: {
      type: DataTypes.ENUM('full', 'partial', 'minimal', 'uncovered', 'overbooked'),
      allowNull: false,
      comment: 'Overall coverage status for this date'
    },
    alertLevel: {
      type: DataTypes.ENUM('none', 'low', 'medium', 'high', 'critical'),
      defaultValue: 'none',
      comment: 'Alert level based on coverage analysis'
    },
    requiresAttention: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Flags schedules that need BCBA attention'
    },
    // Assignment details
    totalTherapists: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of different therapists assigned to this patient on this date'
    },
    primaryTherapistId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      comment: 'Primary therapist for this date (therapist with most hours)'
    },
    primaryTherapistMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Minutes assigned to primary therapist'
    },
    substituteCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of substitute therapists used'
    },
    // Service type breakdown
    directServiceMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Minutes of direct therapy service'
    },
    indirectServiceMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Minutes of indirect service'
    },
    supervisionMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Minutes of supervision time'
    },
    // Coverage recommendations
    recommendations: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of recommendations to improve coverage: [{type, description, priority, actionRequired}]'
    },
    autoResolutionAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times auto-assignment tried to resolve gaps'
    },
    lastOptimizationAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When coverage was last optimized'
    },
    // Contract and billing impact
    contractHoursUsed: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
      comment: 'Contract hours that will be consumed by this coverage'
    },
    projectedCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Projected cost for this days coverage'
    },
    // Historical data
    previousCoverageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ScheduleCoverages',
        key: 'id'
      },
      comment: 'Links to previous coverage analysis for trend tracking'
    },
    improvementFromPrevious: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Coverage improvement percentage from previous analysis'
    },
    // Analysis metadata
    analysisVersion: {
      type: DataTypes.STRING,
      defaultValue: '1.0',
      comment: 'Version of coverage analysis algorithm used'
    },
    calculatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When this coverage analysis was calculated'
    },
    isStale: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this analysis needs to be recalculated'
    },
    staleSince: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this analysis became stale'
    },
    // Metadata
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      comment: 'User who triggered this analysis (null for automatic)'
    },
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['patientId', 'coverageDate']
      },
      {
        fields: ['coverageDate']
      },
      {
        fields: ['locationId', 'coverageDate']
      },
      {
        fields: ['coverageStatus', 'alertLevel']
      },
      {
        fields: ['requiresAttention']
      },
      {
        fields: ['isStale']
      },
      {
        fields: ['primaryTherapistId', 'coverageDate']
      },
      {
        unique: true,
        fields: ['patientId', 'coverageDate'],
        name: 'unique_patient_coverage_date'
      }
    ]
  });

  // Helper method to determine coverage status based on percentage
  ScheduleCoverage.prototype.updateCoverageStatus = function() {
    if (this.totalCoveredMinutes > this.totalRequiredMinutes) {
      this.coverageStatus = 'overbooked';
      this.alertLevel = 'medium';
    } else if (this.coveragePercentage >= 1.0) {
      this.coverageStatus = 'full';
      this.alertLevel = 'none';
    } else if (this.coveragePercentage >= 0.8) {
      this.coverageStatus = 'partial';
      this.alertLevel = this.largestGapMinutes > 60 ? 'medium' : 'low';
    } else if (this.coveragePercentage >= 0.5) {
      this.coverageStatus = 'minimal';
      this.alertLevel = 'high';
    } else {
      this.coverageStatus = 'uncovered';
      this.alertLevel = 'critical';
    }

    this.requiresAttention = ['high', 'critical'].includes(this.alertLevel) || this.gapCount > 3;
  };

  // Helper method to calculate quality scores
  ScheduleCoverage.prototype.calculateQualityScores = function(assignments = []) {
    if (!assignments.length) {
      this.continuityScore = 0;
      this.preferenceScore = 0;
      this.skillMatchScore = 0;
      return;
    }

    // Continuity score - fewer therapist changes = better
    const uniqueTherapists = new Set(assignments.map(a => a.therapistId)).size;
    this.continuityScore = Math.max(0, 1 - ((uniqueTherapists - 1) * 0.2));

    // Preference score - based on how many preferred therapists are used
    const preferredAssignments = assignments.filter(a => a.assignmentMethod === 'preferred').length;
    this.preferenceScore = assignments.length > 0 ? preferredAssignments / assignments.length : 0;

    // Skill match score - based on individual assignment skill match scores
    const skillScores = assignments
      .filter(a => a.skillMatch && a.skillMatch !== 'unknown')
      .map(a => {
        switch (a.skillMatch) {
          case 'excellent': return 1.0;
          case 'good': return 0.8;
          case 'fair': return 0.6;
          case 'poor': return 0.3;
          default: return 0.5;
        }
      });
    
    this.skillMatchScore = skillScores.length > 0 
      ? skillScores.reduce((sum, score) => sum + score, 0) / skillScores.length 
      : 0.5;
  };

  // Helper method to generate recommendations
  ScheduleCoverage.prototype.generateRecommendations = function() {
    const recommendations = [];

    // Coverage recommendations
    if (this.coveragePercentage < 0.8) {
      recommendations.push({
        type: 'coverage',
        description: `Coverage is only ${(this.coveragePercentage * 100).toFixed(1)}%. Need to fill ${this.totalGapMinutes} minutes of gaps.`,
        priority: this.coveragePercentage < 0.5 ? 'critical' : 'high',
        actionRequired: 'assign_therapists'
      });
    }

    // Large gap recommendations
    if (this.largestGapMinutes > 120) {
      recommendations.push({
        type: 'large_gap',
        description: `Large ${this.largestGapMinutes}-minute gap detected. Consider splitting into smaller sessions.`,
        priority: 'medium',
        actionRequired: 'review_schedule'
      });
    }

    // Continuity recommendations
    if (this.continuityScore < 0.6 && this.totalTherapists > 2) {
      recommendations.push({
        type: 'continuity',
        description: `${this.totalTherapists} different therapists assigned. Consider consolidating for better continuity.`,
        priority: 'medium',
        actionRequired: 'optimize_assignments'
      });
    }

    // Preference recommendations
    if (this.preferenceScore < 0.5) {
      recommendations.push({
        type: 'preferences',
        description: 'Few preferred therapists assigned. Review patient preferences and therapist availability.',
        priority: 'low',
        actionRequired: 'review_preferences'
      });
    }

    // Overbooking recommendations
    if (this.coverageStatus === 'overbooked') {
      const excessMinutes = this.totalCoveredMinutes - this.totalRequiredMinutes;
      recommendations.push({
        type: 'overbooked',
        description: `Patient is overbooked by ${excessMinutes} minutes. Review schedule to avoid excessive billing.`,
        priority: 'high',
        actionRequired: 'reduce_coverage'
      });
    }

    this.recommendations = recommendations;
    return recommendations;
  };

  // Helper method to check if analysis is stale
  ScheduleCoverage.prototype.checkIfStale = function(maxAgeHours = 24) {
    const now = new Date();
    const ageHours = (now - this.calculatedAt) / (1000 * 60 * 60);
    
    if (ageHours > maxAgeHours) {
      this.isStale = true;
      this.staleSince = this.staleSince || now;
    }
    
    return this.isStale;
  };

  // Static method to calculate coverage for a patient and date
  ScheduleCoverage.calculateCoverage = async function(patientId, coverageDate, timeBlocks = [], assignments = []) {
    // Calculate totals
    const totalRequiredMinutes = timeBlocks.reduce((sum, block) => sum + block.durationMinutes, 0);
    const totalCoveredMinutes = assignments.reduce((sum, assignment) => sum + assignment.durationMinutes, 0);
    const totalGapMinutes = Math.max(0, totalRequiredMinutes - totalCoveredMinutes);
    const coveragePercentage = totalRequiredMinutes > 0 ? totalCoveredMinutes / totalRequiredMinutes : 0;

    // Analyze gaps
    let gapCount = 0;
    let largestGapMinutes = 0;
    const criticalGaps = [];

    timeBlocks.forEach(block => {
      const gaps = block.getCoverageGaps(assignments.filter(a => a.patientTimeBlockId === block.id));
      gapCount += gaps.length;
      
      gaps.forEach(gap => {
        if (gap.durationMinutes > largestGapMinutes) {
          largestGapMinutes = gap.durationMinutes;
        }
        
        // Mark gaps over 30 minutes as critical
        if (gap.durationMinutes >= 30) {
          criticalGaps.push({
            ...gap,
            priority: gap.durationMinutes >= 60 ? 'high' : 'medium'
          });
        }
      });
    });

    // Analyze therapist assignments
    const uniqueTherapists = new Set(assignments.map(a => a.therapistId));
    const totalTherapists = uniqueTherapists.size;
    
    // Find primary therapist (most minutes)
    const therapistMinutes = {};
    assignments.forEach(assignment => {
      therapistMinutes[assignment.therapistId] = (therapistMinutes[assignment.therapistId] || 0) + assignment.durationMinutes;
    });
    
    let primaryTherapistId = null;
    let primaryTherapistMinutes = 0;
    Object.entries(therapistMinutes).forEach(([therapistId, minutes]) => {
      if (minutes > primaryTherapistMinutes) {
        primaryTherapistId = therapistId;
        primaryTherapistMinutes = minutes;
      }
    });

    // Count substitutes
    const substituteCount = assignments.filter(a => a.assignmentType === 'substitute').length;

    // Calculate service type breakdown
    const serviceBreakdown = {
      directServiceMinutes: 0,
      indirectServiceMinutes: 0,
      supervisionMinutes: 0
    };

    assignments.forEach(assignment => {
      switch (assignment.serviceType) {
        case 'direct':
          serviceBreakdown.directServiceMinutes += assignment.durationMinutes;
          break;
        case 'indirect':
          serviceBreakdown.indirectServiceMinutes += assignment.durationMinutes;
          break;
        case 'supervision':
          serviceBreakdown.supervisionMinutes += assignment.durationMinutes;
          break;
      }
    });

    // Calculate contract hours used
    const contractHoursUsed = assignments.reduce((sum, assignment) => {
      return sum + (assignment.contractHours || (assignment.durationMinutes / 60));
    }, 0);

    return {
      totalRequiredMinutes,
      totalCoveredMinutes,
      totalGapMinutes,
      coveragePercentage,
      gapCount,
      largestGapMinutes,
      criticalGaps,
      totalTherapists,
      primaryTherapistId,
      primaryTherapistMinutes,
      substituteCount,
      contractHoursUsed,
      ...serviceBreakdown
    };
  };

  // Static method to get coverage summary for multiple patients
  ScheduleCoverage.getCoverageSummary = async function(locationId, startDate, endDate) {
    const coverages = await this.findAll({
      where: {
        locationId,
        coverageDate: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['coverageDate', 'ASC'], ['requiresAttention', 'DESC']]
    });

    const summary = {
      totalPatients: new Set(coverages.map(c => c.patientId)).size,
      totalDays: coverages.length,
      averageCoverage: 0,
      criticalAlerts: 0,
      highAlerts: 0,
      mediumAlerts: 0,
      lowAlerts: 0,
      requiresAttention: 0,
      fullyCovers: 0,
      partiallyCovered: 0,
      uncovered: 0
    };

    coverages.forEach(coverage => {
      summary.averageCoverage += coverage.coveragePercentage;
      
      switch (coverage.alertLevel) {
        case 'critical': summary.criticalAlerts++; break;
        case 'high': summary.highAlerts++; break;
        case 'medium': summary.mediumAlerts++; break;
        case 'low': summary.lowAlerts++; break;
      }
      
      if (coverage.requiresAttention) summary.requiresAttention++;
      
      switch (coverage.coverageStatus) {
        case 'full': summary.fullyCovers++; break;
        case 'partial': summary.partiallyCovered++; break;
        case 'minimal':
        case 'uncovered': summary.uncovered++; break;
      }
    });

    if (coverages.length > 0) {
      summary.averageCoverage = summary.averageCoverage / coverages.length;
    }

    return summary;
  };

  return ScheduleCoverage;
};