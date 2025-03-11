import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfDay, isSameDay, parseISO } from 'date-fns';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  Filter,
  Plus 
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { getSchedule } from '../../api/schedule';
import { getTherapists } from '../../api/bcba';
import { getPatients } from '../../api/patients';
import { getLocations } from '../../api/admin';
import { calculateAppointmentStyle, formatTime, generateTimeSlots } from '../../utils/date-utils';

export default function BCBASchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState('daily');
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  
  // Generate time slots from 8 AM to 6 PM with 15-minute intervals
  const timeSlots = generateTimeSlots(8, 18, 15);
  
  // Fetch therapists data
  const { data: therapists, isLoading: isLoadingTherapists } = useQuery({
    queryKey: ['therapists'],
    queryFn: getTherapists,
  });
  
  // Fetch locations data
  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => getLocations(true), // Only active locations
  });
  
  // Fetch patients data
  const { data: patients, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients('active'), // Only active patients
  });
  
  // Fetch schedule data
  const { data: scheduleData, isLoading: isLoadingSchedule, error: scheduleError, refetch: refetchSchedule } = useQuery({
    queryKey: [
      'bcbaSchedule', 
      viewType, 
      selectedDate.toISOString(),
      selectedTherapist,
      selectedLocation
    ],
    queryFn: () => getSchedule(
      viewType, 
      selectedDate.toISOString(), 
      selectedLocation, 
      selectedTherapist
    ),
  });
  
  // Navigate to previous day/week
  const navigatePrevious = () => {
    if (viewType === 'daily') {
      setSelectedDate(subDays(selectedDate, 1));
    } else if (viewType === 'weekly') {
      setSelectedDate(subDays(selectedDate, 7));
    }
  };
  
  // Navigate to next day/week
  const navigateNext = () => {
    if (viewType === 'daily') {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (viewType === 'weekly') {
      setSelectedDate(addDays(selectedDate, 7));
    }
  };
  
  // Navigate to today
  const navigateToday = () => {
    setSelectedDate(new Date());
  };
  
  // Toggle between daily and weekly views
  const toggleViewType = () => {
    setViewType(viewType === 'daily' ? 'weekly' : 'daily');
  };
  
  // Toggle filters visibility
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  // Handle appointment click
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
  };
  
  // Close appointment details modal
  const closeAppointmentDetails = () => {
    setSelectedAppointment(null);
  };
  
  // Toggle appointment form
  const toggleAppointmentForm = () => {
    setShowAppointmentForm(!showAppointmentForm);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedTherapist(null);
    setSelectedPatient(null);
    setSelectedLocation(null);
  };
  
  // Group appointments by therapist
  const groupAppointmentsByTherapist = () => {
    if (!scheduleData || !scheduleData.appointments) return {};
    
    const groupedAppointments = {};
    
    scheduleData.appointments.forEach(appointment => {
      const therapistId = appointment.therapist?.id;
      
      if (!therapistId) return;
      
      if (!groupedAppointments[therapistId]) {
        groupedAppointments[therapistId] = {
          therapist: appointment.therapist,
          appointments: []
        };
      }
      
      groupedAppointments[therapistId].appointments.push(appointment);
    });
    
    return groupedAppointments;
  };
  
  // Group appointments by patient
  const groupAppointmentsByPatient = () => {
    if (!scheduleData || !scheduleData.appointments) return {};
    
    const groupedAppointments = {};
    
    scheduleData.appointments.forEach(appointment => {
      const patientId = appointment.patient?.id;
      
      if (!patientId) return;
      
      if (!groupedAppointments[patientId]) {
        groupedAppointments[patientId] = {
          patient: appointment.patient,
          appointments: []
        };
      }
      
      groupedAppointments[patientId].appointments.push(appointment);
    });
    
    return groupedAppointments;
  };
  
  // Filter appointments for daily view by therapist
  const therapistGroups = groupAppointmentsByTherapist();
  const patientGroups = groupAppointmentsByPatient();
  
  // Loading state
  const isLoading = isLoadingTherapists || isLoadingLocations || isLoadingSchedule || isLoadingPatients;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold">Schedule</h1>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={toggleFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <Button variant="outline" size="sm" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
          
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={toggleViewType}>
            {viewType === 'daily' ? (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                <span>Weekly</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                <span>Daily</span>
              </>
            )}
          </Button>
          
          <Button size="sm" onClick={toggleAppointmentForm}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Therapist</label>
              <select 
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={selectedTherapist || ''}
                onChange={(e) => setSelectedTherapist(e.target.value || null)}
              >
                <option value="">All Therapists</option>
                {therapists?.map(therapist => (
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
                value={selectedPatient || ''}
                onChange={(e) => setSelectedPatient(e.target.value || null)}
              >
                <option value="">All Patients</option>
                {patients?.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select 
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={selectedLocation || ''}
                onChange={(e) => setSelectedLocation(e.target.value || null)}
              >
                <option value="">All Locations</option>
                {locations?.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.name}
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
      
      {/* Date display */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold">
          {viewType === 'daily' 
            ? format(selectedDate, 'PPPP') 
            : `Week of ${format(startOfDay(selectedDate), 'MMMM d, yyyy')}`}
        </h2>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex justify-center items-center">
          <p>Loading schedule...</p>
        </div>
      )}
      
      {/* Error state */}
      {scheduleError && (
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">Failed to load schedule</p>
            <Button onClick={refetchSchedule}>Try Again</Button>
          </div>
        </div>
      )}
      
      {/* Daily View - Side by Side Therapists and Patients */}
      {!isLoading && !scheduleError && viewType === 'daily' && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Therapist View */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b">
                <h3 className="font-semibold">Therapist Schedule</h3>
              </div>
              <div className="overflow-x-auto">
                <div className="schedule-grid min-w-[600px]">
                  {/* Time column */}
                  <div className="border-r border-gray-200 dark:border-gray-700">
                    {timeSlots.filter(slot => slot.getMinutes() === 0).map((time, i) => (
                      <div key={i} className="h-24 px-2 py-1 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {format(time, 'h a')}
                      </div>
                    ))}
                  </div>
                  
                  {/* Appointments column */}
                  <div className="relative">
                    {timeSlots.filter(slot => slot.getMinutes() === 0).map((time, i) => (
                      <div key={i} className="h-24 border-b border-gray-200 dark:border-gray-700">
                        {/* 15-minute lines */}
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 24}px` }}></div>
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 48}px` }}></div>
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 72}px` }}></div>
                      </div>
                    ))}
                    
                    {/* Appointments by therapist */}
                    {Object.values(therapistGroups).map((group) => (
                      group.appointments.map((appointment) => {
                        const style = calculateAppointmentStyle(appointment, 96); // 24px per hour * 4 = 96
                        
                        return (
                          <div
                            key={appointment.id}
                            className="appointment cursor-pointer absolute p-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            style={{
                              ...style,
                              left: '4px',
                              right: '4px',
                            }}
                            onClick={() => handleAppointmentClick(appointment)}
                          >
                            <div className="text-xs font-medium">
                              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                            </div>
                            <div className="font-medium truncate">
                              {appointment.therapist.name}: {appointment.patient.firstName} {appointment.patient.lastInitial}.
                            </div>
                          </div>
                        );
                      })
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Patient View */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 border-b">
                <h3 className="font-semibold">Patient Schedule</h3>
              </div>
              <div className="overflow-x-auto">
                <div className="schedule-grid min-w-[600px]">
                  {/* Time column */}
                  <div className="border-r border-gray-200 dark:border-gray-700">
                    {timeSlots.filter(slot => slot.getMinutes() === 0).map((time, i) => (
                      <div key={i} className="h-24 px-2 py-1 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {format(time, 'h a')}
                      </div>
                    ))}
                  </div>
                  
                  {/* Appointments column */}
                  <div className="relative">
                    {timeSlots.filter(slot => slot.getMinutes() === 0).map((time, i) => (
                      <div key={i} className="h-24 border-b border-gray-200 dark:border-gray-700">
                        {/* 15-minute lines */}
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 24}px` }}></div>
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 48}px` }}></div>
                        <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 72}px` }}></div>
                      </div>
                    ))}
                    
                    {/* Appointments by patient */}
                    {Object.values(patientGroups).map((group) => (
                      group.appointments.map((appointment) => {
                        const style = calculateAppointmentStyle(appointment, 96); // 24px per hour * 4 = 96
                        
                        return (
                          <div
                            key={appointment.id}
                            className="appointment cursor-pointer absolute p-2 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            style={{
                              ...style,
                              left: '4px',
                              right: '4px',
                            }}
                            onClick={() => handleAppointmentClick(appointment)}
                          >
                            <div className="text-xs font-medium">
                              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                            </div>
                            <div className="font-medium truncate">
                              {appointment.patient.firstName} {appointment.patient.lastInitial}. with {appointment.therapist.name}
                            </div>
                          </div>
                        );
                      })
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Weekly View */}
      {!isLoading && !scheduleError && viewType === 'weekly' && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* Group by therapist */}
            {Object.values(therapistGroups).length > 0 ? (
              Object.values(therapistGroups).map((group) => (
                <div key={group.therapist.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b">
                    <h3 className="font-semibold">{group.therapist.name}</h3>
                  </div>
                  <div className="divide-y">
                    {group.appointments.map(appointment => (
                      <div
                        key={appointment.id}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => handleAppointmentClick(appointment)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {appointment.patient.firstName} {appointment.patient.lastInitial}.
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {format(parseISO(appointment.startTime), 'EEEE, MMMM d')}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                            </p>
                          </div>
                          <div className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            {appointment.status}
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <User className="h-4 w-4 mr-1" />
                          <span>{appointment.location?.name || 'No location'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No appointments scheduled for this week.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <Button variant="ghost" size="sm" onClick={closeAppointmentDetails}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Patient</h3>
                <p className="text-lg">{selectedAppointment.patient.firstName} {selectedAppointment.patient.lastInitial}.</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Therapist</h3>
                <p className="text-lg">{selectedAppointment.therapist.name}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Date & Time</h3>
                <p>{format(parseISO(selectedAppointment.startTime), 'PPPP')}</p>
                <p>{formatTime(selectedAppointment.startTime)} - {formatTime(selectedAppointment.endTime)}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Location</h3>
                <p>{selectedAppointment.location?.name || 'No location'}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Status</h3>
                <div className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  {selectedAppointment.status}
                </div>
              </div>
              
              {selectedAppointment.notes && (
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Notes</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedAppointment.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={closeAppointmentDetails}>
                  Close
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => {
                    // Navigate to patient page (to be implemented)
                    closeAppointmentDetails();
                  }}
                >
                  View Patient
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => {
                    // Edit appointment (to be implemented)
                    closeAppointmentDetails();
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Form (placeholder - will need to be fully implemented) */}
      {showAppointmentForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">New Appointment</h2>
              <Button variant="ghost" size="sm" onClick={toggleAppointmentForm}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* This form would be implemented with react-hook-form */}
              <p className="text-center text-gray-500 dark:text-gray-400">
                Appointment form would be implemented here with patient selection, therapist selection,
                date/time pickers, location selection, and other necessary fields.
              </p>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={toggleAppointmentForm}>
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => {
                    // Submit form logic would go here
                    toggleAppointmentForm();
                  }}
                >
                  Create Appointment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}