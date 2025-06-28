import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Coffee, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User,
  Calendar,
  Play,
  X,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { 
  validateTherapistLunchBreak, 
  autoScheduleLunchBreaks, 
  validateTeamLunchCoverage,
  createLunchAppointmentData 
} from '../../utils/lunch-scheduler';

export default function LunchScheduleManager({
  teams = [],
  therapists = [],
  appointments = [],
  selectedDate,
  onLunchScheduled = () => {},
  onBulkLunchSchedule = () => {},
  userRole = 'bcba',
  currentUser = null
}) {
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [autoScheduleResults, setAutoScheduleResults] = useState(null);

  // Analyze lunch break status for all therapists
  const lunchAnalysis = useMemo(() => {
    const analysis = {
      totalTherapists: therapists.length,
      therapistsNeedingLunch: 0,
      therapistsWithLunch: 0,
      therapistDetails: [],
      teamCoverage: {},
      overallWarnings: []
    };

    therapists.forEach(therapist => {
      const validation = validateTherapistLunchBreak(therapist.id, appointments, selectedDate);
      
      const therapistData = {
        ...therapist,
        validation,
        teamId: therapist.teamId || 'unassigned'
      };
      
      analysis.therapistDetails.push(therapistData);
      
      if (validation.needsLunch) {
        analysis.therapistsNeedingLunch++;
        if (validation.hasLunch) {
          analysis.therapistsWithLunch++;
        }
      }
    });

    // Analyze team coverage
    teams.forEach(team => {
      const teamMembers = therapists.filter(t => t.teamId === team.id);
      if (teamMembers.length > 0) {
        analysis.teamCoverage[team.id] = validateTeamLunchCoverage(teamMembers, appointments, selectedDate);
      }
    });

    // Generate overall warnings
    const missingLunchCount = analysis.therapistsNeedingLunch - analysis.therapistsWithLunch;
    if (missingLunchCount > 0) {
      analysis.overallWarnings.push({
        type: 'missing_lunch_breaks',
        message: `${missingLunchCount} therapists missing lunch breaks`,
        count: missingLunchCount,
        severity: 'error'
      });
    }

    Object.values(analysis.teamCoverage).forEach(coverage => {
      coverage.warnings.forEach(warning => {
        analysis.overallWarnings.push(warning);
      });
    });

    return analysis;
  }, [therapists, appointments, selectedDate, teams]);

  // Handle auto-scheduling lunch breaks
  const handleAutoSchedule = async () => {
    setIsAutoScheduling(true);
    
    try {
      const results = autoScheduleLunchBreaks(appointments, therapists, selectedDate);
      setAutoScheduleResults(results);
      setShowAutoScheduleModal(true);
    } catch (error) {
      console.error('Auto-schedule error:', error);
      alert('Failed to auto-schedule lunch breaks');
    } finally {
      setIsAutoScheduling(false);
    }
  };

  // Confirm and apply auto-scheduled lunch breaks
  const confirmAutoSchedule = async () => {
    if (!autoScheduleResults || !currentUser) return;

    try {
      const lunchAppointments = autoScheduleResults.lunchSchedules.map(schedule =>
        createLunchAppointmentData(
          schedule, 
          currentUser.id, 
          currentUser.defaultLocationId || null
        )
      );

      await onBulkLunchSchedule(lunchAppointments);
      setShowAutoScheduleModal(false);
      setAutoScheduleResults(null);
    } catch (error) {
      console.error('Failed to create lunch appointments:', error);
      alert('Failed to create lunch appointments');
    }
  };

  // Group therapists by teams for display
  const therapistsByTeam = useMemo(() => {
    const grouped = {};
    
    teams.forEach(team => {
      grouped[team.id] = {
        team,
        therapists: lunchAnalysis.therapistDetails.filter(t => t.teamId === team.id)
      };
    });
    
    // Add unassigned therapists
    const unassigned = lunchAnalysis.therapistDetails.filter(t => t.teamId === 'unassigned');
    if (unassigned.length > 0) {
      grouped.unassigned = {
        team: { id: 'unassigned', name: 'Unassigned', LeadBCBA: null },
        therapists: unassigned
      };
    }
    
    return grouped;
  }, [teams, lunchAnalysis.therapistDetails]);

  const getLunchStatusColor = (validation) => {
    if (!validation.needsLunch) return 'text-gray-500';
    if (validation.hasLunch) return 'text-green-600';
    if (validation.availableLunchSlots.length > 0) return 'text-amber-600';
    return 'text-red-600';
  };

  const getLunchStatusIcon = (validation) => {
    if (!validation.needsLunch) return <Clock className="h-4 w-4" />;
    if (validation.hasLunch) return <CheckCircle className="h-4 w-4" />;
    if (validation.availableLunchSlots.length > 0) return <AlertTriangle className="h-4 w-4" />;
    return <X className="h-4 w-4" />;
  };

  const missingLunchCount = lunchAnalysis.therapistsNeedingLunch - lunchAnalysis.therapistsWithLunch;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Lunch Break Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </p>
            
            <div className="grid grid-cols-3 gap-6 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {lunchAnalysis.therapistsWithLunch}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  With Lunch
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {missingLunchCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Missing Lunch
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {lunchAnalysis.therapistsNeedingLunch}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Need Lunch
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            {missingLunchCount > 0 && (
              <Button 
                onClick={handleAutoSchedule}
                disabled={isAutoScheduling}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {isAutoScheduling ? 'Scheduling...' : 'Auto-Schedule Lunch'}
              </Button>
            )}
            
            {lunchAnalysis.overallWarnings.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {lunchAnalysis.overallWarnings.length} warnings
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="space-y-4">
        {Object.values(therapistsByTeam).map(({ team, therapists: teamTherapists }) => (
          <div 
            key={team.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Team Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {team.id === 'unassigned' ? 'Unassigned Therapists' : `TEAM ${team.LeadBCBA?.firstName?.toUpperCase() || team.name}`}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-blue-700 dark:text-blue-300">
                <span>{teamTherapists.length} therapists</span>
                <span>{teamTherapists.filter(t => t.validation.hasLunch).length} with lunch</span>
                <span>{teamTherapists.filter(t => t.validation.needsLunch && !t.validation.hasLunch).length} missing lunch</span>
              </div>
            </div>

            {/* Therapist List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {teamTherapists.map(therapist => (
                <div 
                  key={therapist.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        getLunchStatusColor(therapist.validation)
                      )}>
                        {getLunchStatusIcon(therapist.validation)}
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {therapist.firstName} {therapist.lastName}
                        </h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {therapist.validation.workingHours.toFixed(1)} hours scheduled
                          {therapist.validation.hasLunch && (
                            <span className="ml-2 text-green-600">
                              • Lunch: {format(new Date(therapist.validation.lunchSlot.startTime), 'h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {therapist.validation.needsLunch && !therapist.validation.hasLunch && (
                        <div className="text-sm">
                          {therapist.validation.availableLunchSlots.length > 0 ? (
                            <div className="text-amber-600">
                              {therapist.validation.availableLunchSlots.length} slots available
                            </div>
                          ) : (
                            <div className="text-red-600">
                              No available slots
                            </div>
                          )}
                        </div>
                      )}
                      
                      {!therapist.validation.needsLunch && (
                        <div className="text-sm text-gray-500">
                          No lunch needed
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Warnings */}
                  {therapist.validation.warnings.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {therapist.validation.warnings.map((warning, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "flex items-center gap-2 text-xs px-3 py-1 rounded-full",
                            warning.severity === 'error' && "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
                            warning.severity === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
                            warning.severity === 'info' && "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Auto-Schedule Results Modal */}
      {showAutoScheduleModal && autoScheduleResults && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Auto-Schedule Results</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAutoScheduleModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Success Results */}
              {autoScheduleResults.lunchSchedules.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    ✅ Lunch breaks scheduled for {autoScheduleResults.lunchSchedules.length} therapists:
                  </h3>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
                    {autoScheduleResults.lunchSchedules.map((schedule, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{schedule.therapistName}</span>
                        <span className="text-green-700 dark:text-green-300">
                          {schedule.slot}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Error Results */}
              {autoScheduleResults.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    ⚠️ Could not schedule lunch for {autoScheduleResults.errors.length} therapists:
                  </h3>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-2">
                    {autoScheduleResults.errors.map((error, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{error.therapistName}</span>
                        <span className="text-red-700 dark:text-red-300">
                          {error.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAutoScheduleModal(false)}
                >
                  Cancel
                </Button>
                {autoScheduleResults.lunchSchedules.length > 0 && (
                  <Button 
                    onClick={confirmAutoSchedule}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirm & Schedule
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}