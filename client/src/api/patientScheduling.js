import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from './client';

// Base API URL for patient scheduling
const PATIENT_SCHEDULING_BASE = '/api/patient-scheduling';

/**
 * Patient Schedule Template API
 */
export const patientSchedulingAPI = {
  // Schedule Templates
  async createScheduleTemplate(templateData) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/templates`, {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  },

  async getPatientScheduleTemplates(patientId) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/templates/patient/${patientId}`);
  },

  async getScheduleTemplate(templateId) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/templates/${templateId}`);
  },

  async generateTimeBlocksFromTemplate(templateId, options = {}) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/templates/${templateId}/generate`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  },

  // Time Blocks
  async getPatientTimeBlocks(patientId, startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/time-blocks/patient/${patientId}?${params}`);
  },

  // Therapist Assignments
  async autoAssignTherapists(patientId, startDate, endDate, options = {}) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/assign/auto`, {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        ...options
      })
    });
  },

  async manualAssignTherapist(assignmentData) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/assign/manual`, {
      method: 'POST',
      body: JSON.stringify(assignmentData)
    });
  },

  // Coverage Analysis
  async getScheduleCoverage(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.locationId) params.append('locationId', filters.locationId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/coverage?${params}`);
  },

  async getPatientScheduleOverview(patientId, startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/overview/patient/${patientId}?${params}`);
  },

  // Gap Detection
  async detectCoverageGaps(patientId, startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/gaps/patient/${patientId}?${params}`);
  },

  async getGapResolutionOptions(timeBlockId) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/gaps/resolve-options`, {
      method: 'POST',
      body: JSON.stringify({ timeBlockId })
    });
  },

  async autoResolveGaps(patientId, date, options = {}) {
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/gaps/auto-resolve`, {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        date: date.toISOString().split('T')[0],
        ...options
      })
    });
  },

  async getLocationCoverageReport(locationId, startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    return apiRequest(`${PATIENT_SCHEDULING_BASE}/coverage/location/${locationId}/report?${params}`);
  }
};

/**
 * Hook for patient schedule data
 */
export const usePatientSchedule = (patientId, selectedDate) => {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScheduleData = useCallback(async () => {
    if (!patientId || !selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const data = await patientSchedulingAPI.getPatientTimeBlocks(
        patientId,
        selectedDate,
        selectedDate
      );
      setScheduleData(data.timeBlocks);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedDate]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  return {
    scheduleData,
    loading,
    error,
    refetch: fetchScheduleData
  };
};

/**
 * Hook for coverage gaps
 */
export const useCoverageGaps = (patientId, startDate, endDate) => {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGaps = async () => {
      if (!patientId || !startDate || !endDate) return;

      setLoading(true);
      setError(null);

      try {
        const data = await patientSchedulingAPI.detectCoverageGaps(patientId, startDate, endDate);
        setGaps(data.gaps);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching coverage gaps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGaps();
  }, [patientId, startDate, endDate]);

  return { gaps, loading, error };
};

/**
 * Utility functions for schedule data processing
 */
export const scheduleUtils = {
  /**
   * Calculate coverage percentage for a time block
   */
  calculateCoveragePercentage(timeBlock) {
    if (!timeBlock.assignments || timeBlock.assignments.length === 0) {
      return 0;
    }

    const totalCoveredMinutes = timeBlock.assignments.reduce((sum, assignment) => {
      return sum + assignment.durationMinutes;
    }, 0);

    return Math.min(totalCoveredMinutes / timeBlock.durationMinutes, 1.0);
  },

  /**
   * Get coverage gaps for a time block
   */
  getCoverageGaps(timeBlock) {
    const assignments = timeBlock.assignments || [];
    
    if (assignments.length === 0) {
      return [{
        startTime: timeBlock.startTime,
        endTime: timeBlock.endTime,
        durationMinutes: timeBlock.durationMinutes,
        type: 'uncovered'
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
        const gapStart = new Date(`2000-01-01 ${currentTime}`);
        const gapEnd = new Date(`2000-01-01 ${assignment.startTime}`);
        const gapDuration = (gapEnd - gapStart) / (1000 * 60);

        gaps.push({
          startTime: currentTime,
          endTime: assignment.startTime,
          durationMinutes: gapDuration,
          type: 'partial'
        });
      }

      currentTime = assignment.endTime > currentTime ? assignment.endTime : currentTime;
    }

    // Check for gap at the end
    if (currentTime < timeBlock.endTime) {
      const gapStart = new Date(`2000-01-01 ${currentTime}`);
      const gapEnd = new Date(`2000-01-01 ${timeBlock.endTime}`);
      const gapDuration = (gapEnd - gapStart) / (1000 * 60);

      gaps.push({
        startTime: currentTime,
        endTime: timeBlock.endTime,
        durationMinutes: gapDuration,
        type: 'partial'
      });
    }

    return gaps;
  },

  /**
   * Format time for display
   */
  formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  },

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  },

  /**
   * Get severity color classes
   */
  getSeverityColors(severity) {
    const colors = {
      critical: 'bg-red-500 text-white',
      high: 'bg-red-100 text-red-800 border-red-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-gray-100 text-gray-800 border-gray-300',
      none: 'bg-green-100 text-green-800 border-green-300'
    };
    
    return colors[severity] || colors.none;
  },

  /**
   * Get service type colors
   */
  getServiceTypeColors(serviceType) {
    const colors = {
      direct: 'bg-blue-100 text-blue-800 border-blue-300',
      indirect: 'bg-purple-100 text-purple-800 border-purple-300',
      supervision: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      lunch: 'bg-green-100 text-green-800 border-green-300',
      circle: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      cleaning: 'bg-orange-100 text-orange-800 border-orange-300'
    };
    
    return colors[serviceType] || colors.direct;
  }
};

export default patientSchedulingAPI;