import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, isWithinInterval } from 'date-fns';

/**
 * Track therapist continuity for patients over time periods
 */

// Maximum recommended different therapists per patient per day
const MAX_THERAPISTS_PER_DAY = 3;

// Analysis time periods
const TIME_PERIODS = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30
};

/**
 * Analyze patient-therapist assignments for continuity issues
 */
export const analyzeTherapistContinuity = (patientId, appointments, analysisDate, period = 'weekly') => {
  const analysis = {
    patientId,
    period,
    analysisDate,
    totalSessions: 0,
    uniqueTherapists: new Set(),
    therapistFrequency: {},
    dailyTherapistCount: {},
    warnings: [],
    recommendations: []
  };

  // Determine date range based on period
  let startDate, endDate;
  
  switch (period) {
    case 'daily':
      startDate = new Date(analysisDate);
      endDate = new Date(analysisDate);
      break;
    case 'weekly':
      startDate = startOfWeek(new Date(analysisDate));
      endDate = endOfWeek(new Date(analysisDate));
      break;
    case 'biweekly':
      startDate = startOfWeek(subWeeks(new Date(analysisDate), 1));
      endDate = endOfWeek(new Date(analysisDate));
      break;
    case 'monthly':
      startDate = startOfWeek(subWeeks(new Date(analysisDate), 3));
      endDate = endOfWeek(new Date(analysisDate));
      break;
    default:
      startDate = startOfWeek(new Date(analysisDate));
      endDate = endOfWeek(new Date(analysisDate));
  }

  // Filter appointments for patient within date range
  const patientAppointments = appointments.filter(app => 
    app.patientId === patientId &&
    app.serviceType === 'direct' &&
    app.therapistId &&
    isWithinInterval(new Date(app.startTime), { start: startDate, end: endDate })
  );

  analysis.totalSessions = patientAppointments.length;

  // Analyze therapist assignments
  patientAppointments.forEach(appointment => {
    const therapistId = appointment.therapistId;
    const sessionDate = format(new Date(appointment.startTime), 'yyyy-MM-dd');
    
    // Track unique therapists
    analysis.uniqueTherapists.add(therapistId);
    
    // Track therapist frequency
    if (!analysis.therapistFrequency[therapistId]) {
      analysis.therapistFrequency[therapistId] = {
        therapistId,
        therapistName: appointment.therapist ? 
          `${appointment.therapist.firstName} ${appointment.therapist.lastName}` : 'Unknown',
        sessionCount: 0,
        sessionDates: [],
        percentage: 0
      };
    }
    analysis.therapistFrequency[therapistId].sessionCount++;
    analysis.therapistFrequency[therapistId].sessionDates.push(sessionDate);
    
    // Track daily therapist count
    if (!analysis.dailyTherapistCount[sessionDate]) {
      analysis.dailyTherapistCount[sessionDate] = new Set();
    }
    analysis.dailyTherapistCount[sessionDate].add(therapistId);
  });

  // Calculate percentages
  Object.values(analysis.therapistFrequency).forEach(therapist => {
    therapist.percentage = analysis.totalSessions > 0 ? 
      (therapist.sessionCount / analysis.totalSessions) * 100 : 0;
  });

  // Generate warnings and recommendations
  generateContinuityWarnings(analysis);
  generateContinuityRecommendations(analysis);

  return analysis;
};

/**
 * Generate continuity warnings
 */
