import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { format, addDays, subDays, startOfDay, isSameDay, parseISO, addMinutes } from 'date-fns';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  Filter,
  Plus,
  Check,
  X,
  Info,
  Users,
  Settings
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  getSchedule, 
  createAppointment, 
  createAppointmentNextSlot, 
  findNextAvailableSlot,
  getTeamSchedule
} from '../../api/schedule';
import { getTherapists, getAvailableBCBAs } from '../../api/bcba';
import { getPatients } from '../../api/patients';
import { getLocations } from '../../api/admin';
import { calculateAppointmentStyle, formatTime, generateTimeSlots } from '../../utils/date-utils';
import TeamScheduleView from '../../components/schedule/TeamScheduleView';
import EnhancedScheduleView from '../../components/schedule/EnhancedScheduleView';

export default function BCBASchedulePage() {
  // Import auth context to get user info
  const { user } = useAuth();
  
  // Get user's default location
  const getUserDefaultLocation = () => {
    if (user?.defaultLocationId) {
      return user.defaultLocationId;
    }
    if (user?.organization?.locations?.length > 0) {
      return user.organization.locations[0].id;
    }
    return null;
  };
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState('daily');
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  // Form state for new appointment with default location
  const defaultLocation = getUserDefaultLocation();
  const [formState, setFormState] = useState({
    patientId: '',
    therapistId: '',
    bcbaId: user?.id || '', // Default to current user if they're a BCBA
    locationId: defaultLocation || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '08:30',
    title: '',
    notes: '',
    useNextAvailableSlot: false,
    durationMinutes: 30,
    preferredDate: '',
    nextAvailablePreview: null,
    recurring: false,
    recurringType: 'weekly',
    recurringPattern: {
      type: 'weekly',
      endDate: ''
    },
    recurringEndDate: '',
    excludeWeekends: true,
    excludeHolidays: true
  });
  
  // QueryClient for cache invalidation
  const queryClient = useQueryClient();
  
  // Reset form when dialog is toggled
  useEffect(() => {
    if (showAppointmentForm) {
      setFormState({
        patientId: '',
        therapistId: '',
        bcbaId: user?.id || '', // Default to current user if they're a BCBA
        locationId: defaultLocation || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '08:30',
        title: '',
        notes: '',
        useNextAvailableSlot: false,
        durationMinutes: 30,
        preferredDate: '',
        nextAvailablePreview: null,
        recurring: false,
        recurringType: 'weekly',
        recurringPattern: {
          type: 'weekly',
          endDate: ''
        },
        recurringEndDate: '',
        excludeWeekends: true,
        excludeHolidays: true
      });
      setFormError(null);
    }
  }, [showAppointmentForm, user, defaultLocation]);
  
  // Check next available slot
  const handleCheckNextAvailable = async () => {
    if (!formState.therapistId || !formState.locationId) {
      setFormError('Please select a therapist and location first');
      return;
    }
    
    setIsCheckingAvailability(true);
    setFormError(null);
    
    try {
      const slot = await findNextAvailableSlot(
        formState.therapistId,
        formState.locationId,
        formState.preferredDate,
        formState.durationMinutes
      );
      
      setFormState({
        ...formState,
        nextAvailablePreview: slot
      });
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to find available slot');
    } finally {
      setIsCheckingAvailability(false);
    }
  };
  
  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      // Invalidate and refetch the schedule data
      queryClient.invalidateQueries(['bcbaSchedule']);
      setShowAppointmentForm(false);
    }
  });
  
  // Create appointment with next slot mutation
  const createAppointmentNextSlotMutation = useMutation({
    mutationFn: createAppointmentNextSlot,
    onSuccess: () => {
      // Invalidate and refetch the schedule data
      queryClient.invalidateQueries(['bcbaSchedule']);
      setShowAppointmentForm(false);
    }
  });
  
  // Handle appointment form submission
  const handleSubmitAppointment = async () => {
    // Validate form
    if (!formState.patientId) {
      setFormError('Please select a patient');
      return;
    }
    
    if (!formState.therapistId) {
      setFormError('Please select a therapist');
      return;
    }
    
    if (!formState.bcbaId) {
      setFormError('Please select a BCBA');
      return;
    }
    
    if (!formState.locationId) {
      setFormError('Please select a location');
      return;
    }
    
    if (!formState.useNextAvailableSlot) {
      if (!formState.date || !formState.startTime || !formState.endTime) {
        setFormError('Please select date and time');
        return;
      }
      
      // Validate that end time is after start time
      const startDateTime = new Date(`${formState.date}T${formState.startTime}`);
      const endDateTime = new Date(`${formState.date}T${formState.endTime}`);
      
      if (endDateTime <= startDateTime) {
        setFormError('End time must be after start time');
        return;
      }
      
      // Validate minimum session duration (30 minutes)
      const durationMs = endDateTime - startDateTime;
      const durationMinutes = durationMs / (1000 * 60);
      
      if (durationMinutes < 30) {
        setFormError('Session must be at least 30 minutes long');
        return;
      }
    }
    
    // If recurring, validate end date
    if (formState.recurring && !formState.recurringEndDate) {
      setFormError('Please select an end date for recurring appointments');
      return;
    }
    
    setIsSubmittingForm(true);
    setFormError(null);
    
    try {
      if (formState.useNextAvailableSlot) {
        // Use next available slot
        await createAppointmentNextSlotMutation.mutateAsync({
          patientId: formState.patientId,
          therapistId: formState.therapistId,
          bcbaId: formState.bcbaId,
          locationId: formState.locationId,
          durationMinutes: formState.durationMinutes,
          preferredDate: formState.preferredDate || undefined,
          title: formState.title || undefined,
          notes: formState.notes || undefined,
          recurring: formState.recurring,
          recurringPattern: formState.recurring ? formState.recurringPattern : undefined,
          excludeWeekends: formState.excludeWeekends,
          excludeHolidays: formState.excludeHolidays
        });
      } else {
        // Use specified time
        const startDateTime = new Date(`${formState.date}T${formState.startTime}`);
        const endDateTime = new Date(`${formState.date}T${formState.endTime}`);
        
        await createAppointmentMutation.mutateAsync({
          patientId: formState.patientId,
          therapistId: formState.therapistId,
          bcbaId: formState.bcbaId,
          locationId: formState.locationId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          title: formState.title || undefined,
          notes: formState.notes || undefined,
          recurring: formState.recurring,
          recurringPattern: formState.recurring ? formState.recurringPattern : undefined,
          excludeWeekends: formState.excludeWeekends,
          excludeHolidays: formState.excludeHolidays
        });
      }
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to create appointment');
    } finally {
      setIsSubmittingForm(false);
    }
  };
  
  // Generate time slots from 8 AM to 6 PM with 15-minute intervals
  const timeSlots = generateTimeSlots(8, 18, 15);
  
  // Fetch therapists data
  const { data: therapists, isLoading: isLoadingTherapists } = useQuery({
    queryKey: ['therapists'],
    queryFn: getTherapists,
  });
  
  // Fetch BCBAs data
  const { data: bcbas, isLoading: isLoadingBCBAs } = useQuery({
    queryKey: ['available-bcbas'],
    queryFn: getAvailableBCBAs,
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
    enabled: viewType === 'daily' || viewType === 'weekly'
  });
  
  // Fetch team schedule data
  const { data: teamScheduleData, isLoading: isLoadingTeamSchedule, error: teamScheduleError } = useQuery({
    queryKey: ['teamSchedule', selectedDate.toISOString()],
    queryFn: () => getTeamSchedule(selectedDate.toISOString()),
    enabled: viewType === 'team' || viewType === 'enhanced'
  });
  
  // Navigate to previous day/week
  const navigatePrevious = () => {
    if (viewType === 'daily') {
      setSelectedDate(subDays(selectedDate, 1));
    } else if (viewType === 'weekly' || viewType === 'team' || viewType === 'enhanced') {
      setSelectedDate(subDays(selectedDate, 7));
    }
  };
  
  // Navigate to next day/week
  const navigateNext = () => {
    if (viewType === 'daily') {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (viewType === 'weekly' || viewType === 'team' || viewType === 'enhanced') {
      setSelectedDate(addDays(selectedDate, 7));
    }
  };
  
  // Navigate to today
  const navigateToday = () => {
    setSelectedDate(new Date());
  };
  
  // Toggle between daily, weekly, and team views
  const toggleViewType = () => {
    if (viewType === 'daily') {
      setViewType('weekly');
    } else if (viewType === 'weekly') {
      setViewType('team');
    } else if (viewType === 'team') {
      setViewType('enhanced');
    } else {
      setViewType('daily');
    }
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
  const isLoading = isLoadingTherapists || isLoadingLocations || isLoadingPatients || isLoadingBCBAs ||
                  ((viewType === 'daily' || viewType === 'weekly') && isLoadingSchedule) || 
                  ((viewType === 'team' || viewType === 'enhanced') && isLoadingTeamSchedule);
  
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
            ) : viewType === 'weekly' ? (
              <>
                <Users className="h-4 w-4 mr-2" />
                <span>Team</span>
              </>
            ) : viewType === 'team' ? (
              <>
                <Settings className="h-4 w-4 mr-2" />
                <span>Enhanced</span>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b flex justify-between items-center">
                <h3 className="font-semibold">Therapist Schedule</h3>
                <Button variant="ghost" size="sm" onClick={toggleAppointmentForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="overflow-x-auto">
                {Object.values(therapistGroups).length > 0 ? (
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
                                {appointment.therapist?.name}: {appointment.patient?.firstName} {appointment.patient?.lastInitial}.
                              </div>
                              {appointment.bcba && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  BCBA: {appointment.bcba.name}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="mb-2">No therapist appointments scheduled for today</p>
                    <p className="text-sm mb-4">
                      {scheduleData?.locationWorkingHours ? (
                        <>Working hours: {scheduleData.locationWorkingHours.start} - {scheduleData.locationWorkingHours.end}</>
                      ) : (
                        <>Default hours: 8:00 AM - 5:00 PM</>
                      )}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleAppointmentForm}
                      className="mx-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Appointment
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Patient View */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 border-b flex justify-between items-center">
                <h3 className="font-semibold">Patient Schedule</h3>
                <Button variant="ghost" size="sm" onClick={toggleAppointmentForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="overflow-x-auto">
                {Object.values(patientGroups).length > 0 ? (
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
                                {appointment.patient?.firstName} {appointment.patient?.lastInitial}. with {appointment.therapist?.name}
                              </div>
                              {appointment.bcba && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  BCBA: {appointment.bcba.name}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="mb-2">No patient appointments scheduled for today</p>
                    <p className="text-sm mb-4">
                      {scheduleData?.locationWorkingHours ? (
                        <>Working hours: {scheduleData.locationWorkingHours.start} - {scheduleData.locationWorkingHours.end}</>
                      ) : (
                        <>Default hours: 8:00 AM - 5:00 PM</>
                      )}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleAppointmentForm}
                      className="mx-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Appointment
                    </Button>
                  </div>
                )}
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
                <div key={group.therapist?.id || 'unknown'} className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b">
                    <h3 className="font-semibold">{group.therapist?.name || 'Unknown Therapist'}</h3>
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
                              {appointment.patient?.firstName || 'Unknown'} {appointment.patient?.lastInitial || ''}{appointment.patient?.lastInitial ? '.' : ''}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {appointment?.startTime ? format(parseISO(appointment.startTime), 'EEEE, MMMM d') : 'Unknown date'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {appointment?.startTime ? formatTime(appointment.startTime) : 'N/A'} - {appointment?.endTime ? formatTime(appointment.endTime) : 'N/A'}
                            </p>
                          </div>
                          <div className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            {appointment?.status || 'Unknown'}
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <User className="h-4 w-4 mr-1" />
                          <span>{appointment?.location?.name || 'No location'}</span>
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
      
      {/* Team View */}
      {!isLoading && viewType === 'team' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading team schedule...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load team schedule</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : teamScheduleData?.appointments?.length > 0 || teamScheduleData?.teams?.length > 0 ? (
            <TeamScheduleView 
              teams={teamScheduleData.teams || []} 
              appointments={teamScheduleData.appointments || []} 
              selectedDate={selectedDate}
              showLocationView={teamScheduleData.teams?.length === 0}
            />
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No appointments found for this date range.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Enhanced View */}
      {!isLoading && viewType === 'enhanced' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading team schedule...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load team schedule</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : teamScheduleData?.appointments?.length > 0 || teamScheduleData?.teams?.length > 0 ? (
            <EnhancedScheduleView 
              teams={teamScheduleData.teams || []} 
              appointments={teamScheduleData.appointments || []} 
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              showLocationView={teamScheduleData.teams?.length === 0}
              onAppointmentUpdate={(updatedAppointment) => {
                console.log('Appointment update requested:', updatedAppointment);
                // Here you would add the actual mutation to update the appointment
                // For now, we'll just show a message that this feature is coming soon
                alert('Drag and drop rescheduling is coming soon!');
              }}
            />
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No appointments found for this date range.</p>
            </div>
          )}
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
                <p className="text-lg">
                  {selectedAppointment?.patient?.firstName || 'Unknown'} 
                  {selectedAppointment?.patient?.lastInitial ? `${selectedAppointment.patient.lastInitial}.` : ''}
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Therapist</h3>
                <p className="text-lg">
                  {selectedAppointment?.therapist?.name || 
                   `${selectedAppointment?.therapist?.firstName || ''} ${selectedAppointment?.therapist?.lastName || ''}` || 
                   'Unknown'}
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Date & Time</h3>
                <p>{selectedAppointment?.startTime ? format(parseISO(selectedAppointment.startTime), 'PPPP') : 'Unknown date'}</p>
                <p>
                  {selectedAppointment?.startTime ? formatTime(selectedAppointment.startTime) : 'N/A'} - 
                  {selectedAppointment?.endTime ? formatTime(selectedAppointment.endTime) : 'N/A'}
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Location</h3>
                <p>{selectedAppointment?.location?.name || 'No location'}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Status</h3>
                <div className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  {selectedAppointment?.status || 'Unknown'}
                </div>
              </div>
              
              {selectedAppointment?.notes && (
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

      {/* New Appointment Form */}
      {showAppointmentForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">New Appointment</h2>
              <Button variant="ghost" size="sm" onClick={toggleAppointmentForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Patient *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.patientId || ''}
                    onChange={(e) => setFormState({...formState, patientId: e.target.value})}
                    required
                  >
                    <option value="">Select a patient</option>
                    {patients?.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Therapist Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Therapist *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.therapistId || ''}
                    onChange={(e) => setFormState({...formState, therapistId: e.target.value})}
                    required
                  >
                    <option value="">Select a therapist</option>
                    {therapists?.map(therapist => (
                      <option key={therapist.id} value={therapist.id}>
                        {therapist.firstName} {therapist.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* BCBA Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">BCBA *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.bcbaId || ''}
                    onChange={(e) => setFormState({...formState, bcbaId: e.target.value})}
                    required
                  >
                    <option value="">Select a BCBA</option>
                    {bcbas && bcbas.length > 0 ? (
                      bcbas.map(bcba => (
                        <option key={bcba.id} value={bcba.id}>
                          {bcba.firstName} {bcba.lastName}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>Loading BCBAs...</option>
                    )}
                  </select>
                </div>
                
                {/* Location Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Location *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.locationId || ''}
                    onChange={(e) => setFormState({...formState, locationId: e.target.value})}
                    required
                  >
                    <option value="">Select a location</option>
                    {locations?.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Scheduling Options */}
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="useNextAvailable"
                    className="mr-2"
                    checked={formState.useNextAvailableSlot}
                    onChange={(e) => setFormState({...formState, useNextAvailableSlot: e.target.checked})}
                  />
                  <label htmlFor="useNextAvailable" className="font-medium">
                    Use next available time slot
                  </label>
                </div>
                
                {formState.useNextAvailableSlot ? (
                  <div className="pl-6 mt-2 space-y-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                      <select 
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                        value={formState.durationMinutes || 30}
                        onChange={(e) => setFormState({...formState, durationMinutes: parseInt(e.target.value)})}
                      >
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                        <option value="120">120 minutes</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Preferred Date (optional)</label>
                      <input
                        type="date"
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                        value={formState.preferredDate || ''}
                        onChange={(e) => setFormState({...formState, preferredDate: e.target.value})}
                      />
                    </div>
                    
                    {formState.nextAvailablePreview && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                        <p className="text-sm font-medium">Next available slot would be:</p>
                        <p className="text-sm">
                          {format(parseISO(formState.nextAvailablePreview.startTime), 'PPPP')} 
                          {' '}at{' '}
                          {formatTime(formState.nextAvailablePreview.startTime)} - {formatTime(formState.nextAvailablePreview.endTime)}
                        </p>
                      </div>
                    )}
                    
                    {formState.therapistId && formState.locationId && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCheckNextAvailable}
                        disabled={isCheckingAvailability}
                      >
                        {isCheckingAvailability ? 'Checking...' : 'Check Availability'}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Date *</label>
                      <input
                        type="date"
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                        value={formState.date || format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => setFormState({...formState, date: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Time *</label>
                        <input
                          type="time"
                          className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                          value={formState.startTime || '08:00'}
                          onChange={(e) => setFormState({...formState, startTime: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time *</label>
                        <input
                          type="time"
                          className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                          value={formState.endTime || '08:30'}
                          onChange={(e) => setFormState({...formState, endTime: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Recurring Options */}
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    className="mr-2"
                    checked={formState.recurring}
                    onChange={(e) => setFormState({...formState, recurring: e.target.checked})}
                  />
                  <label htmlFor="recurring" className="font-medium">
                    Recurring appointment
                  </label>
                </div>
                
                {formState.recurring && (
                  <div className="pl-6 mt-2 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Recurrence Pattern</label>
                      <select 
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                        value={formState.recurringType || 'weekly'}
                        onChange={(e) => {
                          const recurringPattern = {
                            ...formState.recurringPattern,
                            type: e.target.value
                          };
                          setFormState({
                            ...formState, 
                            recurringType: e.target.value,
                            recurringPattern
                          });
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date</label>
                      <input
                        type="date"
                        className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                        value={formState.recurringEndDate || ''}
                        onChange={(e) => {
                          const recurringPattern = {
                            ...formState.recurringPattern,
                            endDate: e.target.value
                          };
                          setFormState({
                            ...formState, 
                            recurringEndDate: e.target.value,
                            recurringPattern
                          });
                        }}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    
                    <div className="flex space-x-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="excludeWeekends"
                          className="mr-2"
                          checked={formState.excludeWeekends}
                          onChange={(e) => setFormState({...formState, excludeWeekends: e.target.checked})}
                        />
                        <label htmlFor="excludeWeekends" className="text-sm">
                          Exclude weekends
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="excludeHolidays"
                          className="mr-2"
                          checked={formState.excludeHolidays}
                          onChange={(e) => setFormState({...formState, excludeHolidays: e.target.checked})}
                        />
                        <label htmlFor="excludeHolidays" className="text-sm">
                          Exclude holidays
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Additional Fields */}
              <div>
                <label className="block text-sm font-medium mb-1">Title (optional)</label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  value={formState.title || ''}
                  onChange={(e) => setFormState({...formState, title: e.target.value})}
                  placeholder="Session title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  rows="3"
                  value={formState.notes || ''}
                  onChange={(e) => setFormState({...formState, notes: e.target.value})}
                  placeholder="Add any notes about this appointment"
                ></textarea>
              </div>
              
              {formError && (
                <div className="p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md">
                  <p className="text-sm">{formError}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={toggleAppointmentForm}>
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleSubmitAppointment}
                  disabled={isSubmittingForm}
                >
                  {isSubmittingForm ? 'Creating...' : 'Create Appointment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}