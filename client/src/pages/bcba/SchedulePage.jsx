import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { useLocation } from 'react-router-dom';
import { format, addDays, subDays, startOfDay, isSameDay, parseISO, addMinutes } from 'date-fns';
import { validateAppointmentClient, formatConflictMessages } from '../../utils/conflictDetection';
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
  Settings,
  Coffee,
  BarChart3
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import PatientColorSelect from '../../components/PatientColorSelect';
import { 
  getSchedule, 
  createAppointment, 
  createAppointmentNextSlot, 
  findNextAvailableSlot,
  getTeamSchedule,
  updateAppointment,
  updateAppointmentTherapist
} from '../../api/schedule';
import { getTherapists, getAvailableBCBAs, getPatientsWithAssignments } from '../../api/bcba';
import { getPatients } from '../../api/patients';
import { getLocations } from '../../api/admin';
import { calculateAppointmentStyle, formatTime, generateTimeSlots } from '../../utils/date-utils';
import { getAppointmentTypeOptions, requiresPatient } from '../../utils/appointmentTypes';
import TeamScheduleView from '../../components/schedule/TeamScheduleView';
import EnhancedScheduleView from '../../components/schedule/EnhancedScheduleView';
import ContractFulfillmentView from '../../components/schedule/ContractFulfillmentView';
import UnifiedScheduleView from '../../components/schedule/UnifiedScheduleView';
import ExcelScheduleGrid from '../../components/schedule/ExcelScheduleGrid';
import PatientScheduleGrid from '../../components/schedule/PatientScheduleGrid';
import LunchScheduleManager from '../../components/schedule/LunchScheduleManager';
import ContinuityTracker from '../../components/schedule/ContinuityTracker';
import TeamDropdown from '../../components/TeamDropdown';
import ViewSelector from '../../components/ViewSelector';

