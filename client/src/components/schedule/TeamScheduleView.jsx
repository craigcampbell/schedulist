import React, { useState } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { cn } from '../../lib/utils';
import { Clock, MapPin, User, Calendar, Plus } from 'lucide-react';
import { Button } from '../ui/button';

const SERVICE_TYPE_COLORS = {
  direct: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
  indirect: 'bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200',
  supervision: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
  noOw: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
  lunch: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
  circle: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
  cleaning: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
  jojo: 'bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  zeki: 'bg-amber-200 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  jonDu: 'bg-blue-200 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  masa: 'bg-cyan-200 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200',
  brTa: 'bg-lime-200 dark:bg-lime-900/30 text-lime-800 dark:text-lime-200',
  krRi: 'bg-purple-200 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  leYu: 'bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
  liWu: 'bg-pink-200 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200'
};

const TIME_SLOTS = [
  "7:30-8:00", "8:00-8:30", "8:30-9:00", "9:00-9:30", "9:30-10:00", 
  "10:00-10:30", "10:30-11:00", "11:00-11:30", "11:30-12:00", "12:00-12:30", 
  "12:30-1:00", "1:00-1:30", "1:30-2:00", "2:00-2:30", "2:30-3:00", 
  "3:00-3:30", "3:30-4:00", "4:00-4:30", "4:30-5:00", "5:00-5:30"
];

const TIME_SLOT_MAP = {
  "7:30-8:00": [7.5, 8.0],
  "8:00-8:30": [8.0, 8.5],
  "8:30-9:00": [8.5, 9.0],
  "9:00-9:30": [9.0, 9.5],
  "9:30-10:00": [9.5, 10.0],
  "10:00-10:30": [10.0, 10.5],
  "10:30-11:00": [10.5, 11.0],
  "11:00-11:30": [11.0, 11.5],
  "11:30-12:00": [11.5, 12.0],
  "12:00-12:30": [12.0, 12.5],
  "12:30-1:00": [12.5, 13.0],
  "1:00-1:30": [13.0, 13.5],
  "1:30-2:00": [13.5, 14.0],
  "2:00-2:30": [14.0, 14.5],
  "2:30-3:00": [14.5, 15.0],
  "3:00-3:30": [15.0, 15.5],
  "3:30-4:00": [15.5, 16.0],
  "4:00-4:30": [16.0, 16.5],
  "4:30-5:00": [16.5, 17.0],
  "5:00-5:30": [17.0, 17.5]
};

