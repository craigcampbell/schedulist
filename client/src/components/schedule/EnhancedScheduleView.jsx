import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isSameDay, isValid, addDays, addMinutes } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  Clock, 
  MapPin, 
  User, 
  Calendar, 
  Search, 
  Filter, 
  ChevronDown,
  Settings,
  Eye 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../../components/ui/input';
import { groupConsecutiveAppointments, getSpannedTimeSlots, getGroupPositionInSlot } from '../../utils/appointment-grouping';
import { getLocationTimeSlots, getMostCommonLocation } from '../../utils/location-time-slots';

// Colors for different service types
const SERVICE_TYPE_COLORS = {
  direct: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
  indirect: 'bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200',
  supervision: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
  noOw: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
  lunch: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
  circle: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
  cleaning: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
  default: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
  uncovered: 'bg-red-500 dark:bg-red-600 text-white animate-pulse',
};

// Get dynamic time slots based on appointments (fallback function)
const getTimeSlots = (appointments, defaultStartHour = 7, defaultEndHour = 18) => {
  if (!appointments || appointments.length === 0) {
    // Default time slots if no appointments
    return Array.from({ length: (defaultEndHour - defaultStartHour) * 2 }, (_, i) => {
      const hour = Math.floor(i / 2) + defaultStartHour;
      const minute = (i % 2) * 30;
      return `${hour}:${minute === 0 ? '00' : minute}-${hour}:${minute === 0 ? '30' : '00'}`;
    });
  }

  // Find earliest and latest appointment times
  const times = appointments.flatMap(app => {
    if (!app.startTime || !app.endTime) return [];
    const start = new Date(app.startTime);
    const end = new Date(app.endTime);
    return [start, end];
  }).filter(date => isValid(date));

  if (times.length === 0) {
    return Array.from({ length: (defaultEndHour - defaultStartHour) * 2 }, (_, i) => {
      const hour = Math.floor(i / 2) + defaultStartHour;
      const minute = (i % 2) * 30;
      return `${hour}:${minute === 0 ? '00' : minute}-${hour}:${minute === 0 ? '30' : '00'}`;
    });
  }

  const minTime = new Date(Math.min(...times.map(t => t.getTime())));
  const maxTime = new Date(Math.max(...times.map(t => t.getTime())));

  // Round down to nearest half hour for start
  let startHour = minTime.getHours();
  let startMinute = minTime.getMinutes() < 30 ? 0 : 30;
  if (startHour > defaultStartHour || (startHour === defaultStartHour && startMinute > 0)) {
    startHour = defaultStartHour;
    startMinute = 0;
  }

  // Round up to nearest half hour for end
  let endHour = maxTime.getHours();
  let endMinute = maxTime.getMinutes() > 0 ? 30 : 0;
  if (endHour < defaultEndHour) {
    endHour = defaultEndHour;
    endMinute = 0;
  } else if (endMinute === 30) {
    endHour += 1;
    endMinute = 0;
  }

  const slots = [];
  let currentHour = startHour;
  let currentMinute = startMinute;

  while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
    const nextMinute = currentMinute === 0 ? 30 : 0;
    const nextHour = currentMinute === 0 ? currentHour : currentHour + 1;
    
    slots.push(`${currentHour}:${currentMinute === 0 ? '00' : currentMinute}-${nextHour}:${nextMinute === 0 ? '00' : nextMinute}`);
    
    currentMinute = nextMinute;
    currentHour = nextHour;
  }

  return slots;
};

// Create a map of time slots to their hour/minute values
const createTimeSlotMap = (timeSlots) => {
  const map = {};
  
  timeSlots.forEach(slot => {
    const [start, end] = slot.split('-');
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    
    map[slot] = [
      startHour + (startMinute / 60),
      endHour + (endMinute / 60)
    ];
  });
  
  return map;
};

