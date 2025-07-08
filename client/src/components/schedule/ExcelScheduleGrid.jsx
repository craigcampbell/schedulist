import React, { useState, useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { 
  Clock, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  Users,
  Eye,
  EyeOff,
  Filter,
  Plus,
  Edit3,
  Coffee
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { validateTherapistLunchBreak } from '../../utils/lunch-scheduler';
import { getAppointmentType, getAppointmentColors, getAppointmentDisplayLabel } from '../../utils/appointmentTypes';

// Time slots matching the Excel format (7:30 AM to 5:30 PM)
const TIME_SLOTS = [
  "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", 
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", 
  "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", 
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", 
  "5:30 PM"
];

// Service type colors matching therapist workflow
const SERVICE_COLORS = {
  direct: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300',
  indirect: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-300',
  supervision: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300',
  lunch: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-400',
  out: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-300',
  cleaning: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 border-orange-300',
  circle: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border-yellow-300'
};

export default function ExcelScheduleGrid({
  teams = [],
  appointments = [],
  patients = [],
  selectedDate,
  onAppointmentClick = () => {},
  onCellClick = () => {},
  userRole = 'bcba',
  viewMode = 'team' // 'team', 'therapist', 'patient'
}) {
  const [expandedTeams, setExpandedTeams] = useState({});
  const [selectedView, setSelectedView] = useState(viewMode);
  const [showValidationWarnings, setShowValidationWarnings] = useState(true);

  // Format patient name based on user role (matching Excel format)
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    // For all roles in Excel schedule grid, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  // Get appointments for selected date
  const todaysAppointments = useMemo(() => {
    return appointments.filter(app => 
      app && app.startTime && isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
  }, [appointments, selectedDate]);

  // Time slot mapping for time calculations
  const TIME_SLOT_RANGES = {
    "7:30 AM": { start: 7.5 * 60, end: 8 * 60 },
    "8:00 AM": { start: 8 * 60, end: 8.5 * 60 },
    "8:30 AM": { start: 8.5 * 60, end: 9 * 60 },
    "9:00 AM": { start: 9 * 60, end: 9.5 * 60 },
    "9:30 AM": { start: 9.5 * 60, end: 10 * 60 },
    "10:00 AM": { start: 10 * 60, end: 10.5 * 60 },
    "10:30 AM": { start: 10.5 * 60, end: 11 * 60 },
    "11:00 AM": { start: 11 * 60, end: 11.5 * 60 },
    "11:30 AM": { start: 11.5 * 60, end: 12 * 60 },
    "12:00 PM": { start: 12 * 60, end: 12.5 * 60 },
    "12:30 PM": { start: 12.5 * 60, end: 13 * 60 },
    "1:00 PM": { start: 13 * 60, end: 13.5 * 60 },
    "1:30 PM": { start: 13.5 * 60, end: 14 * 60 },
    "2:00 PM": { start: 14 * 60, end: 14.5 * 60 },
    "2:30 PM": { start: 14.5 * 60, end: 15 * 60 },
    "3:00 PM": { start: 15 * 60, end: 15.5 * 60 },
    "3:30 PM": { start: 15.5 * 60, end: 16 * 60 },
    "4:00 PM": { start: 16 * 60, end: 16.5 * 60 },
    "4:30 PM": { start: 16.5 * 60, end: 17 * 60 },
    "5:00 PM": { start: 17 * 60, end: 17.5 * 60 },
    "5:30 PM": { start: 17.5 * 60, end: 18 * 60 }
  };

  // Check if appointment overlaps with time slot
  const isAppointmentInTimeSlot = (appointment, timeSlot) => {
    const slotRange = TIME_SLOT_RANGES[timeSlot];
    if (!slotRange) return false;
    
    const appStart = new Date(appointment.startTime);
    const appEnd = new Date(appointment.endTime);
    
    const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
    const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
    
    return (
      (appStartMinutes >= slotRange.start && appStartMinutes < slotRange.end) ||
      (appEndMinutes > slotRange.start && appEndMinutes <= slotRange.end) ||
      (appStartMinutes <= slotRange.start && appEndMinutes >= slotRange.end)
    );
  };

  // Validate therapist schedules for warnings using the lunch scheduler utility
  const validateTherapistSchedule = (therapistId) => {
    const validation = validateTherapistLunchBreak(therapistId, todaysAppointments, selectedDate);
    
    return {
      warnings: validation.warnings.map(w => w.message),
      hasLunch: validation.hasLunch,
      totalHours: validation.workingHours,
      needsLunch: validation.needsLunch,
      availableLunchSlots: validation.availableLunchSlots.length
    };
  };

  // Get appointment for specific therapist and time slot
  const getAppointmentForSlot = (therapistId, timeSlot) => {
    return todaysAppointments.find(app => 
      app.therapistId === therapistId && isAppointmentInTimeSlot(app, timeSlot)
    );
  };

  // Render cell content based on appointment
  const renderCellContent = (appointment, timeSlot, therapistId) => {
    if (!appointment) {
      return (
        <div 
          className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
          onClick={() => onCellClick({ therapistId, timeSlot, selectedDate })}
        >
          <Plus className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        </div>
      );
    }

    const serviceType = appointment.serviceType || 'direct';
    const appointmentType = getAppointmentType(serviceType);
    const colors = getAppointmentColors(serviceType);
    const isPatientSession = appointment.patientId && serviceType === 'direct';
    
    if (isPatientSession) {
      // Look up patient data if not included in appointment
      const patient = appointment.patient || patients.find(p => p.id === appointment.patientId);
      const patientName = formatPatientName(patient);
      const patientColor = patient?.color || '#6B7280';
      
      return (
        <div 
          className="w-full h-full p-1 rounded border-2 cursor-pointer hover:shadow-sm transition-all bg-white dark:bg-gray-800"
          style={{ 
            borderColor: patientColor,
            backgroundColor: `${patientColor}15` // 15 is hex for ~9% opacity
          }}
          onClick={() => onAppointmentClick(appointment)}
          title={`${formatFullPatientName(patient)} - ${format(new Date(appointment.startTime), 'h:mm a')} to ${format(new Date(appointment.endTime), 'h:mm a')}`}
        >
          <div className="text-xs font-semibold text-center leading-tight" style={{ color: patientColor }}>
            {patientName}
          </div>
        </div>
      );
    } else {
      return (
        <div 
          className={cn(
            "w-full h-full p-1 rounded border-2 cursor-pointer transition-all",
            colors.bg,
            colors.text,
            colors.border,
            colors.hover
          )}
          onClick={() => onAppointmentClick(appointment)}
          title={`${appointmentType.label} - ${format(new Date(appointment.startTime), 'h:mm a')} to ${format(new Date(appointment.endTime), 'h:mm a')}`}
        >
          <div className="text-xs font-medium text-center leading-tight flex items-center justify-center gap-1">
            <span>{appointmentType.icon}</span>
            <span>{appointment.title || appointmentType.label}</span>
          </div>
        </div>
      );
    }
  };

  const toggleTeam = (teamId) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  if (teams.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Teams Available</p>
        <p>Create teams to use the scheduling grid.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Team Schedule - {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {todaysAppointments.length} appointments scheduled across {teams.length} teams
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showValidationWarnings ? "default" : "outline"}
            size="sm"
            onClick={() => setShowValidationWarnings(!showValidationWarnings)}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Warnings
          </Button>
          
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <Button
              variant={selectedView === 'team' ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedView('team')}
            >
              <Users className="h-4 w-4 mr-1" />
              Teams
            </Button>
            <Button
              variant={selectedView === 'therapist' ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedView('therapist')}
            >
              <User className="h-4 w-4 mr-1" />
              Therapists
            </Button>
          </div>
        </div>
      </div>

      {/* Team Grids */}
      <div className="space-y-6">
        {teams.map(team => {
          const isExpanded = expandedTeams[team.id] !== false; // Default expanded
          const teamMembers = team.Members || [];
          
          return (
            <div 
              key={team.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* Team Header */}
              <div 
                className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => toggleTeam(team.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      TEAM {team.LeadBCBA?.firstName?.toUpperCase() || team.name || 'UNNAMED'}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Lead BCBA: {team.LeadBCBA ? `${team.LeadBCBA.firstName} ${team.LeadBCBA.lastName}` : 'Unassigned'}
                      <span className="ml-3 text-gray-600 dark:text-gray-400">
                        {teamMembers.length} therapists
                      </span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {showValidationWarnings && (
                    <div className="flex items-center gap-1 text-sm">
                      {teamMembers.filter(member => !validateTherapistSchedule(member.id).hasLunch).length > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{teamMembers.filter(member => !validateTherapistSchedule(member.id).hasLunch).length} missing lunch</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Grid Header */}
                    <div className="grid gap-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" 
                         style={{gridTemplateColumns: `140px repeat(${teamMembers.length}, 120px)`}}>
                      
                      {/* Time column header */}
                      <div className="p-3 border-r border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
                        <div className="text-sm">Time Slots</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(selectedDate), 'MMM d')}
                        </div>
                      </div>
                      
                      {/* Therapist headers */}
                      {teamMembers.map(member => {
                        const validation = validateTherapistSchedule(member.id);
                        return (
                          <div 
                            key={member.id}
                            className="p-3 border-r border-gray-200 dark:border-gray-700 text-center"
                          >
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                              {member.firstName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {validation.totalHours}h scheduled
                            </div>
                            {showValidationWarnings && validation.warnings.length > 0 && (
                              <div className="flex items-center justify-center mt-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Time Slot Rows */}
                    {TIME_SLOTS.map((timeSlot, slotIndex) => (
                      <div 
                        key={timeSlot}
                        className={cn(
                          "grid gap-0 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 group",
                          slotIndex % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                        )}
                        style={{gridTemplateColumns: `140px repeat(${teamMembers.length}, 120px)`}}
                      >
                        {/* Time label */}
                        <div className="p-3 border-r border-gray-200 dark:border-gray-700 flex items-center">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {timeSlot}
                          </div>
                        </div>
                        
                        {/* Therapist cells */}
                        {teamMembers.map(member => {
                          const appointment = getAppointmentForSlot(member.id, timeSlot);
                          return (
                            <div 
                              key={member.id}
                              className="p-2 border-r border-gray-200 dark:border-gray-700 min-h-[60px] flex items-center justify-center group relative"
                            >
                              {renderCellContent(appointment, timeSlot, member.id)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
            <span>Patient Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-400 rounded flex items-center justify-center">
              <Coffee className="h-2 w-2" />
            </div>
            <span>Lunch Break</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Indirect Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
            <span>Supervision</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          <strong>Click cells to add appointments</strong> • <strong>Click appointments to edit</strong> • Patient names abbreviated for therapist view
        </div>
      </div>
    </div>
  );
}