export default function BCBASchedulePage() {
  // Import auth context to get user info
  const { user } = useAuth();
  const location = useLocation();
  
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

  const resetForm = () => {
    setFormState({
      patientId: '',
      therapistId: '',
      bcbaId: user?.id || '',
      locationId: defaultLocation || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '08:00',
      endTime: '08:30',
      title: '',
      notes: '',
      serviceType: 'direct',
      useNextAvailableSlot: false,
      durationMinutes: 30,
      preferredDate: '',
      nextAvailablePreview: null,
      recurring: false,
    });
    setIsFormPreFilled(false);
  };
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState('grid');
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isFormPreFilled, setIsFormPreFilled] = useState(false);
  
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
    serviceType: 'direct', // Default to direct service
    useNextAvailableSlot: false,
    durationMinutes: 30,
    preferredDate: '',
    nextAvailablePreview: null,
    recurring: false,
  });

  // Edit form state
  const [editFormState, setEditFormState] = useState({
    patientId: '',
    therapistId: '',
    bcbaId: '',
    locationId: '',
    date: '',
    startTime: '',
    endTime: '',
    title: '',
    notes: '',
    serviceType: 'direct',
    status: 'scheduled',
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
  
  // Handle navigation state (patient selected from patients page)
  useEffect(() => {
    if (location.state?.selectedPatient && location.state?.filterByPatient) {
      setSelectedPatient(location.state.selectedPatient);
      // Set view type to patient to show the column-based patient schedule view
      setViewType('patient');
    }
  }, [location.state]);
  
  // Reset form when dialog is toggled (only if not pre-filled)
  useEffect(() => {
    if (showAppointmentForm && !isFormPreFilled) {
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
    // Reset the pre-filled flag when dialog closes
    if (!showAppointmentForm) {
      setIsFormPreFilled(false);
    }
  }, [showAppointmentForm, user, defaultLocation, isFormPreFilled]);
  
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
    onSuccess: (data) => {
      console.log('✅ Appointment created successfully:', data);
      console.log('🔄 Invalidating cache keys for immediate refresh...');
      
      // Invalidate and refetch all schedule data
      queryClient.invalidateQueries(['bcbaSchedule']);
      queryClient.invalidateQueries(['teamSchedule']);
      queryClient.invalidateQueries(['patients-with-assignments']);
      queryClient.invalidateQueries(['bcba-patients']);
      
      // Force refetch of current view data
      if (viewType === 'patient' || viewType === 'grid' || viewType === 'team') {
        queryClient.refetchQueries(['teamSchedule', selectedDate.toISOString()]);
        // Also force refetch patients data
        queryClient.refetchQueries(['bcba-patients']);
      }
      
      console.log('📅 Current view type:', viewType);
      console.log('📊 Selected date:', selectedDate.toISOString());
      
      setShowAppointmentForm(false);
    },
    onError: (error) => {
      console.error('❌ Failed to create appointment:', error);
      console.error('Error details:', error.response?.data);
    }
  });
  
  // Create appointment with next slot mutation
  const createAppointmentNextSlotMutation = useMutation({
    mutationFn: createAppointmentNextSlot,
    onSuccess: (data) => {
      console.log('Appointment created with next slot successfully:', data);
      // Invalidate and refetch all schedule data
      queryClient.invalidateQueries(['bcbaSchedule']);
      queryClient.invalidateQueries(['teamSchedule']);
      queryClient.invalidateQueries(['patients-with-assignments']);
      setShowAppointmentForm(false);
    },
    onError: (error) => {
      console.error('Failed to create appointment with next slot:', error);
    }
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }) => updateAppointment(id, data),
    onSuccess: (data) => {
      console.log('Appointment updated successfully:', data);
      // Invalidate and refetch all schedule data
      queryClient.invalidateQueries(['bcbaSchedule']);
      queryClient.invalidateQueries(['teamSchedule']);
      queryClient.invalidateQueries(['patients-with-assignments']);
      setShowEditForm(false);
      setEditingAppointment(null);
    },
    onError: (error) => {
      console.error('Failed to update appointment:', error);
      setFormError(error.response?.data?.message || 'Failed to update appointment');
    }
  });
  
  // Handle appointment form submission
  const handleSubmitAppointment = async () => {
    // Validate form
    if (requiresPatient(formState.serviceType) && !formState.patientId) {
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
    
    // Ensure we have a location - required by backend
    let finalLocationId = formState.locationId;
    if (!finalLocationId && defaultLocation) {
      finalLocationId = defaultLocation;
    }
    if (!finalLocationId && locations?.length > 0) {
      finalLocationId = locations[0].id; // Use first available location
    }
    if (!finalLocationId) {
      setFormError('No location available. Please contact administrator.');
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

    // Enhanced conflict detection for real-time validation
    if (!formState.useNextAvailableSlot) {
      const startDateTime = new Date(`${formState.date}T${formState.startTime}`);
      const endDateTime = new Date(`${formState.date}T${formState.endTime}`);
      
      // Get all appointments for conflict checking
      const allAppointments = scheduleData?.appointments || [];
      
      // Validate appointment using enhanced client-side validation
      const validation = validateAppointmentClient({
        patientId: formState.patientId,
        therapistId: formState.therapistId,
        startTime: startDateTime,
        endTime: endDateTime
      }, allAppointments);

      if (!validation.isValid) {
        const messages = formatConflictMessages(validation);
        setFormError(messages.errors.join('\n'));
        return;
      }

      // Show warnings but allow user to continue
      if (validation.warnings.length > 0) {
        const messages = formatConflictMessages(validation);
        console.log('Appointment warnings:', messages.warnings);
        // Could show warnings in UI here
      }
    }
    
    setIsSubmittingForm(true);
    setFormError(null);
    
    try {
      if (formState.useNextAvailableSlot) {
        // Use next available slot
        const nextSlotData = {
          patientId: requiresPatient(formState.serviceType) ? formState.patientId : null,
          therapistId: formState.therapistId,
          bcbaId: formState.bcbaId,
          locationId: finalLocationId,
          durationMinutes: formState.durationMinutes,
          preferredDate: formState.preferredDate || undefined,
          title: formState.title || undefined,
          notes: formState.notes || undefined,
          serviceType: formState.serviceType,
          recurring: formState.recurring,
          recurringPattern: formState.recurring ? formState.recurringPattern : undefined,
          excludeWeekends: formState.excludeWeekends,
          excludeHolidays: formState.excludeHolidays
        };
        
        console.log('🚀 Creating appointment with next available slot:', nextSlotData);
        await createAppointmentNextSlotMutation.mutateAsync(nextSlotData);
      } else {
        // Use specified time
        const startDateTime = new Date(`${formState.date}T${formState.startTime}`);
        const endDateTime = new Date(`${formState.date}T${formState.endTime}`);
        
        const appointmentData = {
          patientId: requiresPatient(formState.serviceType) ? formState.patientId : null,
          therapistId: formState.therapistId,
          bcbaId: formState.bcbaId,
          locationId: finalLocationId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          title: formState.title || undefined,
          notes: formState.notes || undefined,
          serviceType: formState.serviceType,
          recurring: formState.recurring,
          recurringPattern: formState.recurring ? formState.recurringPattern : undefined,
          excludeWeekends: formState.excludeWeekends,
          excludeHolidays: formState.excludeHolidays
        };
        
        console.log('🚀 Creating appointment with specified time:', appointmentData);
        console.log('📅 Start DateTime:', startDateTime.toISOString());
        console.log('📅 End DateTime:', endDateTime.toISOString());
        console.log('🎯 Current form state:', formState);
        
        await createAppointmentMutation.mutateAsync(appointmentData);
      }
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to create appointment');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Handle edit form submission
  const handleSubmitEdit = async () => {
    // Validate form
    if (requiresPatient(editFormState.serviceType) && !editFormState.patientId) {
      setFormError('Please select a patient');
      return;
    }
    
    if (!editFormState.therapistId) {
      setFormError('Please select a therapist');
      return;
    }
    
    if (!editFormState.bcbaId) {
      setFormError('Please select a BCBA');
      return;
    }

    setIsSubmittingForm(true);
    setFormError(null);

    try {
      // Prepare appointment data
      const startDateTime = new Date(`${editFormState.date}T${editFormState.startTime}`);
      const endDateTime = new Date(`${editFormState.date}T${editFormState.endTime}`);

      const appointmentData = {
        patientId: editFormState.patientId || null,
        therapistId: editFormState.therapistId,
        bcbaId: editFormState.bcbaId,
        locationId: editFormState.locationId || null,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        title: editFormState.title || '',
        notes: editFormState.notes || '',
        serviceType: editFormState.serviceType,
        status: editFormState.status,
        recurring: editFormState.recurring || false,
      };

      console.log('🔄 Updating appointment:', editingAppointment.id, appointmentData);
      
      await updateAppointmentMutation.mutateAsync({ 
        id: editingAppointment.id, 
        data: appointmentData 
      });
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to update appointment');
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
  
  // Fetch patients data - use BCBA-specific endpoint
  const { data: patients, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['bcba-patients'],
    queryFn: getPatientsWithAssignments,
    onSuccess: (data) => {
      console.log('🏥 Patients data received:', {
        count: data?.length || 0,
        firstPatient: data?.[0] ? {
          id: data[0].id,
          firstName: data[0].firstName,
          lastName: data[0].lastName,
          fullData: data[0]
        } : null
      });
    }
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
    enabled: viewType === 'team' || viewType === 'enhanced' || viewType === 'grid' || viewType === 'patient' || viewType === 'unified' || viewType === 'lunch' || viewType === 'continuity',
    onSuccess: (data) => {
      console.log('Team schedule data fetched:', {
        selectedDate: selectedDate.toISOString(),
        appointmentCount: data?.appointments?.length || 0,
        appointments: data?.appointments?.map(app => ({
          id: app.id,
          startTime: app.startTime,
          endTime: app.endTime,
          patientId: app.patientId,
          therapistId: app.therapistId,
          serviceType: app.serviceType
        })) || []
      });
    },
    onError: (error) => {
      console.error('Error fetching team schedule:', error);
    }
  });
  
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
  
  // Filter team schedule data based on selected team
  const filteredTeamScheduleData = useMemo(() => {
    if (!teamScheduleData || !selectedTeam) {
      return teamScheduleData;
    }
    
    // Filter teams to only show selected team
    const filteredTeams = (teamScheduleData.teams || []).filter(team => team.id === selectedTeam);
    
    // Get all therapist IDs from the selected team
    const teamTherapistIds = new Set();
    filteredTeams.forEach(team => {
      if (team.Members) {
        team.Members.forEach(member => teamTherapistIds.add(member.id));
      }
    });
    
    // Filter appointments to only show those for therapists in the selected team
    const filteredAppointments = (teamScheduleData.appointments || []).filter(appointment => 
      appointment.therapistId && teamTherapistIds.has(appointment.therapistId)
    );
    
    return {
      ...teamScheduleData,
      teams: filteredTeams,
      appointments: filteredAppointments
    };
  }, [teamScheduleData, selectedTeam]);

  // Determine if the current user can edit appointments in the selected team
  const canEditSelectedTeam = useMemo(() => {
    // Admins can always edit
    if (user?.roles?.includes('admin')) {
      return true;
    }
    
    // If no team is selected, check if user manages any team
    if (!selectedTeam) {
      return teamScheduleData?.teams?.some(team => team.isManaged) || false;
    }
    
    // Check if user manages the selected team
    const selectedTeamData = teamScheduleData?.teams?.find(team => team.id === selectedTeam);
    return selectedTeamData?.canEdit || false;
  }, [user, selectedTeam, teamScheduleData]);

  // Filter appointments for daily view by therapist (only when schedule data is available)
  const therapistGroups = scheduleData ? groupAppointmentsByTherapist() : {};
  const patientGroups = scheduleData ? groupAppointmentsByPatient() : {};
  
  // Loading state - more specific to what each view actually needs
  const isLoading = 
    // Basic data that most views need
    (isLoadingPatients || isLoadingBCBAs) ||
    // Schedule-specific loading
    ((viewType === 'daily' || viewType === 'weekly') && isLoadingSchedule) || 
    ((viewType === 'team' || viewType === 'enhanced' || viewType === 'contract' || viewType === 'unified' || viewType === 'grid' || viewType === 'patient' || viewType === 'lunch' || viewType === 'continuity') && isLoadingTeamSchedule);

  // Debug loading states
  console.log('🔍 Loading Debug:', {
    viewType,
    isLoading,
    isLoadingPatients,
    isLoadingBCBAs,
    isLoadingTeamSchedule,
    teamScheduleData: !!teamScheduleData,
    filteredTeamScheduleData: !!filteredTeamScheduleData,
    appointmentCount: filteredTeamScheduleData?.appointments?.length || 0
  });
  
  // Navigate to previous day/week
  const navigatePrevious = () => {
    console.log('Navigate Previous - Current viewType:', viewType);
    if (viewType === 'weekly') {
      console.log('Moving back 7 days (week)');
      setSelectedDate(subDays(selectedDate, 7));
    } else {
      console.log('Moving back 1 day');
      setSelectedDate(subDays(selectedDate, 1));
    }
  };
  
  // Navigate to next day/week
  const navigateNext = () => {
    console.log('Navigate Next - Current viewType:', viewType);
    if (viewType === 'weekly') {
      console.log('Moving forward 7 days (week)');
      setSelectedDate(addDays(selectedDate, 7));
    } else {
      console.log('Moving forward 1 day');
      setSelectedDate(addDays(selectedDate, 1));
    }
  };
  
  // Navigate to today
  const navigateToday = () => {
    setSelectedDate(new Date());
  };
  
  // Toggle between grid, patient, lunch, continuity, team, enhanced, and unified views
  const toggleViewType = () => {
    if (viewType === 'grid') {
      setViewType('patient');
    } else if (viewType === 'patient') {
      setViewType('lunch');
    } else if (viewType === 'lunch') {
      setViewType('continuity');
    } else if (viewType === 'continuity') {
      setViewType('team');
    } else if (viewType === 'team') {
      setViewType('enhanced');
    } else if (viewType === 'enhanced') {
      setViewType('unified');
    } else {
      setViewType('grid');
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
    if (showAppointmentForm) {
      setFormError(null);
      resetForm();
    }
  };

  const toggleEditForm = () => {
    setShowEditForm(!showEditForm);
    if (showEditForm) {
      setFormError(null);
      setEditingAppointment(null);
    }
  };

  const openEditForm = (appointment) => {
    // Check if user can edit the selected team
    if (!canEditSelectedTeam) {
      console.log('User cannot edit this team\'s appointments');
      return; // Exit early - don't open the edit form
    }
    
    // Pre-fill the edit form with appointment data
    const startTime = format(parseISO(appointment.startTime), 'HH:mm');
    const endTime = format(parseISO(appointment.endTime), 'HH:mm');
    const date = format(parseISO(appointment.startTime), 'yyyy-MM-dd');
    
    setEditFormState({
      patientId: appointment.patient?.id || '',
      therapistId: appointment.therapist?.id || appointment.therapistId || '',
      bcbaId: appointment.bcba?.id || appointment.bcbaId || '',
      locationId: appointment.location?.id || appointment.locationId || '',
      date: date,
      startTime: startTime,
      endTime: endTime,
      title: appointment.title || '',
      notes: appointment.notes || '',
      serviceType: appointment.serviceType || 'direct',
      status: appointment.status || 'scheduled',
      recurring: appointment.recurring || false,
    });
    
    setEditingAppointment(appointment);
    setShowEditForm(true);
    setSelectedAppointment(null); // Close the details modal
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedTherapist(null);
    setSelectedPatient(null);
    setSelectedLocation(null);
    setSelectedTeam(null);
  };
  
  // (Functions moved below after scheduleData declaration)
  
  // Format patient name for display
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    console.log('🧑‍⚕️ Formatting patient name:', {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      firstNameType: typeof patient.firstName,
      firstNameLength: patient.firstName?.length
    });
    
    // If names are encrypted/null, use patient ID as fallback
    if (!patient.firstName || patient.firstName === 'null' || patient.firstName.length < 2) {
      return `Patient ${patient.id.substring(0, 8)}`;
    }
    
    // Check for encryption placeholder values
    if (patient.firstName?.includes('[Encrypted') || patient.lastName?.includes('[Encrypted')) {
      return `Patient ${patient.id.substring(0, 8)}`;
    }
    
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    // If names are encrypted/null, use patient ID as fallback
    if (!patient.firstName || patient.firstName === 'null') {
      return `Patient ${patient.id.substring(0, 8)}`;
    }
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  // Parse time slot to start and end times (convert to HH:MM format for HTML time inputs)
  const parseTimeSlot = (timeSlot) => {
    const [startTime, endTime] = timeSlot.split('-');
    
    // Convert to 24-hour HH:MM format (e.g., "8:00" -> "08:00", "1:30" -> "13:30")
    const formatTimeForInput = (timeStr) => {
      const [hours, minutes] = timeStr.split(':');
      const hour24 = parseInt(hours);
      return `${hour24.toString().padStart(2, '0')}:${minutes}`;
    };
    
    return { 
      startTime: formatTimeForInput(startTime), 
      endTime: formatTimeForInput(endTime) 
    };
  };

  // Handle cell click to pre-fill appointment form
  const handleCellClick = ({ therapistId, patientId, timeSlot, selectedDate, teamId, leadBcbaId }) => {
    console.log('🎯 handleCellClick called with:', {
      therapistId,
      patientId,
      timeSlot,
      selectedDate,
      teamId,
      leadBcbaId,
      currentViewType: viewType
    });
    
    // Check if user can edit the selected team
    if (!canEditSelectedTeam) {
      // Show a message that they can't edit this team's schedule
      console.log('User cannot edit this team\'s schedule');
      return; // Exit early - don't open the appointment form
    }
    
    const { startTime, endTime } = parseTimeSlot(timeSlot);
    const dateStr = format(new Date(selectedDate), 'yyyy-MM-dd');
    
    // Find the team context for intelligent pre-filling
    let contextBcbaId = leadBcbaId; // Use passed leadBcbaId first
    let teamLocationId = null;
    
    if (teamId && filteredTeamScheduleData?.teams) {
      const team = filteredTeamScheduleData.teams.find(t => t.id === teamId);
      if (team) {
        contextBcbaId = contextBcbaId || team.LeadBCBA?.id;
        // Could add team-specific location logic here if available
      }
    }
    
    // If no team context but we have a therapist, try to find their team
    if (!contextBcbaId && therapistId && filteredTeamScheduleData?.teams) {
      const therapistTeam = filteredTeamScheduleData.teams.find(team => 
        team.Members?.some(member => member.id === therapistId)
      );
      if (therapistTeam) {
        contextBcbaId = therapistTeam.LeadBCBA?.id;
      }
    }
    
    // Determine best BCBA: team lead > current user if BCBA > existing form value
    const bestBcbaId = contextBcbaId || 
                      (user?.roles?.includes('bcba') ? user.id : null) || 
                      formState.bcbaId;
    
    // Determine best location: user default > team location > existing form value
    const bestLocationId = defaultLocation || teamLocationId || formState.locationId;
    
    // Pre-fill form with clicked cell data and intelligent defaults
    const newFormState = {
      ...formState,
      date: dateStr,
      startTime,
      endTime,
      therapistId: therapistId || formState.therapistId,
      patientId: patientId || formState.patientId,
      bcbaId: bestBcbaId,
      locationId: bestLocationId,
      // Reset other fields to defaults
      useNextAvailableSlot: false,
      title: '',
      notes: ''
    };
    
    console.log('📝 Pre-filling appointment form with:', {
      dateStr,
      startTime,
      endTime,
      therapistId: therapistId || formState.therapistId,
      patientId: patientId || formState.patientId,
      bcbaId: bestBcbaId,
      locationId: bestLocationId,
      newFormState
    });
    
    setFormState(newFormState);
    
    // Mark form as pre-filled to prevent reset
    setIsFormPreFilled(true);
    setShowAppointmentForm(true);
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold">Schedule</h1>
        
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          {/* Team Filter Dropdown */}
          <TeamDropdown
            teams={teamScheduleData?.teams || []}
            selectedTeam={selectedTeam}
            onChange={setSelectedTeam}
            placeholder="All Teams"
            className="w-48"
          />
          
          <Button variant="outline" size="sm" onClick={toggleFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <div className="flex items-center space-x-1">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={navigateToday}>
              Today
            </Button>
            
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* View Selector Dropdown */}
          <ViewSelector
            value={viewType}
            onChange={setViewType}
            className="w-44"
          />
          
          <Button 
            size="sm" 
            onClick={toggleAppointmentForm}
            disabled={!canEditSelectedTeam}
            title={!canEditSelectedTeam ? "You can only create appointments for teams you manage" : ""}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <PatientColorSelect
                patients={patients}
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value || null)}
                showAll={true}
              />
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
      {viewType !== 'contract' && (
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold">
            {viewType === 'weekly'
              ? `Week of ${format(selectedDate, 'MMMM d, yyyy')}`
              : format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Current view: {viewType}
          </p>
        </div>
      )}
      
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
      
      {/* Excel Grid View - Team-based schedule like Excel format */}
      {!isLoading && viewType === 'grid' && (
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
          ) : (
            <ExcelScheduleGrid
              teams={filteredTeamScheduleData?.teams || []}
              appointments={filteredTeamScheduleData?.appointments || []}
              patients={patients || []}
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              onCellClick={({ therapistId, timeSlot, selectedDate }) => {
                handleCellClick({ therapistId, timeSlot, selectedDate });
              }}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              viewMode="team"
              canEdit={canEditSelectedTeam}
            />
          )}
        </div>
      )}
      
      {/* Patient-focused Grid View */}
      {/* Patient-focused Grid View */}
      {!isLoading && viewType === 'patient' && (
        <div className="flex-1 overflow-y-auto">
          
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading patient schedules...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load patient schedules</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : (
            <PatientScheduleGrid
              key={`patient-grid-${selectedDate.toISOString()}-${filteredTeamScheduleData?.appointments?.length || 0}`}
              patients={patients || []}
              appointments={(filteredTeamScheduleData?.appointments || []).map(app => ({
                ...app,
                patientId: app.patientId || app.patient?.id // Fix missing patientId
              }))}
              therapists={therapists || []}
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              onGapClick={({ patientId, timeSlot }) => {
                if (canEditSelectedTeam) {
                  console.log('Gap clicked:', { patientId, timeSlot });
                  // TODO: Open assignment modal for uncovered session
                }
              }}
              onTherapistAssignment={async ({ appointmentId, therapistId, patientId, action }) => {
                if (!canEditSelectedTeam) {
                  console.log('User cannot edit this team\'s assignments');
                  return;
                }
                try {
                  console.log('Updating therapist assignment:', { appointmentId, therapistId, patientId, action });
                  await updateAppointmentTherapist(appointmentId, therapistId);
                  queryClient.invalidateQueries(['teamSchedule']);
                  queryClient.invalidateQueries(['bcbaSchedule']);
                  queryClient.invalidateQueries(['patients-with-assignments']);
                } catch (error) {
                  console.error('Failed to update therapist assignment:', error);
                }
              }}
              onCellClick={({ patientId, timeSlot, selectedDate }) => {
                handleCellClick({ patientId, timeSlot, selectedDate });
              }}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              showOnlyUncovered={false}
              viewMode="columns"
              canEdit={canEditSelectedTeam}
            />
          )}
        </div>
      )}

      {/* Lunch Schedule Manager */}
      {!isLoading && viewType === 'lunch' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading lunch schedule data...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load lunch schedule data</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : (
            <LunchScheduleManager
              teams={filteredTeamScheduleData?.teams || []}
              therapists={therapists || []}
              appointments={filteredTeamScheduleData?.appointments || []}
              selectedDate={selectedDate}
              onLunchScheduled={(lunchAppointment) => {
                console.log('Individual lunch scheduled:', lunchAppointment);
                // TODO: Implement individual lunch scheduling
              }}
              onBulkLunchSchedule={async (lunchAppointments) => {
                try {
                  for (const appointment of lunchAppointments) {
                    await createAppointmentMutation.mutateAsync({
                      ...appointment,
                      locationId: appointment.locationId || user?.defaultLocationId || null
                    });
                  }
                  queryClient.invalidateQueries(['teamSchedule']);
                } catch (error) {
                  console.error('Failed to create lunch appointments:', error);
                  throw error;
                }
              }}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              currentUser={user}
            />
          )}
        </div>
      )}

      {/* Continuity Tracker */}
      {!isLoading && viewType === 'continuity' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading continuity data...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load continuity data</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : (
            <ContinuityTracker
              patients={patients || []}
              appointments={filteredTeamScheduleData?.appointments || []}
              therapists={therapists || []}
              selectedDate={selectedDate}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              showOnlyIssues={false}
            />
          )}
        </div>
      )}

      {/* Unified View - Combined Patient Schedules with Therapist Coverage */}
      {!isLoading && viewType === 'unified' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading unified schedule...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load unified schedule</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : (
            <UnifiedScheduleView
              appointments={filteredTeamScheduleData?.appointments || []}
              patients={patients || []}
              therapists={therapists || []}
              selectedDate={selectedDate}
              onAppointmentUpdate={(updatedAppointment) => {
                console.log('Appointment update requested:', updatedAppointment);
                // Here you would add the actual mutation to update the appointment
                alert('Appointment updated! This feature will save to the database soon.');
              }}
              onAppointmentClick={handleAppointmentClick}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
            />
          )}
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
                                <span 
                                  title={formatFullPatientName(appointment.patient)}
                                  className="cursor-help"
                                >
                                  {appointment.therapist?.name}: {formatPatientName(appointment.patient)}
                                </span>
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
                                <span 
                                  title={formatFullPatientName(appointment.patient)}
                                  className="cursor-help"
                                >
                                  {formatPatientName(appointment.patient)} with {appointment.therapist?.name}
                                </span>
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
                              {appointment.patient?.firstName || 'Unknown'} {appointment.patient?.lastName ? appointment.patient.lastName.charAt(0) + '.' : ''}
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
          ) : filteredTeamScheduleData?.appointments?.length > 0 || filteredTeamScheduleData?.teams?.length > 0 ? (
            <TeamScheduleView 
              teams={filteredTeamScheduleData?.teams || []} 
              appointments={filteredTeamScheduleData?.appointments || []} 
              selectedDate={selectedDate}
              showLocationView={filteredTeamScheduleData?.teams?.length === 0}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              onAppointmentClick={handleAppointmentClick}
              onCellClick={({ therapistId, timeSlot, selectedDate, teamId, leadBcbaId }) => {
                handleCellClick({ therapistId, timeSlot, selectedDate, teamId, leadBcbaId });
              }}
              canEdit={canEditSelectedTeam}
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
          ) : filteredTeamScheduleData?.appointments?.length > 0 || filteredTeamScheduleData?.teams?.length > 0 ? (
            <EnhancedScheduleView 
              teams={filteredTeamScheduleData?.teams || []} 
              appointments={filteredTeamScheduleData?.appointments || []} 
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              showLocationView={filteredTeamScheduleData?.teams?.length === 0}
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
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
      
      {/* Contract Fulfillment View */}
      {!isLoading && viewType === 'contract' && (
        <div className="flex-1 overflow-y-auto">
          {isLoadingTeamSchedule ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading contract data...</p>
            </div>
          ) : teamScheduleError ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-red-500 mb-4">Failed to load contract data</p>
              <Button onClick={() => queryClient.invalidateQueries(['teamSchedule'])}>Try Again</Button>
            </div>
          ) : (
            <ContractFulfillmentView 
              patients={patients || []}
              appointments={filteredTeamScheduleData?.appointments || []}
            />
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
                  {formatFullPatientName(selectedAppointment?.patient)}
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
                {canEditSelectedTeam && (
                  <Button 
                    variant="default" 
                    onClick={() => openEditForm(selectedAppointment)}
                  >
                    Edit
                  </Button>
                )}
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
              <div>
                <h2 className="text-xl font-bold">New Appointment</h2>
                {(formState.therapistId || formState.patientId) && formState.date && formState.startTime && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Pre-filled from schedule grid
                    {formState.therapistId && (
                      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                        Therapist selected
                      </span>
                    )}
                    {formState.bcbaId && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                        BCBA assigned
                      </span>
                    )}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAppointmentForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Appointment Type Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Appointment Type *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.serviceType || 'direct'}
                    onChange={(e) => {
                      const newServiceType = e.target.value;
                      setFormState({
                        ...formState, 
                        serviceType: newServiceType,
                        // Clear patient if not required
                        patientId: requiresPatient(newServiceType) ? formState.patientId : ''
                      });
                    }}
                    required
                  >
                    {getAppointmentTypeOptions({ isBCBA: user?.roles?.includes('bcba') }).map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {getAppointmentTypeOptions({ isBCBA: user?.roles?.includes('bcba') }).find(t => t.value === formState.serviceType)?.description}
                  </p>
                </div>

                {/* Patient Selection - Only show for direct services */}
                {requiresPatient(formState.serviceType) ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Patient *</label>
                    <PatientColorSelect
                      patients={patients}
                      value={formState.patientId}
                      onChange={(e) => setFormState({...formState, patientId: e.target.value})}
                      required={true}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">Title (Optional)</label>
                    <input
                      type="text"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      placeholder={`e.g., ${formState.serviceType === 'lunch' ? 'Lunch Break' : formState.serviceType === 'indirect' ? 'Documentation' : 'Meeting'}`}
                      value={formState.title || ''}
                      onChange={(e) => setFormState({...formState, title: e.target.value})}
                    />
                  </div>
                )}
                
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
                
                {/* Location Selection - Optional for therapist scheduling */}
                {user?.roles?.includes('admin') && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <select 
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={formState.locationId || ''}
                      onChange={(e) => setFormState({...formState, locationId: e.target.value})}
                    >
                      <option value="">Select a location</option>
                      {locations?.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          value={formState.startTime || ''}
                          onChange={(e) => setFormState({...formState, startTime: e.target.value})}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time *</label>
                        <input
                          type="time"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          value={formState.endTime || ''}
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

      {/* Edit Appointment Form */}
      {showEditForm && editingAppointment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">Edit Appointment</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Editing: {editingAppointment.title || `${editingAppointment.serviceType} appointment`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleEditForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Appointment Type Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Appointment Type *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.serviceType || 'direct'}
                    onChange={(e) => {
                      const newServiceType = e.target.value;
                      setEditFormState({
                        ...editFormState, 
                        serviceType: newServiceType,
                        // Clear patient if not required
                        patientId: requiresPatient(newServiceType) ? editFormState.patientId : ''
                      });
                    }}
                    required
                  >
                    {getAppointmentTypeOptions({ isBCBA: user?.roles?.includes('bcba') }).map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {getAppointmentTypeOptions({ isBCBA: user?.roles?.includes('bcba') }).find(t => t.value === editFormState.serviceType)?.description}
                  </p>
                </div>

                {/* Patient Selection - Only show for direct services */}
                {requiresPatient(editFormState.serviceType) ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Patient *</label>
                    <PatientColorSelect
                      patients={patients}
                      value={editFormState.patientId}
                      onChange={(e) => setEditFormState({...editFormState, patientId: e.target.value})}
                      required={true}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      placeholder={`e.g., ${editFormState.serviceType === 'lunch' ? 'Lunch Break' : editFormState.serviceType === 'indirect' ? 'Documentation' : 'Meeting'}`}
                      value={editFormState.title || ''}
                      onChange={(e) => setEditFormState({...editFormState, title: e.target.value})}
                    />
                  </div>
                )}
                
                {/* Therapist Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Therapist *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.therapistId || ''}
                    onChange={(e) => setEditFormState({...editFormState, therapistId: e.target.value})}
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
                    value={editFormState.bcbaId || ''}
                    onChange={(e) => setEditFormState({...editFormState, bcbaId: e.target.value})}
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
                {user?.roles?.includes('admin') && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <select 
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={editFormState.locationId || ''}
                      onChange={(e) => setEditFormState({...editFormState, locationId: e.target.value})}
                    >
                      <option value="">Select a location</option>
                      {locations?.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.status || 'scheduled'}
                    onChange={(e) => setEditFormState({...editFormState, status: e.target.value})}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No Show</option>
                  </select>
                </div>
              </div>
              
              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.date || ''}
                    onChange={(e) => setEditFormState({...editFormState, date: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.startTime || ''}
                    onChange={(e) => setEditFormState({...editFormState, startTime: e.target.value})}
                    required
                  >
                    <option value="">Select start time</option>
                    {timeSlots.map(time => (
                      <option key={formatTime(time, 'HH:mm')} value={formatTime(time, 'HH:mm')}>{formatTime(time, 'h:mm a')}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <select 
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={editFormState.endTime || ''}
                    onChange={(e) => setEditFormState({...editFormState, endTime: e.target.value})}
                    required
                  >
                    <option value="">Select end time</option>
                    {timeSlots.map(time => (
                      <option key={formatTime(time, 'HH:mm')} value={formatTime(time, 'HH:mm')}>{formatTime(time, 'h:mm a')}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                <textarea
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  rows="3"
                  placeholder="Add any notes about this appointment..."
                  value={editFormState.notes || ''}
                  onChange={(e) => setEditFormState({...editFormState, notes: e.target.value})}
                />
              </div>

              {/* Recurring Option */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editRecurring"
                  className="mr-2"
                  checked={editFormState.recurring || false}
                  onChange={(e) => setEditFormState({...editFormState, recurring: e.target.checked})}
                />
                <label htmlFor="editRecurring" className="text-sm font-medium">
                  Recurring appointment
                </label>
              </div>
              
              {/* Error Display */}
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-800 dark:text-red-400">{formError}</p>
                </div>
              )}
              
              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={toggleEditForm}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitEdit}
                  disabled={isSubmittingForm}
                >
                  {isSubmittingForm ? 'Updating...' : 'Update Appointment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}