// Format a time string for display
const formatDisplayTime = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute === 0 ? '00' : minute} ${period}`;
};

export default function EnhancedScheduleView(props) { 
  const { 
    teams, 
    appointments = [], 
    selectedDate,
    onAppointmentUpdate = () => {},
    onAppointmentClick = () => {},
    showLocationView = false,
    userRole = null, // Add userRole prop to determine name display format
    location = null // Add location prop for location-specific time slots
  } = props;
  const [expandedTeams, setExpandedTeams] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  
  // Determine if we should use HIPAA-compliant names based on user role
  // Therapists see abbreviated names, BCBA/Admin see full names
  const useHipaaNames = userRole === 'therapist';
  const [showNameToggle, setShowNameToggle] = useState(false); // Allow manual toggle for BCBA/Admin only

  // Get appointments for selected date
  const todaysAppointments = useMemo(() => {
    return appointments.filter(app => 
      app && app.startTime && isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
  }, [appointments, selectedDate]);

  // Get location-specific time slots
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
    // Use provided location or find most common location from appointments
    const targetLocation = location || getMostCommonLocation(todaysAppointments);
    return getLocationTimeSlots(targetLocation, 'range');
  }, [location, todaysAppointments]);
  
  // Get service code for display
  const getAppointmentServiceType = (appointment) => {
    if (!appointment) return null;
    
    // Extract the first word from the appointment title/serviceType if exists
    const serviceType = appointment.serviceType || 
                      (appointment.title || "").split(' ')[0].toLowerCase();
    
    if (serviceType) {
      // Map common words to service types
      const serviceMap = {
        direct: "direct",
        supervision: "supervision",
        indirect: "indirect",
        lunch: "lunch",
        circle: "circle",
        "no-ow": "noOw",
        noow: "noOw",
        cleaning: "cleaning"
      };
      
      return serviceMap[serviceType.toLowerCase()] || "direct";
    }
    
    return "direct"; // Default
  };
  
  // Compute all therapists from teams
  const allTherapists = useMemo(() => {
    if (!teams || !Array.isArray(teams)) return [];
    return teams.flatMap(team => team?.Members || []);
  }, [teams]);
  
  // Compute all patients from appointments
  const allPatients = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];
    const patients = {};
    appointments.forEach(app => {
      if (app?.patient?.id) {
        patients[app.patient.id] = app.patient;
      }
    });
    return Object.values(patients);
  }, [appointments]);
  
  // Compute service types from appointments
  const serviceTypes = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];
    const types = new Set();
    appointments.forEach(app => {
      const serviceType = getAppointmentServiceType(app);
      if (serviceType) types.add(serviceType);
    });
    return Array.from(types);
  }, [appointments]);
  
  // Dynamic time slots based on appointments
  const timeSlots = useMemo(() => 
    getTimeSlots(Array.isArray(appointments) ? appointments : []), 
    [appointments]
  );
  const timeSlotMap = useMemo(() => 
    createTimeSlotMap(Array.isArray(timeSlots) ? timeSlots : []), 
    [timeSlots]
  );
  
  // Format dates and times
  const formatDayOfWeek = (date) => {
    return format(new Date(date), 'EEEE');
  };
  
  const formatDayOfMonth = (date) => {
    return format(new Date(date), 'M/d');
  };

  const formatTime = (dateTimeString) => {
    try {
      return format(new Date(dateTimeString), 'h:mm a');
    } catch (error) {
      return 'Invalid time';
    }
  };
  
  // Format patient name based on user role and HIPAA settings
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    // For all roles in enhanced schedule view, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  // Group appointments by therapist and group consecutive ones
  const getTherapistAppointments = (therapistId) => {
    // Filter appointments for this therapist on the selected date
    if (!appointments || !Array.isArray(appointments) || !therapistId || !selectedDate) {
      return [];
    }
    
    const therapistApps = appointments.filter(app => 
      app && app.therapistId === therapistId && app.startTime &&
      isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
    
    // Sort by start time
    const sortedApps = therapistApps.sort((a, b) => 
      new Date(a.startTime) - new Date(b.startTime)
    );
    
    // Group consecutive appointments
    return groupConsecutiveAppointments(sortedApps);
  };

  // Check if an appointment is in a time slot
  const isAppointmentInTimeSlot = (appointment, timeSlot) => {
    const slotRange = TIME_SLOT_RANGES[timeSlot];
    if (!slotRange) return false;

    const appStart = new Date(appointment.startTime);
    const appEnd = new Date(appointment.endTime);
    
    const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
    const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();

    // Check if appointment overlaps with this time slot
    return (
      (appStartMinutes >= slotRange.start && appStartMinutes < slotRange.end) || // Starts in this slot
      (appEndMinutes > slotRange.start && appEndMinutes <= slotRange.end) || // Ends in this slot
      (appStartMinutes <= slotRange.start && appEndMinutes >= slotRange.end) // Spans across this slot
    );
  };

  // Find uncovered patient slots (patients scheduled without therapist coverage)
  const findUncoveredPatients = useMemo(() => {
    // Temporarily disabled to fix incorrect flagging
    return [];
  }, [appointments, selectedDate]);

  // Toggle team expanded/collapsed
  const toggleTeam = (teamId) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  // Filter appointments based on search and filters
  const filterAppointments = (appointments) => {
    if (!appointments || !Array.isArray(appointments)) return [];
    
    return appointments.filter(app => {
      if (!app) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const patientName = `${app.patient?.firstName || ''} ${app.patient?.lastName || ''}`.toLowerCase();
        const therapistName = `${app.therapist?.firstName || ''} ${app.therapist?.lastName || ''}`.toLowerCase();
        const location = app.location?.name?.toLowerCase() || '';
        
        if (!patientName.includes(query) && 
            !therapistName.includes(query) && 
            !location.includes(query)) {
          return false;
        }
      }
      
      // Service type filter
      if (selectedServiceType && getAppointmentServiceType(app) !== selectedServiceType) {
        return false;
      }
      
      // Therapist filter
      if (selectedTherapist && app.therapistId !== selectedTherapist) {
        return false;
      }
      
      // Patient filter
      if (selectedPatient && app.patient?.id !== selectedPatient) {
        return false;
      }
      
      return true;
    });
  };
  
  // Handle drag end for appointments
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    
    // Get the appointment that was dragged
    const appointment = appointments.find(app => app.id === draggableId);
    if (!appointment) return;
    
    // Get the time slot that the appointment was dragged to
    const targetTimeSlot = TIME_SLOTS[destination.index];
    const [targetStartHour, targetStartMinute] = targetTimeSlot.split('-')[0].split(':').map(Number);
    
    // Calculate the time difference between the appointment's original start time and end time
    const originalStart = new Date(appointment.startTime);
    const originalEnd = new Date(appointment.endTime);
    const durationMinutes = (originalEnd - originalStart) / (1000 * 60);
    
    // Create new start and end times
    const newStart = new Date(selectedDate);
    newStart.setHours(targetStartHour, targetStartMinute, 0, 0);
    
    const newEnd = new Date(newStart);
    newEnd.setMinutes(newStart.getMinutes() + durationMinutes);
    
    // Create updated appointment object
    const updatedAppointment = {
      ...appointment,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString()
    };
    
    // Call the update handler
    onAppointmentUpdate(updatedAppointment);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedServiceType('');
    setSelectedTherapist('');
    setSelectedPatient('');
  };

  // Get all therapists from appointments if no teams exist
  const getTherapistsFromAppointments = () => {
    const therapists = {};
    
    if (!appointments || !Array.isArray(appointments)) return [];
    
    appointments.forEach(app => {
      if (app?.therapist && app.therapistId) {
        therapists[app.therapistId] = app.therapist;
      }
    });
    
    return Object.values(therapists);
  };
  
  // Check if teams data is empty and we're not showing location view
  if ((!teams || !Array.isArray(teams) || teams.length === 0) && 
      !props.showLocationView) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Teams Available</p>
        <p>There are no teams configured yet. Create teams to use this view.</p>
      </div>
    );
  }
  
  // If no teams but show location view is on, create a virtual "Location" team
  // with all therapists extracted from appointments
  const displayTeams = teams.length > 0 ? teams : [{
    id: 'location-team',
    name: 'Location',
    Members: getTherapistsFromAppointments()
  }];

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            placeholder="Search patient, therapist..."
            className="pl-8 pr-4"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          
          {(userRole === 'bcba' || userRole === 'admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNameToggle(!showNameToggle)}
              title={showNameToggle ? "Show full names" : "Use HIPAA-compliant names"}
              className="flex items-center"
            >
              <Eye className="h-4 w-4 mr-1" />
              {showNameToggle ? "HIPAA Mode" : "Full Names"}
            </Button>
          )}
        </div>
      </div>
      
      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Therapist</label>
              <select
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={selectedTherapist}
                onChange={(e) => setSelectedTherapist(e.target.value)}
              >
                <option value="">All Therapists</option>
                {allTherapists.map(therapist => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.firstName} {therapist.lastName}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Patient</label>
              <select
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                <option value="">All Patients</option>
                {allPatients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <select
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={selectedServiceType}
                onChange={(e) => setSelectedServiceType(e.target.value)}
              >
                <option value="">All Service Types</option>
                {serviceTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      )}
      
      {/* Team schedule view */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {displayTeams.map(team => {
          const isExpanded = expandedTeams[team.id] !== false; // Default to expanded
          
          return (
            <div 
              key={team.id} 
              className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm"
            >
              {/* Team Header */}
              <div 
                className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b dark:border-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => toggleTeam(team.id)}
              >
                <div>
                  <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
                    {team.id === 'location-team' ? 'Location Schedule' : `TEAM ${team.LeadBCBA?.firstName || team.name || team.id}`}
                  </h3>
                  {team.id !== 'location-team' && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Lead: {team.LeadBCBA ? `${team.LeadBCBA.firstName} ${team.LeadBCBA.lastName}` : 'Unassigned'}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  {isExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              
              {isExpanded && (
                <div className="overflow-x-auto">
                  <Droppable droppableId={`team-${team.id}`} direction="vertical">
                    {(provided) => (
                      <div 
                        className="min-w-[800px]"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {/* Header rows with day, date, and therapist names */}
                        <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                          <div className="p-2 font-medium border-r dark:border-gray-700 text-center">
                            {formatDayOfWeek(selectedDate)}
                          </div>
                          
                          {team.Members?.map(member => (
                            <div 
                              key={member.id} 
                              className={cn(
                                "p-2 font-medium border-r dark:border-gray-700 text-center",
                                selectedTherapist === member.id && "bg-blue-100 dark:bg-blue-900/30"
                              )}
                            >
                              {member.firstName} {member.lastName}
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                          <div className="p-2 font-medium border-r dark:border-gray-700 text-center">
                            {formatDayOfMonth(selectedDate)}
                          </div>
                          
                          {team.Members?.map(member => (
                            <div key={member.id} className="p-2 font-medium border-r dark:border-gray-700 text-center">
                              {member.firstName}
                            </div>
                          ))}
                        </div>

                        {/* Time slots */}
                        {timeSlots.map((timeSlot, index) => {
                          const [startTime, endTime] = timeSlot.split('-');
                          return (
                            <div 
                              key={index}
                              className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b dark:border-gray-700"
                            >
                              {/* Time column */}
                              <div className="p-2 text-sm border-r dark:border-gray-700 font-medium text-center">
                                {formatDisplayTime(startTime)} - {formatDisplayTime(endTime)}
                              </div>

                              {/* Therapist columns */}
                              {team.Members?.map(member => {
                                const therapistGroups = getTherapistAppointments(member.id);
                                
                                // Find the group that overlaps with this time slot
                                const groupInSlot = therapistGroups.find(group => {
                                  const spannedSlots = getSpannedTimeSlots(group, timeSlotMap);
                                  return spannedSlots.includes(timeSlot);
                                });
                                
                                const serviceType = groupInSlot ? getAppointmentServiceType(groupInSlot) : null;
                                const position = groupInSlot ? getGroupPositionInSlot(groupInSlot, timeSlot, timeSlotMap) : null;
                                
                                // Check for uncovered appointments
                                const uncoveredInSlot = findUncoveredPatients.filter(app => 
                                  isAppointmentInTimeSlot(app, timeSlot) && app.therapistId === member.id
                                );
                                const hasUncovered = uncoveredInSlot.length > 0;
                                
                                // Determine border styles for grouped appointments
                                let borderStyles = "border-r dark:border-gray-700";
                                let additionalStyles = "";
                                
                                if (groupInSlot && position) {
                                  if (!position.isLastSlot && !position.isOnlySlot) {
                                    borderStyles += " border-b-transparent"; // Remove bottom border for continuing groups
                                  }
                                  if (!position.isFirstSlot && !position.isOnlySlot) {
                                    additionalStyles += " rounded-t-none"; // Remove top rounding for continuing groups
                                  }
                                  if (!position.isLastSlot && !position.isOnlySlot) {
                                    additionalStyles += " rounded-b-none"; // Remove bottom rounding for continuing groups
                                  }
                                  if (position.isFirstSlot && !position.isOnlySlot) {
                                    additionalStyles += " rounded-b-none rounded-t-md"; // Round only top for first slot
                                  }
                                  if (position.isLastSlot && !position.isOnlySlot) {
                                    additionalStyles += " rounded-t-none rounded-b-md"; // Round only bottom for last slot
                                  }
                                }
                                
                                return (
                                  <Draggable 
                                    key={`${member.id}-${timeSlot}`}
                                    draggableId={groupInSlot?.id || `empty-${member.id}-${timeSlot}`}
                                    index={index}
                                    isDragDisabled={!groupInSlot}
                                  >
                                    {(provided, snapshot) => (
                                      <div 
                                        className={cn(
                                          "p-2 min-h-[2.5rem] text-center text-sm relative",
                                          borderStyles,
                                          additionalStyles,
                                          groupInSlot && "cursor-pointer hover:opacity-80",
                                          hasUncovered 
                                            ? SERVICE_TYPE_COLORS.uncovered
                                            : serviceType && SERVICE_TYPE_COLORS[serviceType],
                                          snapshot.isDragging && "opacity-70 shadow-md",
                                          searchQuery && groupInSlot && "ring-2 ring-yellow-400 dark:ring-yellow-600"
                                        )}
                                        onClick={groupInSlot ? () => onAppointmentClick(groupInSlot.appointments[0]) : undefined}
                                        title={
                                          hasUncovered 
                                            ? `⚠️ UNCOVERED: ${formatFullPatientName(uncoveredInSlot[0].patient)} - ${uncoveredInSlot[0].reason}`
                                            : groupInSlot 
                                              ? `${formatFullPatientName(groupInSlot.patient)} - ${formatTime(groupInSlot.startTime)} to ${formatTime(groupInSlot.endTime)}`
                                              : ''
                                        }
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                      >
                                        {groupInSlot ? (
                                          <div className="font-medium">
                                            {hasUncovered && <span className="text-xs">⚠️ </span>}
                                            {/* Only show patient name in the first slot of the group */}
                                            {position?.isFirstSlot || position?.isOnlySlot ? (
                                              <span 
                                                title={formatFullPatientName(groupInSlot.patient)}
                                                className="cursor-help"
                                              >
                                                {formatPatientName(groupInSlot.patient)}
                                              </span>
                                            ) : null}
                                          </div>
                                        ) : null}
                                        {hasUncovered && (
                                          <div className="absolute top-0 right-0 -mt-1 -mr-1">
                                            <div className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                            </div>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  
                  {/* List of today's appointments for this team */}
                  <div className="p-4 border-t dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">
                      Appointments for {format(new Date(selectedDate), 'MMMM d, yyyy')}
                    </h4>
                    
                    <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {(() => {
                        const allGroups = team.Members?.flatMap(member => {
                          const therapistGroups = getTherapistAppointments(member.id);
                          // Filter groups based on the filtered appointments
                          const filteredGroups = therapistGroups.filter(group => {
                            return filterAppointments(group.appointments).length > 0;
                          });
                          return filteredGroups.map(group => ({
                            ...group,
                            therapistName: `${member.firstName} ${member.lastName}`
                          }));
                        }) || [];
                        
                        // Sort groups by start time
                        const sortedGroups = allGroups.sort((a, b) => {
                          return new Date(a.startTime) - new Date(b.startTime);
                        });
                        
                        return sortedGroups.length > 0 ? (
                          sortedGroups.map(group => (
                            <div 
                              key={group.id} 
                              className={cn(
                                "p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer",
                                searchQuery && searchQuery.toLowerCase() && 
                                  (group.patient?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                   group.patient?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   group.therapistName?.toLowerCase().includes(searchQuery.toLowerCase())) && 
                                  "bg-yellow-50 dark:bg-yellow-900/20"
                              )}
                              onClick={() => onAppointmentClick(group.appointments[0])}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">
                                    <span 
                                      title={formatFullPatientName(group.patient)}
                                      className="cursor-help"
                                    >
                                      {formatPatientName(group.patient)}
                                    </span>
                                    {group.appointments.length > 1 && (
                                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                        {group.appointments.length} sessions
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    with {group.therapistName}
                                  </div>
                                </div>
                                <div className={cn(
                                  "text-xs px-2 py-1 rounded-full",
                                  SERVICE_TYPE_COLORS[getAppointmentServiceType(group) || 'default']
                                )}>
                                  {group.serviceType || getAppointmentServiceType(group) || 'Session'}
                                </div>
                              </div>
                              
                              <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>{formatTime(group.startTime)} - {formatTime(group.endTime)}</span>
                                {group.totalDuration && (
                                  <span className="ml-2">({group.totalDuration} mins)</span>
                                )}
                              </div>
                              
                              {group.location && (
                                <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  <span>{group.location.name}</span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            No appointments scheduled for this team today
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
}