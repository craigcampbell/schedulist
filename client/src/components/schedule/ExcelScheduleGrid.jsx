import React, { useState, useMemo, useCallback } from 'react';
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
  Coffee,
  Settings2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { validateTherapistLunchBreak } from '../../utils/lunch-scheduler';
import { getAppointmentType, getAppointmentColors, getAppointmentDisplayLabel } from '../../utils/appointmentTypes';
import { groupConsecutiveAppointments } from '../../utils/appointment-grouping';
import { getLocationTimeSlots, getMostCommonLocation } from '../../utils/location-time-slots';

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
  onAppointmentMove = () => {},
  userRole = 'bcba',
  viewMode = 'team', // 'team', 'therapist', 'patient'
  location = null // Add location prop for location-specific time slots
}) {
  const [expandedTeams, setExpandedTeams] = useState({});
  const [selectedView, setSelectedView] = useState(viewMode);
  const [showValidationWarnings, setShowValidationWarnings] = useState(true);
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // Grid customization state
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [slotDurationOverride, setSlotDurationOverride] = useState(null); // null = use location default
  const [startTimeOverride, setStartTimeOverride] = useState('');
  const [endTimeOverride, setEndTimeOverride] = useState('');

  // Get appointments for selected date
  const todaysAppointments = useMemo(() => {
    return appointments.filter(app =>
      app && app.startTime && isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
  }, [appointments, selectedDate]);

  // Get location-specific time slots, applying any user overrides
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES, baseLocation } = useMemo(() => {
    const targetLocation = location || getMostCommonLocation(todaysAppointments);

    // Find the latest appointment end time to extend schedule if needed
    let extendedLocation = targetLocation;
    if (todaysAppointments.length > 0) {
      const latestEnd = todaysAppointments.reduce((latest, app) => {
        const endTime = new Date(app.endTime);
        return endTime > latest ? endTime : latest;
      }, new Date(0));

      const latestEndHour = latestEnd.getHours();
      const latestEndMinutes = latestEnd.getMinutes();

      if (targetLocation?.workingHoursEnd) {
        const [workEndHour] = targetLocation.workingHoursEnd.split(':').map(Number);
        if (latestEndHour > workEndHour) {
          extendedLocation = {
            ...targetLocation,
            workingHoursEnd: `${latestEndHour}:${latestEndMinutes > 30 ? '59' : latestEndMinutes === 0 ? '30' : '59'}`
          };
        }
      }
    }

    // Apply user overrides on top of location defaults
    const customLocation = {
      workingHoursStart: startTimeOverride || extendedLocation?.workingHoursStart || '07:30',
      workingHoursEnd: endTimeOverride || extendedLocation?.workingHoursEnd || '17:30',
      slotDuration: slotDurationOverride ?? extendedLocation?.slotDuration ?? 30,
    };

    const result = getLocationTimeSlots(customLocation, 'excel');
    return { ...result, baseLocation: extendedLocation };
  }, [location, todaysAppointments, slotDurationOverride, startTimeOverride, endTimeOverride]);

  // Derive defaults for the settings UI (shown as placeholders)
  const defaultStart = baseLocation?.workingHoursStart || '07:30';
  const defaultEnd = baseLocation?.workingHoursEnd || '17:30';
  const defaultSlotDuration = baseLocation?.slotDuration || 30;
  const effectiveSlotDuration = slotDurationOverride ?? defaultSlotDuration;

  // Slot height scales with duration so the grid stays readable
  const SLOT_HEIGHT = effectiveSlotDuration === 15 ? 32 : effectiveSlotDuration === 60 ? 56 : 40;

  // Time options for start/end selectors (every 30 min, 5 AM – 9 PM)
  const timeOptions = useMemo(() => {
    const opts = [];
    for (let h = 5; h <= 21; h++) {
      opts.push(`${String(h).padStart(2, '0')}:00`);
      if (h < 21) opts.push(`${String(h).padStart(2, '0')}:30`);
    }
    return opts;
  }, []);

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

  // Calculate how many time slots an appointment spans (based on current slot duration)
  const calculateAppointmentSpan = (appointment) => {
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.max(1, Math.ceil(durationMinutes / effectiveSlotDuration));
  };

  // Get the starting slot index for an appointment (-1 if outside grid bounds)
  const getAppointmentStartSlotIndex = (appointment) => {
    const start = new Date(appointment.startTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();

    return TIME_SLOTS.findIndex(slot => {
      const slotRange = TIME_SLOT_RANGES[slot];
      return slotRange && startMinutes >= slotRange.start && startMinutes < slotRange.end;
    });
  };

  // Get appointments grouped by therapist
  const getTherapistAppointmentGroups = (therapistId) => {
    const therapistApps = todaysAppointments.filter(app => app.therapistId === therapistId);
    const sortedApps = therapistApps.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return groupConsecutiveAppointments(sortedApps);
  };

  // Check if a slot is occupied by an appointment group
  const getAppointmentGroupForSlot = (therapistId, slotIndex) => {
    const groups = getTherapistAppointmentGroups(therapistId);

    for (const group of groups) {
      const startIndex = getAppointmentStartSlotIndex(group);
      if (startIndex === -1) continue; // appointment is outside visible grid range
      const span = calculateAppointmentSpan(group);

      if (slotIndex >= startIndex && slotIndex < startIndex + span) {
        return {
          group,
          isStart: slotIndex === startIndex,
          relativeIndex: slotIndex - startIndex,
          totalSpan: span
        };
      }
    }

    return null;
  };

  // Render cell content based on appointment group
  const renderCellContent = (groupInfo, slotIndex, therapistId, teamId, leadBcbaId) => {
    const slotDropKey = `${therapistId}-${slotIndex}`;
    const isDragOver = dragOverSlot === slotDropKey;

    if (!groupInfo) {
      return (
        <div 
          className={`w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}
          onClick={() => {
            // Convert time slot to expected format "7:30-8:00 AM"
            const currentSlot = TIME_SLOTS[slotIndex];
            const nextSlot = TIME_SLOTS[slotIndex + 1] || "6:00 PM";
            
            // Extract time without AM/PM for current slot
            const currentTime = currentSlot.replace(' AM', '').replace(' PM', '');
            const nextTime = nextSlot.replace(' AM', '').replace(' PM', '');
            
            // Determine if it's AM or PM based on the slots
            const period = currentSlot.includes('PM') || (currentSlot.includes('12:') && !currentSlot.includes('AM')) ? 'PM' : 'AM';
            
            const timeSlotFormatted = `${currentTime}-${nextTime} ${period}`;
            
            onCellClick({ 
              therapistId, 
              timeSlot: timeSlotFormatted, 
              selectedDate,
              teamId,
              leadBcbaId
            });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverSlot(slotDropKey);
          }}
          onDragLeave={() => setDragOverSlot(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSlot(null);
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              const currentSlot = TIME_SLOTS[slotIndex];
              const currentTime = currentSlot.replace(' AM', '').replace(' PM', '');
              const period = currentSlot.includes('PM') || (currentSlot.includes('12:') && !currentSlot.includes('AM')) ? 'PM' : 'AM';
              const hour = parseInt(currentTime.split(':')[0], 10);
              const minute = parseInt(currentTime.split(':')[1], 10);
              const newStart = new Date(selectedDate);
              newStart.setHours(period === 'PM' && hour !== 12 ? hour + 12 : (period === 'AM' && hour === 12 ? 0 : hour), minute, 0, 0);
              onAppointmentMove(data.appointmentId, newStart.toISOString(), therapistId);
            } catch (err) {
              console.error('Drop failed:', err);
            }
          }}
        >
          <Plus className={`h-3 w-3 ${isDragOver ? 'text-blue-500 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`} />
        </div>
      );
    }

    // Don't render anything for slots that are not the start of the appointment
    if (!groupInfo.isStart) {
      return null;
    }

    const { group, totalSpan } = groupInfo;
    const serviceType = group.serviceType || 'direct';
    const appointmentType = getAppointmentType(serviceType);
    const colors = getAppointmentColors(serviceType);
    
    // Check if this is a direct service appointment (with or without explicit patient)
    const isDirectService = serviceType === 'direct';
    const hasPatient = group.patientId || group.patient;
    
    // Calculate offset for appointments that don't start on slot boundaries
    const appointmentStart = new Date(group.startTime);
    const appointmentStartMinutes = appointmentStart.getHours() * 60 + appointmentStart.getMinutes();
    const slotRange = TIME_SLOT_RANGES[TIME_SLOTS[slotIndex]];
    let topOffset = 1;

    if (slotRange) {
      const minutesIntoSlot = appointmentStartMinutes - slotRange.start;
      if (minutesIntoSlot > 0 && minutesIntoSlot < effectiveSlotDuration) {
        topOffset = 1 + (minutesIntoSlot / effectiveSlotDuration) * SLOT_HEIGHT;
      }
    }

    // Height spans across all occupied slots
    const appointmentHeight = totalSpan * SLOT_HEIGHT + (totalSpan - 1) * 1 - 2;
    
    const heightStyle = {
      height: `${appointmentHeight}px`,
      position: 'absolute',
      top: `${topOffset}px`,
      left: '2px',
      right: '2px',
      zIndex: 20,
      width: 'calc(100% - 4px)'
    };
    
    if (isDirectService) {
      // Look up patient data if not included in appointment
      const patient = group.patient || patients.find(p => p.id === group.patientId);
      const patientName = patient ? formatPatientName(patient) : 'Unknown';
      const patientColor = patient?.color || '#3B82F6'; // Default to blue if no patient color
      
      return (
        <div 
          className="p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all bg-white dark:bg-gray-800"
          style={{ 
            ...heightStyle,
            borderColor: patientColor,
            backgroundColor: `${patientColor}15`, // 15 is hex for ~9% opacity
            opacity: draggedAppointment?.id === group.appointments[0]?.id ? 0.4 : 1
          }}
          onClick={() => onAppointmentClick(group.appointments[0])}
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
              appointmentId: group.appointments[0]?.id,
              therapistId: therapistId,
              teamId: teamId
            }));
            setDraggedAppointment({ id: group.appointments[0]?.id, startTime: group.startTime, endTime: group.endTime });
          }}
          onDragEnd={() => {
            setDraggedAppointment(null);
            setDragOverSlot(null);
          }}
          title={`${patient ? formatFullPatientName(patient) : 'Direct Service'} - ${format(new Date(group.startTime), 'h:mm a')} to ${format(new Date(group.endTime), 'h:mm a')}`}
        >
          <div className="flex flex-col h-full justify-center items-center text-center">
            <div className="text-xs font-semibold" style={{ color: patientColor }}>
              {patient ? patientName : '👤 Direct'}
            </div>
            {totalSpan > 1 && (
              <div className="text-xs opacity-75 mt-1" style={{ color: patientColor }}>
                {format(new Date(group.startTime), 'h:mm')} - {format(new Date(group.endTime), 'h:mm a')}
              </div>
            )}
            {group.appointments.length > 1 && (
              <div className="text-xs opacity-60" style={{ color: patientColor }}>
                {group.appointments.length} sessions
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Other appointment types (lunch, cleaning, supervision, etc.)
      return (
        <div 
          className={cn(
            "p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all",
            colors.bg,
            colors.text,
            colors.border,
            colors.hover
          )}
          style={{
            ...heightStyle,
            opacity: draggedAppointment?.id === group.appointments[0]?.id ? 0.4 : 1
          }}
          onClick={() => onAppointmentClick(group.appointments[0])}
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
              appointmentId: group.appointments[0]?.id,
              therapistId: therapistId,
              teamId: teamId
            }));
            setDraggedAppointment({ id: group.appointments[0]?.id, startTime: group.startTime, endTime: group.endTime });
          }}
          onDragEnd={() => {
            setDraggedAppointment(null);
            setDragOverSlot(null);
          }}
          title={`${appointmentType.label} - ${format(new Date(group.startTime), 'h:mm a')} to ${format(new Date(group.endTime), 'h:mm a')}`}
        >
          <div className="flex flex-col h-full items-center justify-center text-center">
            <div className="text-sm font-medium flex items-center gap-1">
              <span>{appointmentType.icon}</span>
              <span>{group.title || appointmentType.label}</span>
            </div>
            {(serviceType === 'supervision' || totalSpan > 2) && (
              <div className="text-xs opacity-75 mt-1">
                {format(new Date(group.startTime), 'h:mm')} - {format(new Date(group.endTime), 'h:mm a')}
              </div>
            )}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Team Schedule - {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {todaysAppointments.length} appointments scheduled across {teams.length} teams
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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

            <Button
              variant={showGridSettings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowGridSettings(v => !v)}
              title="Customize grid layout"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Grid
              {showGridSettings ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Inline grid customization panel */}
        {showGridSettings && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 flex flex-wrap items-end gap-5">
            {/* Slot duration */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Slot size</p>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 text-sm">
                {[15, 30, 60].map(min => (
                  <button
                    key={min}
                    onClick={() => setSlotDurationOverride(min === defaultSlotDuration && slotDurationOverride === null ? null : min)}
                    className={cn(
                      "px-3 py-1.5 font-medium transition-colors",
                      effectiveSlotDuration === min
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    )}
                  >
                    {min === 60 ? '1 hr' : `${min} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Start time */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                Start time
              </label>
              <select
                value={startTimeOverride || defaultStart}
                onChange={e => setStartTimeOverride(e.target.value)}
                className="text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeOptions.map(t => (
                  <option key={t} value={t}>
                    {(() => {
                      const [h, m] = t.split(':').map(Number);
                      const period = h >= 12 ? 'PM' : 'AM';
                      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      return `${display}:${String(m).padStart(2, '0')} ${period}`;
                    })()}
                  </option>
                ))}
              </select>
            </div>

            {/* End time */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                End time
              </label>
              <select
                value={endTimeOverride || defaultEnd}
                onChange={e => setEndTimeOverride(e.target.value)}
                className="text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeOptions.map(t => (
                  <option key={t} value={t}>
                    {(() => {
                      const [h, m] = t.split(':').map(Number);
                      const period = h >= 12 ? 'PM' : 'AM';
                      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      return `${display}:${String(m).padStart(2, '0')} ${period}`;
                    })()}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset */}
            {(slotDurationOverride !== null || startTimeOverride || endTimeOverride) && (
              <button
                onClick={() => {
                  setSlotDurationOverride(null);
                  setStartTimeOverride('');
                  setEndTimeOverride('');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline self-end pb-2"
              >
                Reset to defaults
              </button>
            )}
          </div>
        )}
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
                <div className="overflow-x-auto relative" style={{ overflowY: 'visible' }}>
                  <div className="min-w-max relative">
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
                          "grid gap-0 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 group relative overflow-visible",
                          slotIndex % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                        )}
                        style={{gridTemplateColumns: `140px repeat(${teamMembers.length}, 120px)`}}
                      >
                        {/* Time label */}
                        <div
                          className="p-3 border-r border-gray-200 dark:border-gray-700 flex items-center"
                          style={{ height: SLOT_HEIGHT }}
                        >
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {timeSlot}
                          </div>
                        </div>
                        
                        {/* Therapist cells */}
                        {teamMembers.map(member => {
                          const groupInfo = getAppointmentGroupForSlot(member.id, slotIndex);
                          return (
                            <div
                              key={member.id}
                              className="border-r border-gray-200 dark:border-gray-700 relative overflow-visible"
                              style={{ height: SLOT_HEIGHT }}
                            >
                              {renderCellContent(groupInfo, slotIndex, member.id, team.id, team.LeadBCBA?.id)}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-700 rounded"></div>
            <span>Patient Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-600 rounded flex items-center justify-center">
              <Coffee className="h-2 w-2" />
            </div>
            <span>Lunch Break</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"></div>
            <span>Indirect Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded"></div>
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