export default function TeamScheduleView({ 
  teams, 
  appointments = [], 
  selectedDate,
  showLocationView = false,
  userRole = null, // Add userRole prop to determine name display format
  onAppointmentClick = () => {},
  onCellClick = () => {}
}) {
  const [expandedTeams, setExpandedTeams] = useState({});
  const [selectedAppointment, setSelectedAppointment] = useState(null);

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

  // Format patient name based on user role
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    // For all roles in schedule view, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  // Group appointments by therapist
  const getTherapistAppointments = (therapistId) => {
    // Filter appointments for this therapist on the selected date
    return appointments.filter(app => 
      app.therapistId === therapistId &&
      isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
  };
  
  // Get appointments for a specific date
  const getAppointmentsForDate = () => {
    return appointments.filter(app => 
      isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
  };
  
  // Group appointments by therapist without team information
  const getTherapistGroups = () => {
    const therapistGroups = {};
    const dateAppointments = getAppointmentsForDate();
    
    dateAppointments.forEach(app => {
      if (!app.therapistId || !app.therapist) return;
      
      if (!therapistGroups[app.therapistId]) {
        therapistGroups[app.therapistId] = {
          id: app.therapistId,
          name: app.therapist.name || `${app.therapist.firstName || ''} ${app.therapist.lastName || ''}`,
          firstName: app.therapist.firstName,
          lastName: app.therapist.lastName,
          appointments: []
        };
      }
      
      therapistGroups[app.therapistId].appointments.push(app);
    });
    
    return Object.values(therapistGroups);
  };

  // Check if an appointment is in a time slot
  const isAppointmentInTimeSlot = (appointment, timeSlot) => {
    const [slotStart, slotEnd] = TIME_SLOT_MAP[timeSlot] || [];
    if (!slotStart || !slotEnd) return false;

    const appStart = new Date(appointment.startTime);
    const appEnd = new Date(appointment.endTime);
    
    const appStartHour = appStart.getHours() + (appStart.getMinutes() / 60);
    const appEndHour = appEnd.getHours() + (appEnd.getMinutes() / 60);

    // Check if appointment overlaps with this time slot
    return (
      (appStartHour >= slotStart && appStartHour < slotEnd) || // Starts in this slot
      (appEndHour > slotStart && appEndHour <= slotEnd) || // Ends in this slot
      (appStartHour <= slotStart && appEndHour >= slotEnd) // Spans across this slot
    );
  };

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

  // Toggle team expanded/collapsed
  const toggleTeam = (teamId) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  // Handle appointment click
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    onAppointmentClick(appointment);
  };

  const closeAppointmentDetails = () => {
    setSelectedAppointment(null);
  };

  // If showing location view (no teams) but have appointments
  if (showLocationView && appointments.length > 0) {
    const therapistGroups = getTherapistGroups();
    
    if (therapistGroups.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No Appointments</p>
          <p>There are no appointments scheduled for this date.</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-8">
        <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b dark:border-gray-700">
            <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
              Location Schedule {format(new Date(selectedDate), 'MMMM d, yyyy')}
            </h3>
          </div>
          
          <div className="p-4">
            <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
              {therapistGroups.map(therapist => (
                <div key={therapist.id} className="p-3">
                  <h4 className="font-medium mb-2">{therapist.name}</h4>
                  <div className="pl-4 divide-y divide-gray-100 dark:divide-gray-800">
                    {therapist.appointments.map(app => (
                      <div 
                        key={app.id} 
                        className="py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => handleAppointmentClick(app)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              <span 
                                title={formatFullPatientName(app.patient)}
                                className="cursor-help"
                              >
                                {formatPatientName(app.patient)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatTime(app.startTime)} - {formatTime(app.endTime)}
                            </div>
                          </div>
                          <div className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            SERVICE_TYPE_COLORS[getAppointmentServiceType(app) || 'direct']
                          )}>
                            {app.serviceType || getAppointmentServiceType(app) || 'Session'}
                          </div>
                        </div>
                        
                        {app.location && (
                          <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{app.location.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No teams available and not showing location view
  if (teams.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Teams Available</p>
        <p>There are no teams configured yet. Create teams to use this view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {teams.map(team => {
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
                  TEAM {team.LeadBCBA?.firstName || team.name || team.id}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Lead: {team.LeadBCBA ? `${team.LeadBCBA.firstName} ${team.LeadBCBA.lastName}` : 'Unassigned'}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
            
            {isExpanded && (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Header rows with day, date, and therapist names */}
                  <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="p-2 font-medium border-r border-b dark:border-gray-700 text-center">
                      {formatDayOfWeek(selectedDate)}
                    </div>
                    
                    {/* BCBA header row */}
                    <div className={`col-span-${team.Members?.length || 1} p-2 font-medium border-r border-b dark:border-gray-700 text-right pr-5`}>
                      {team.LeadBCBA?.firstName || ""} (BCBA)
                    </div>
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
                  {TIME_SLOTS.map((timeSlot, i) => (
                    <div 
                      key={i}
                      className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b dark:border-gray-700"
                    >
                      {/* Time column */}
                      <div className="p-2 text-sm border-r dark:border-gray-700 font-medium text-center">
                        {timeSlot}
                      </div>

                      {/* Therapist columns */}
                      {team.Members?.map(member => {
                        const therapistApps = getTherapistAppointments(member.id);
                        const appointmentsInSlot = therapistApps.filter(app => isAppointmentInTimeSlot(app, timeSlot));
                        const appointmentForDisplay = appointmentsInSlot[0]; // Just show the first one if multiple
                        const serviceType = appointmentForDisplay ? getAppointmentServiceType(appointmentForDisplay) : null;
                        
                        return (
                          <div 
                            key={member.id}
                            className={cn(
                              "p-2 border-r dark:border-gray-700 min-h-[2.5rem] text-center text-sm cursor-pointer transition-colors group",
                              appointmentForDisplay && "hover:opacity-80",
                              !appointmentForDisplay && "hover:bg-blue-50 dark:hover:bg-blue-900/20",
                              serviceType && SERVICE_TYPE_COLORS[serviceType]
                            )}
                            onClick={appointmentForDisplay ? 
                              () => onAppointmentClick(appointmentForDisplay) : 
                              () => onCellClick({ 
                                therapistId: member.id, 
                                timeSlot, 
                                selectedDate, 
                                teamId: team.id,
                                leadBcbaId: team.LeadBCBA?.id 
                              })
                            }
                            title={appointmentForDisplay ? 
                              `${formatPatientName(appointmentForDisplay.patient)} - ${formatTime(appointmentForDisplay.startTime)} to ${formatTime(appointmentForDisplay.endTime)}` : 
                              'Click to add appointment'
                            }
                          >
                            {appointmentsInSlot.length > 0 ? (
                              <div className="font-medium">
                                <span 
                                  title={formatFullPatientName(appointmentForDisplay.patient)}
                                  className="cursor-help"
                                >
                                  {formatPatientName(appointmentForDisplay.patient)}
                                </span>
                                {appointmentsInSlot.length > 1 && ` +${appointmentsInSlot.length - 1}`}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus className="h-3 w-3 text-gray-400" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* List of today's appointments for this team */}
                <div className="p-4 border-t dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">
                    Appointments for {format(new Date(selectedDate), 'MMMM d, yyyy')}
                  </h4>
                  
                  <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {team.Members?.flatMap(member => {
                      const therapistApps = getTherapistAppointments(member.id);
                      return therapistApps.map(app => (
                        <div 
                          key={app.id} 
                          className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => handleAppointmentClick(app)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                <span 
                                  title={formatFullPatientName(app.patient)}
                                  className="cursor-help"
                                >
                                  {formatPatientName(app.patient)}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                with {member.firstName} {member.lastName}
                              </div>
                            </div>
                            <div className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              SERVICE_TYPE_COLORS[getAppointmentServiceType(app) || 'direct']
                            )}>
                              {app.serviceType || getAppointmentServiceType(app) || 'Session'}
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{formatTime(app.startTime)} - {formatTime(app.endTime)}</span>
                          </div>
                          
                          {app.location && (
                            <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <MapPin className="h-4 w-4 mr-1" />
                              <span>{app.location.name}</span>
                            </div>
                          )}
                        </div>
                      ));
                    }).sort((a, b) => {
                      // Sort by appointment start time
                      const timeA = a.props.children[2].props.children[1].props.children.split(' - ')[0];
                      const timeB = b.props.children[2].props.children[1].props.children.split(' - ')[0];
                      const dateA = new Date(`${format(selectedDate, 'yyyy-MM-dd')} ${timeA}`);
                      const dateB = new Date(`${format(selectedDate, 'yyyy-MM-dd')} ${timeB}`);
                      return dateA - dateB;
                    }).length > 0 ? (
                      team.Members?.flatMap(member => {
                        const therapistApps = getTherapistAppointments(member.id);
                        return therapistApps.map(app => (
                          <div 
                            key={app.id} 
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                            onClick={() => handleAppointmentClick(app)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">
                                  <span 
                                    title={formatFullPatientName(app.patient)}
                                    className="cursor-help"
                                  >
                                    {formatPatientName(app.patient)}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  with {member.firstName} {member.lastName}
                                </div>
                              </div>
                              <div className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                SERVICE_TYPE_COLORS[getAppointmentServiceType(app) || 'direct']
                              )}>
                                {app.serviceType || getAppointmentServiceType(app) || 'Session'}
                              </div>
                            </div>
                            
                            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{formatTime(app.startTime)} - {formatTime(app.endTime)}</span>
                            </div>
                            
                            {app.location && (
                              <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <MapPin className="h-4 w-4 mr-1" />
                                <span>{app.location.name}</span>
                              </div>
                            )}
                          </div>
                        ));
                      }).sort((a, b) => {
                        // Sort by appointment start time
                        const getStartTime = (component) => {
                          const timeText = component.props.children[2].props.children[1].props.children;
                          const timeStr = timeText.split(' - ')[0];
                          const dateStr = `${format(selectedDate, 'yyyy-MM-dd')} ${timeStr}`;
                          return new Date(dateStr);
                        };
                        return getStartTime(a) - getStartTime(b);
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No appointments scheduled for this team today
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <Button variant="ghost" size="sm" onClick={closeAppointmentDetails}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Patient</h3>
                <p className="text-lg">
                  {formatFullPatientName(selectedAppointment.patient)}
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Time</h3>
                <p>
                  {format(new Date(selectedAppointment.startTime), 'PPPP')}
                </p>
                <p>
                  {formatTime(selectedAppointment.startTime)} - {formatTime(selectedAppointment.endTime)}
                </p>
              </div>
              
              {selectedAppointment.location && (
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Location</h3>
                  <p>{selectedAppointment.location.name}</p>
                </div>
              )}
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Service Type</h3>
                <div className={cn(
                  "inline-block px-2 py-1 rounded-full text-sm",
                  SERVICE_TYPE_COLORS[getAppointmentServiceType(selectedAppointment) || 'direct']
                )}>
                  {selectedAppointment.serviceType || getAppointmentServiceType(selectedAppointment) || 'Direct Service'}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Status</h3>
                <div className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-sm">
                  {selectedAppointment.status || 'Scheduled'}
                </div>
              </div>
              
              {selectedAppointment.notes && (
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Notes</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedAppointment.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end pt-4">
                <Button onClick={closeAppointmentDetails}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}