const generateContinuityWarnings = (analysis) => {
  const uniqueTherapistCount = analysis.uniqueTherapists.size;
  
  // Too many different therapists overall
  if (uniqueTherapistCount > MAX_THERAPISTS_PER_DAY && analysis.period === 'daily') {
    analysis.warnings.push({
      type: 'excessive_daily_therapists',
      severity: 'error',
      message: `Patient has ${uniqueTherapistCount} different therapists in one day (max recommended: ${MAX_THERAPISTS_PER_DAY})`,
      count: uniqueTherapistCount,
      recommendation: 'Consolidate sessions with fewer therapists'
    });
  }
  
  if (uniqueTherapistCount > 5 && analysis.period === 'weekly') {
    analysis.warnings.push({
      type: 'excessive_weekly_therapists',
      severity: 'warning',
      message: `Patient has ${uniqueTherapistCount} different therapists this week`,
      count: uniqueTherapistCount,
      recommendation: 'Consider reducing therapist rotation'
    });
  }

  // Check daily therapist counts
  Object.entries(analysis.dailyTherapistCount).forEach(([date, therapistSet]) => {
    if (therapistSet.size > MAX_THERAPISTS_PER_DAY) {
      analysis.warnings.push({
        type: 'excessive_daily_therapists_specific',
        severity: 'error',
        message: `${therapistSet.size} different therapists on ${format(new Date(date), 'MMM d')}`,
        date,
        count: therapistSet.size,
        recommendation: 'Reschedule to reduce therapist changes'
      });
    }
  });

  // No primary therapist (no therapist has >50% of sessions)
  const therapistData = Object.values(analysis.therapistFrequency);
  const primaryTherapist = therapistData.find(t => t.percentage >= 50);
  
  if (!primaryTherapist && analysis.totalSessions >= 5) {
    analysis.warnings.push({
      type: 'no_primary_therapist',
      severity: 'warning',
      message: 'No primary therapist identified (no therapist has ≥50% of sessions)',
      recommendation: 'Assign more sessions to one primary therapist'
    });
  }

  // High fragmentation (many therapists with few sessions each)
  const fragmentedTherapists = therapistData.filter(t => t.sessionCount === 1).length;
  if (fragmentedTherapists >= 3) {
    analysis.warnings.push({
      type: 'high_fragmentation',
      severity: 'warning',
      message: `${fragmentedTherapists} therapists have only 1 session each`,
      count: fragmentedTherapists,
      recommendation: 'Consolidate single sessions with existing therapists'
    });
  }
};

/**
 * Generate continuity recommendations
 */
const generateContinuityRecommendations = (analysis) => {
  const therapistData = Object.values(analysis.therapistFrequency);
  
  if (therapistData.length === 0) return;

  // Sort therapists by session count
  therapistData.sort((a, b) => b.sessionCount - a.sessionCount);
  
  const topTherapist = therapistData[0];
  const secondTherapist = therapistData[1];

  // Recommend primary therapist
  if (topTherapist.percentage < 60 && analysis.totalSessions >= 5) {
    analysis.recommendations.push({
      type: 'increase_primary_therapist',
      priority: 'high',
      message: `Increase ${topTherapist.therapistName}'s sessions (currently ${topTherapist.percentage.toFixed(1)}%)`,
      targetPercentage: 60,
      currentTherapist: topTherapist
    });
  }

  // Recommend secondary therapist if there are many therapists
  if (therapistData.length > 3 && secondTherapist) {
    const others = therapistData.slice(2);
    const othersSessions = others.reduce((sum, t) => sum + t.sessionCount, 0);
    
    if (othersSessions >= 3) {
      analysis.recommendations.push({
        type: 'consolidate_secondary_therapist',
        priority: 'medium',
        message: `Transfer ${othersSessions} sessions from ${others.length} therapists to ${secondTherapist.therapistName}`,
        targetTherapist: secondTherapist,
        sessionsToTransfer: othersSessions,
        sourceTherapists: others
      });
    }
  }

  // Recommend optimal schedule structure
  if (analysis.totalSessions >= 10) {
    const optimalStructure = calculateOptimalTherapistStructure(analysis.totalSessions);
    analysis.recommendations.push({
      type: 'optimal_structure',
      priority: 'low',
      message: `Optimal structure: ${optimalStructure.primary}% primary, ${optimalStructure.secondary}% secondary therapist`,
      structure: optimalStructure
    });
  }
};

/**
 * Calculate optimal therapist distribution
 */
const calculateOptimalTherapistStructure = (totalSessions) => {
  if (totalSessions <= 5) {
    return { primary: 80, secondary: 20, maxTherapists: 2 };
  } else if (totalSessions <= 10) {
    return { primary: 60, secondary: 30, tertiary: 10, maxTherapists: 3 };
  } else {
    return { primary: 50, secondary: 30, tertiary: 20, maxTherapists: 3 };
  }
};

/**
 * Analyze all patients for continuity issues
 */
