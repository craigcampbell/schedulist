import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  CheckCircle, 
  User,
  Users,
  BarChart3,
  TrendingUp,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { 
  analyzeTherapistContinuity,
  analyzeAllPatientsContinuity,
  calculateContinuityScore,
  formatContinuityReport
} from '../../utils/continuity-tracker';

export default function ContinuityTracker({
  patients = [],
  appointments = [],
  therapists = [],
  selectedDate,
  userRole = 'bcba',
  showOnlyIssues = false
}) {
  const [expandedPatients, setExpandedPatients] = useState({});
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('weekly');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatientDetails, setSelectedPatientDetails] = useState(null);

  // Analyze continuity for all patients
  const continuityAnalysis = useMemo(() => {
    return analyzeAllPatientsContinuity(patients, appointments, selectedDate, selectedTimePeriod);
  }, [patients, appointments, selectedDate, selectedTimePeriod]);

  // Get individual patient analyses with scores
  const patientReports = useMemo(() => {
    return continuityAnalysis.patientAnalyses.map(analysis => {
      const report = formatContinuityReport(analysis);
      return {
        ...analysis,
        ...report,
        patient: patients.find(p => p.id === analysis.patientId)
      };
    }).filter(report => {
      // Filter based on showOnlyIssues
      if (showOnlyIssues) {
        return report.warnings.length > 0 || report.score < 80;
      }
      return report.totalSessions > 0; // Only show patients with sessions
    });
  }, [continuityAnalysis, patients, showOnlyIssues]);

  // Format patient name based on user role
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    if (userRole === 'therapist') {
      const firstTwo = patient.firstName?.substring(0, 2) || '--';
      const lastTwo = patient.lastName?.substring(0, 2) || '--';
      return `${firstTwo}${lastTwo}`;
    }
    
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    if (score >= 80) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    if (score >= 60) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    return 'text-red-600 bg-red-100 dark:bg-red-900/20';
  };

  const getGradeIcon = (grade) => {
    switch (grade) {
      case 'A': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'B': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'C': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'D': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'F': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const togglePatient = (patientId) => {
    setExpandedPatients(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
  };

  const showPatientDetails = (report) => {
    setSelectedPatientDetails(report);
    setShowDetailsModal(true);
  };

  const averageScore = patientReports.length > 0 
    ? patientReports.reduce((sum, report) => sum + report.score, 0) / patientReports.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Therapist Continuity Analysis
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')} • {selectedTimePeriod} view
            </p>
            
            <div className="grid grid-cols-4 gap-6 mt-4">
              <div className="text-center">
                <div className={cn(
                  "text-2xl font-bold",
                  getScoreColor(averageScore).split(' ')[0]
                )}>
                  {averageScore.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {patientReports.filter(r => r.score >= 80).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Good Continuity
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {patientReports.filter(r => r.warnings.length > 0).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  With Issues
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {patientReports.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Patients
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <select
              className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-sm"
              value={selectedTimePeriod}
              onChange={(e) => setSelectedTimePeriod(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Overall Recommendations */}
        {continuityAnalysis.recommendations.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              System Recommendations:
            </h3>
            <div className="space-y-1">
              {continuityAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                <div key={index} className="text-sm text-blue-800 dark:text-blue-200">
                  • {rec.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Patient Continuity List */}
      <div className="space-y-4">
        {patientReports.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">
              {showOnlyIssues ? 'No Continuity Issues Found' : 'No Patient Data'}
            </p>
            <p>
              {showOnlyIssues 
                ? 'All patients have good therapist continuity for this period.'
                : 'No patients have scheduled sessions for this period.'
              }
            </p>
          </div>
        ) : (
          patientReports.map(report => {
            const isExpanded = expandedPatients[report.patientId];
            
            return (
              <div 
                key={report.patientId}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Patient Header */}
                <div 
                  className={cn(
                    "p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50",
                    report.score < 70 && "bg-red-50 dark:bg-red-900/20",
                    report.score >= 70 && report.score < 80 && "bg-yellow-50 dark:bg-yellow-900/20",
                    report.score >= 80 && "bg-green-50 dark:bg-green-900/20"
                  )}
                  onClick={() => togglePatient(report.patientId)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {getGradeIcon(report.grade)}
                      
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatPatientName(report.patient)}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>{report.summary.totalSessions} sessions</span>
                          <span>{report.summary.uniqueTherapists} therapists</span>
                          {report.summary.primaryTherapist && (
                            <span>
                              Primary: {report.summary.primaryTherapist.therapistName} 
                              ({report.summary.primaryTherapist.percentage.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-semibold",
                        getScoreColor(report.score)
                      )}>
                        {report.grade} ({report.score})
                      </div>
                      
                      {report.warnings.length > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{report.warnings.length}</span>
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          showPatientDetails(report);
                        }}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Therapist Breakdown */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Therapist Distribution:
                      </h4>
                      <div className="space-y-2">
                        {report.details.therapists.map((therapist, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{therapist.therapistName}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${therapist.percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                                {therapist.percentage.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warnings */}
                    {report.warnings.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                          Issues:
                        </h4>
                        <div className="space-y-2">
                          {report.warnings.map((warning, index) => (
                            <div 
                              key={index}
                              className={cn(
                                "flex items-start gap-2 text-sm p-3 rounded-lg",
                                warning.severity === 'error' && "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
                                warning.severity === 'warning' && "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
                                warning.severity === 'info' && "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                              )}
                            >
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-medium">{warning.message}</div>
                                {warning.recommendation && (
                                  <div className="text-xs mt-1 opacity-80">
                                    Recommendation: {warning.recommendation}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                          Recommendations:
                        </h4>
                        <div className="space-y-2">
                          {report.recommendations.map((rec, index) => (
                            <div 
                              key={index}
                              className="flex items-start gap-2 text-sm p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                            >
                              <TrendingUp className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                              <div className="text-blue-800 dark:text-blue-200">
                                <span className="font-medium capitalize">{rec.priority}:</span> {rec.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatientDetails && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">
                Continuity Details: {formatPatientName(selectedPatientDetails.patient)}
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDetailsModal(false)}
              >
                ✕
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Breakdown */}
              <div>
                <h3 className="font-semibold mb-3">Daily Therapist Count:</h3>
                <div className="space-y-2">
                  {Object.entries(selectedPatientDetails.details.dailyBreakdown).map(([date, therapistSet]) => (
                    <div key={date} className="flex justify-between items-center">
                      <span className="text-sm">{format(new Date(date), 'MMM d')}</span>
                      <div className={cn(
                        "px-2 py-1 rounded text-xs",
                        therapistSet.size <= 2 ? "bg-green-100 text-green-800" :
                        therapistSet.size <= 3 ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      )}>
                        {therapistSet.size} therapists
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Therapist Stats */}
              <div>
                <h3 className="font-semibold mb-3">Therapist Sessions:</h3>
                <div className="space-y-2">
                  {selectedPatientDetails.details.therapists.map((therapist, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{therapist.therapistName}</span>
                        <span className="text-sm text-gray-600">
                          {therapist.sessionCount} sessions ({therapist.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Dates: {therapist.sessionDates.slice(0, 5).map(date => 
                          format(new Date(date), 'M/d')
                        ).join(', ')}
                        {therapist.sessionDates.length > 5 && ` +${therapist.sessionDates.length - 5} more`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}