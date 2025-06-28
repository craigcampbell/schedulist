import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isSameDay, isValid, addDays, addMinutes, startOfDay, endOfDay } from 'date-fns';
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
  Eye,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../../components/ui/input';

// Colors for different appointment statuses
const APPOINTMENT_COLORS = {
  covered: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
  uncovered: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-2 border-red-500 animate-pulse',
  partial: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
  gap: 'bg-red-500 dark:bg-red-600 text-white animate-pulse',
  therapist: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
};

// Generate time slots based on day schedule (e.g., 8:00 AM to 6:00 PM in 30-minute increments)
const generateTimeSlots = (startHour = 8, endHour = 18) => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }
  return slots;
};

export default function UnifiedScheduleView({
  appointments = [],
  patients = [],
  therapists = [],
  selectedDate,
  onAppointmentUpdate = () => {},
  onAppointmentClick = () => {},
  userRole = null
}) {
  // Debug logging
  console.log('UnifiedScheduleView props:', {
    appointments: appointments?.length || 0,
    patients: patients?.length || 0,
    therapists: therapists?.length || 0,
    selectedDate,
    userRole
  });
  console.log('Sample appointment:', appointments?.[0]);
  console.log('Sample patient:', patients?.[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  
  // Generate time slots for the day
  const timeSlots = useMemo(() => generateTimeSlots(8, 18), []);
  
  // Format patient name based on user role
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    // For all roles in unified schedule view, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  // Filter appointments for the selected date
  const todaysAppointments = useMemo(() => {
    if (!Array.isArray(appointments)) return [];
    return appointments.filter(app => {
      try {
        return app && app.startTime && isSameDay(new Date(app.startTime), new Date(selectedDate));
      } catch (error) {
        console.warn('Invalid appointment date:', app);
        return false;
      }
    });
  }, [appointments, selectedDate]);

  // Group appointments by patient
  const patientSchedules = useMemo(() => {
    const schedules = {};
    
    // Initialize with all patients
    if (Array.isArray(patients)) {
      patients.forEach(patient => {
        if (patient && patient.id) {
          schedules[patient.id] = {
            patient,
            appointments: [],
            totalHours: 0,
            gaps: []
          };
        }
      });
    }
    
    // Add appointments to patient schedules
    todaysAppointments.forEach(appointment => {
      if (appointment.patient?.id) {
        // Create patient schedule if it doesn't exist (in case patient not in patients array)
        if (!schedules[appointment.patient.id]) {
          schedules[appointment.patient.id] = {
            patient: appointment.patient,
            appointments: [],
            totalHours: 0,
            gaps: []
          };
        }
        schedules[appointment.patient.id].appointments.push(appointment);
      }
    });
    
    // Calculate coverage and identify uncovered appointments for each patient
    Object.values(schedules).forEach(schedule => {
      if (schedule.appointments.length === 0) return;
      
      // Sort appointments by start time
      schedule.appointments.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      // Calculate total scheduled hours
      schedule.totalHours = schedule.appointments.reduce((total, app) => {
        const duration = (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60 * 60);
        return total + duration;
      }, 0);
      
      // Count uncovered appointments (patient appointments without therapist)
      schedule.uncoveredAppointments = schedule.appointments.filter(app => !app.therapistId);
      schedule.coveredAppointments = schedule.appointments.filter(app => app.therapistId);
      
      // For now, gaps will be empty - we're focusing on showing patient appointments and their coverage
      schedule.gaps = [];
    });
    
    console.log('Patient schedules:', schedules);
    return schedules;
  }, [todaysAppointments, patients]);

  // Filter patient schedules based on search and filters
  const filteredSchedules = useMemo(() => {
    return Object.values(patientSchedules).filter(schedule => {
      // Search filter
      if (searchQuery) {
        const patientName = `${schedule.patient.firstName || ''} ${schedule.patient.lastName || ''}`.toLowerCase();
        if (!patientName.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      
      // Patient filter
      if (selectedPatient && schedule.patient.id !== selectedPatient) {
        return false;
      }
      
      // Therapist filter
      if (selectedTherapist) {
        const hasTherapist = schedule.appointments.some(app => app.therapistId === selectedTherapist);
        if (!hasTherapist) return false;
      }
      
      // Show uncovered appointments only filter
      if (showGapsOnly && schedule.uncoveredAppointments?.length === 0) {
        return false;
      }
      
      return schedule.appointments.length > 0; // Only show patients with appointments today
    });
  }, [patientSchedules, searchQuery, selectedPatient, selectedTherapist, showGapsOnly]);

  console.log('Filtered schedules:', filteredSchedules.length, filteredSchedules);

  // Get time slot position for an appointment
  const getTimeSlotPosition = (timeString) => {
    const date = new Date(timeString);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const slotIndex = (hour - 8) * 2 + (minute >= 30 ? 1 : 0);
    return Math.max(0, slotIndex);
  };

  // Get duration in slots (30-min increments)
  const getDurationInSlots = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.ceil(durationMinutes / 30);
  };

  // Handle drag end for rescheduling
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    
    // Find the appointment being dragged
    const appointment = todaysAppointments.find(app => app.id === draggableId);
    if (!appointment) return;
    
    // Calculate new time based on destination
    const newSlotIndex = destination.index;
    const newHour = Math.floor(newSlotIndex / 2) + 8;
    const newMinute = (newSlotIndex % 2) * 30;
    
    // Create new start time
    const newStart = new Date(selectedDate);
    newStart.setHours(newHour, newMinute, 0, 0);
    
    // Calculate duration and new end time
    const originalDuration = new Date(appointment.endTime) - new Date(appointment.startTime);
    const newEnd = new Date(newStart.getTime() + originalDuration);
    
    // Update appointment
    const updatedAppointment = {
      ...appointment,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString()
    };
    
    onAppointmentUpdate(updatedAppointment);
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            placeholder="Search patients..."
            className="pl-8 pr-4"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-sm"
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
          >
            <option value="">All Patients</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {formatPatientName(patient)}
              </option>
            ))}
          </select>
          
          <select
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-sm"
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
          >
            <option value="">All Therapists</option>
            {therapists.map(therapist => (
              <option key={therapist.id} value={therapist.id}>
                {therapist.firstName} {therapist.lastName}
              </option>
            ))}
          </select>
          
          <Button
            variant={showGapsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGapsOnly(!showGapsOnly)}
            className="flex items-center"
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Uncovered Only
          </Button>
        </div>
      </div>

      {/* Unified Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            🔄 UNIFIED CALENDAR - Schedule for {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredSchedules.length} patients scheduled (Debug: A:{appointments?.length} P:{patients?.length} T:{therapists?.length})
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Time header */}
              <div className="grid grid-cols-[200px_repeat(20,60px)] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                <div className="p-2 font-medium border-r dark:border-gray-700">
                  Patient
                </div>
                {timeSlots.map((slot, index) => (
                  <div key={index} className="p-1 text-xs font-medium border-r dark:border-gray-700 text-center">
                    {slot}
                  </div>
                ))}
              </div>

              {/* Patient rows */}
              {console.log('Rendering schedules:', filteredSchedules.length) || filteredSchedules.map(schedule => (
                <Droppable key={schedule.patient.id} droppableId={`patient-${schedule.patient.id}`} direction="horizontal">
                  {(provided) => (
                    <div 
                      className="grid grid-cols-[200px_repeat(20,60px)] border-b dark:border-gray-700 min-h-[60px]"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {/* Patient info */}
                      <div className="p-3 border-r dark:border-gray-700 flex flex-col justify-center">
                        <div className="font-medium">{formatPatientName(schedule.patient)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {schedule.totalHours.toFixed(1)}h scheduled
                          <div className="mt-1">
                            <span className="text-green-600">{schedule.coveredAppointments?.length || 0} covered</span>
                            {schedule.uncoveredAppointments?.length > 0 && (
                              <span className="text-red-500 ml-2">
                                {schedule.uncoveredAppointments.length} uncovered
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Time slots */}
                      {timeSlots.map((slot, slotIndex) => {
                        // Find appointments that occupy this time slot
                        const appointmentsInSlot = schedule.appointments.filter(app => {
                          const appStart = getTimeSlotPosition(app.startTime);
                          const appDuration = getDurationInSlots(app.startTime, app.endTime);
                          return slotIndex >= appStart && slotIndex < appStart + appDuration;
                        });

                        const appointment = appointmentsInSlot[0]; // Get the first appointment in this slot

                        return (
                          <div
                            key={slotIndex}
                            className={cn(
                              "border-r dark:border-gray-700 relative min-h-[60px] flex items-center justify-center text-xs",
                              appointment && (appointment.therapistId ? APPOINTMENT_COLORS.covered : APPOINTMENT_COLORS.uncovered)
                            )}
                          >
                            {appointment && (
                              <Draggable 
                                draggableId={appointment.id} 
                                index={slotIndex}
                                key={appointment.id}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "absolute inset-1 rounded p-1 cursor-pointer flex flex-col items-center justify-center",
                                      appointment.therapistId ? APPOINTMENT_COLORS.covered : APPOINTMENT_COLORS.uncovered,
                                      snapshot.isDragging && "opacity-70 shadow-lg z-10"
                                    )}
                                    onClick={() => onAppointmentClick(appointment)}
                                    title={`Patient: ${formatFullPatientName(appointment.patient)} - ${appointment.therapist ? `Therapist: ${appointment.therapist.firstName} ${appointment.therapist.lastName}` : 'NO THERAPIST ASSIGNED'}`}
                                  >
                                    <div className="font-bold text-xs">
                                      {appointment.therapist ? 
                                        `${appointment.therapist.firstName.charAt(0)}${appointment.therapist.lastName.charAt(0)}` : 
                                        '⚠️'
                                      }
                                    </div>
                                    {!appointment.therapist && (
                                      <div className="text-[8px] text-red-600 font-bold">OPEN</div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            )}
                          </div>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </div>
        </DragDropContext>

        {filteredSchedules.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No patient schedules found for this date.</p>
            <div className="mt-4 text-sm">
              <p>Debug info:</p>
              <p>Appointments: {appointments?.length || 0}</p>
              <p>Patients: {patients?.length || 0}</p>
              <p>Therapists: {therapists?.length || 0}</p>
              <p>Today's appointments: {todaysAppointments?.length || 0}</p>
              <p>Patient schedules: {Object.keys(patientSchedules).length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-100 border rounded"></div>
          <span>Patient appointment with therapist assigned</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded animate-pulse"></div>
          <span>Patient appointment needs therapist (URGENT)</span>
        </div>
        <div className="text-gray-600">
          <strong>Drag appointments</strong> to reschedule therapist coverage
        </div>
      </div>
    </div>
  );
}