export const analyzeAllPatientsContinuity = (patients, appointments, analysisDate, period = 'weekly') => {
  const overallAnalysis = {
    analysisDate,
    period,
    totalPatients: patients.length,
    patientsWithIssues: 0,
    issuesSummary: {
      excessiveTherapists: 0,
      noPrimaryTherapist: 0,
      highFragmentation: 0,
      dailyOverload: 0
    },
    patientAnalyses: [],
    recommendations: []
  };

  patients.forEach(patient => {
    const patientAnalysis = analyzeTherapistContinuity(patient.id, appointments, analysisDate, period);
    overallAnalysis.patientAnalyses.push(patientAnalysis);

    // Count issues
    if (patientAnalysis.warnings.length > 0) {
      overallAnalysis.patientsWithIssues++;
      
      patientAnalysis.warnings.forEach(warning => {
        switch (warning.type) {
          case 'excessive_daily_therapists':
          case 'excessive_weekly_therapists':
          case 'excessive_daily_therapists_specific':
            overallAnalysis.issuesSummary.excessiveTherapists++;
            break;
          case 'no_primary_therapist':
            overallAnalysis.issuesSummary.noPrimaryTherapist++;
            break;
          case 'high_fragmentation':
            overallAnalysis.issuesSummary.highFragmentation++;
            break;
        }
      });
    }
  });

  // Generate overall recommendations
  generateOverallRecommendations(overallAnalysis);

  return overallAnalysis;
};

/**
 * Generate system-wide recommendations
 */
const generateOverallRecommendations = (analysis) => {
  const { issuesSummary, totalPatients, patientsWithIssues } = analysis;
  
  if (patientsWithIssues === 0) {
    analysis.recommendations.push({
      type: 'excellent_continuity',
      priority: 'info',
      message: 'All patients have good therapist continuity'
    });
    return;
  }

  const issueRate = (patientsWithIssues / totalPatients) * 100;

  if (issueRate > 50) {
    analysis.recommendations.push({
      type: 'systemic_continuity_issues',
      priority: 'high',
      message: `${issueRate.toFixed(1)}% of patients have continuity issues. Consider reviewing scheduling policies.`,
      affectedPatients: patientsWithIssues
    });
  }

  if (issuesSummary.excessiveTherapists > totalPatients * 0.3) {
    analysis.recommendations.push({
      type: 'reduce_therapist_rotation',
      priority: 'high',
      message: 'Many patients have too many different therapists. Implement therapist assignment policies.',
      affectedCount: issuesSummary.excessiveTherapists
    });
  }

  if (issuesSummary.noPrimaryTherapist > totalPatients * 0.2) {
    analysis.recommendations.push({
      type: 'assign_primary_therapists',
      priority: 'medium',
      message: 'Many patients lack a primary therapist. Assign consistent therapists for better outcomes.',
      affectedCount: issuesSummary.noPrimaryTherapist
    });
  }
};

/**
 * Get continuity score for a patient (0-100)
 */
export const calculateContinuityScore = (analysis) => {
  let score = 100;
  
  // Deduct points for warnings
  analysis.warnings.forEach(warning => {
    switch (warning.severity) {
      case 'error':
        score -= 25;
        break;
      case 'warning':
        score -= 15;
        break;
      case 'info':
        score -= 5;
        break;
    }
  });

  // Bonus for good primary therapist percentage
  const therapistData = Object.values(analysis.therapistFrequency);
  if (therapistData.length > 0) {
    const topTherapist = therapistData.reduce((max, t) => t.percentage > max.percentage ? t : max);
    if (topTherapist.percentage >= 60) {
      score += 10;
    } else if (topTherapist.percentage >= 50) {
      score += 5;
    }
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
};

/**
 * Format continuity data for display
 */
export const formatContinuityReport = (analysis) => {
  const score = calculateContinuityScore(analysis);
  const therapistData = Object.values(analysis.therapistFrequency);
  
  return {
    score,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
    summary: {
      totalSessions: analysis.totalSessions,
      uniqueTherapists: analysis.uniqueTherapists.size,
      primaryTherapist: therapistData.length > 0 ? therapistData[0] : null,
      warningCount: analysis.warnings.length,
      recommendationCount: analysis.recommendations.length
    },
    details: {
      therapists: therapistData.sort((a, b) => b.percentage - a.percentage),
      warnings: analysis.warnings,
      recommendations: analysis.recommendations,
      dailyBreakdown: analysis.dailyTherapistCount
    }
  };
};