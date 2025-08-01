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
import { useScheduleData, useTeamScheduleData } from '../../hooks/useScheduleData';

// Import all schedule view components
import TeamScheduleView from '../../components/schedule/TeamScheduleView';
import EnhancedScheduleView from '../../components/schedule/EnhancedScheduleView';
import ContractFulfillmentView from '../../components/schedule/ContractFulfillmentView';
import UnifiedScheduleView from '../../components/schedule/UnifiedScheduleView';
import ExcelScheduleGrid from '../../components/schedule/ExcelScheduleGrid';
import PatientScheduleGrid from '../../components/schedule/PatientScheduleGrid';
import LunchScheduleManager from '../../components/schedule/LunchScheduleManager';
import ContinuityTracker from '../../components/schedule/ContinuityTracker';
import DailyScheduleView from '../../components/schedule/DailyScheduleView';
import WeeklyScheduleView from '../../components/schedule/WeeklyScheduleView';
import ScheduleFilters from '../../components/schedule/ScheduleFilters';
import AppointmentForm from '../../components/schedule/AppointmentForm';
import EditAppointmentForm from '../../components/schedule/EditAppointmentForm';
import AppointmentDetailsModal from '../../components/schedule/AppointmentDetailsModal';
import TeamDropdown from '../../components/TeamDropdown';
import ViewSelector from '../../components/ViewSelector';

export default function BCBASchedulePage() {
  // Import auth context to get user info
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  
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

  const defaultLocation = getUserDefaultLocation();

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
  const [formState, setFormState] = useState({
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
  const [editFormState, setEditFormState] = useState({});

  // Extract default location from state
  useEffect(() => {
    if (location.state?.defaultLocationId) {
      setSelectedLocation(location.state.defaultLocationId);
    }
  }, [location.state]);

  // Navigate to date functions
  const navigateToday = () => setSelectedDate(new Date());
  const navigatePrevious = () => setSelectedDate(prevDate => subDays(prevDate, 1));
  const navigateNext = () => setSelectedDate(prevDate => addDays(prevDate, 1));

  // Toggle functions
  const toggleFilters = () => setShowFilters(!showFilters);
  const toggleAppointmentForm = () => {
    if (!showAppointmentForm) {
      setFormError(null);
      if (!isFormPreFilled) {
        resetForm();
      }
    }
    setShowAppointmentForm(!showAppointmentForm);
    setIsFormPreFilled(false);
  };
  const toggleEditForm = () => {
    setShowEditForm(!showEditForm);
    setFormError(null);
  };

  // Filter functions
  const resetFilters = () => {
    setSelectedTherapist(null);
    setSelectedPatient(null);
    setSelectedLocation(null);
  };

  // Handle appointment click
  const handleAppointmentClick = (appointment) => {
    console.log('Appointment clicked:', appointment);
    setSelectedAppointment(appointment);
  };

  // Handle cell click
  const handleCellClick = ({ therapistId, timeSlot, selectedDate, teamId, leadBcbaId }) => {
    if (!canEditSelectedTeam) {
      console.log('User cannot edit this team');
      return;
    }

    console.log('Grid cell clicked:', { therapistId, timeSlot, selectedDate, teamId, leadBcbaId });

    const therapistName = therapists?.find(t => t.id === therapistId)?.firstName || 'Unknown';
    const bcbaToAssign = leadBcbaId || user?.id || '';

    setFormState({
      ...formState,
      therapistId: therapistId || '',
      bcbaId: bcbaToAssign,
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: timeSlot.split(' - ')[0],
      endTime: timeSlot.split(' - ')[1] || addMinutes(parseISO(`2000-01-01T${timeSlot.split(' - ')[0]}`), 30).toISOString().slice(11, 16),
      locationId: selectedLocation || defaultLocation || ''
    });
    setIsFormPreFilled(true);
    setShowAppointmentForm(true);
  };

  const closeAppointmentDetails = () => setSelectedAppointment(null);

  const openEditForm = (appointment) => {
    const startDate = parseISO(appointment.startTime);
    const endDate = parseISO(appointment.endTime);
    
    setEditFormState({
      patientId: appointment.patientId || '',
      therapistId: appointment.therapistId || '',
      bcbaId: appointment.bcbaId || '',
      locationId: appointment.locationId || '',
      date: format(startDate, 'yyyy-MM-dd'),
      startTime: format(startDate, 'HH:mm'),
      endTime: format(endDate, 'HH:mm'),
      title: appointment.title || '',
      notes: appointment.notes || '',
      serviceType: appointment.serviceType || 'direct',
      status: appointment.status || 'scheduled',
      recurring: appointment.recurring || false,
    });
    setEditingAppointment(appointment);
    setShowEditForm(true);
    setSelectedAppointment(null);
  };

  const handleAppointmentUpdate = async (updatedAppointment) => {
    try {
      console.log('Updating appointment:', updatedAppointment);
      await updateAppointmentMutation.mutateAsync({
        id: updatedAppointment.id,
        data: updatedAppointment
      });
    } catch (error) {
      console.error('Failed to update appointment:', error);
    }
  };

  // Helper function to format patient names
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown Patient';
    const firstName = patient.firstName || patient.decryptedFirstName || 'Unknown';
    const lastName = patient.lastName || patient.decryptedLastName || '';
    return lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
  };

  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown Patient';
    const firstName = patient.firstName || patient.decryptedFirstName || 'Unknown';
    const lastName = patient.lastName || patient.decryptedLastName || '';
    return `${firstName} ${lastName}`.trim();
  };

  // Check next available slot
  const handleCheckNextAvailable = async () => {
    if (!formState.therapistId || !formState.locationId) {
      setFormError('Please select therapist and location first');
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
      queryClient.invalidateQueries(['bcbaSchedule']);
      queryClient.invalidateQueries(['teamSchedule']);
      queryClient.invalidateQueries(['patients-with-assignments']);
      queryClient.invalidateQueries(['bcba-patients']);
      
      if (viewType === 'patient' || viewType === 'grid' || viewType === 'team') {
        queryClient.refetchQueries(['teamSchedule', selectedDate.toISOString()]);
        queryClient.refetchQueries(['bcba-patients']);
      }
      
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
      finalLocationId = locations[0].id;
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
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  // Fetch patients data
  const { data: patients, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['bcba-patients'],
    queryFn: () => getPatients(),
  });
  
  // Fetch schedule data for the selected date
  const { 
    data: scheduleData, 
    isLoading: isLoadingSchedule, 
    error: scheduleError,
    refetch: refetchSchedule 
  } = useQuery({
    queryKey: ['bcbaSchedule', selectedDate.toISOString()],
    queryFn: () => getSchedule(selectedDate),
    enabled: viewType === 'daily' || viewType === 'weekly'
  });
  
  // Fetch team schedule data
  const { 
    data: teamScheduleData, 
    isLoading: isLoadingTeamSchedule, 
    error: teamScheduleError,
    refetch: refetchTeamSchedule 
  } = useQuery({
    queryKey: ['teamSchedule', selectedDate.toISOString()],
    queryFn: () => getTeamSchedule(selectedDate),
    enabled: viewType === 'team' || viewType === 'enhanced' || viewType === 'grid' || viewType === 'patient' || viewType === 'unified' || viewType === 'lunch' || viewType === 'continuity',
  });
  
  // Determine if user can edit the selected team
  const canEditSelectedTeam = useMemo(() => {
    if (!selectedTeam) return true; // If no team selected, user can edit their own teams
    if (user?.roles?.includes('admin')) return true; // Admins can edit any team
    
    // Check if user is the lead BCBA for the selected team
    const selectedTeamData = teamScheduleData?.teams?.find(t => t.id === selectedTeam);
    return selectedTeamData?.leadBcbaId === user?.id;
  }, [selectedTeam, teamScheduleData, user]);

  // Use custom hooks for schedule data
  const { filteredData, therapistGroups, patientGroups } = useScheduleData(
    scheduleData, 
    selectedDate, 
    selectedTherapist, 
    selectedPatient
  );

  const filteredTeamScheduleData = useTeamScheduleData(
    teamScheduleData,
    selectedTeam,
    selectedTherapist,
    selectedPatient
  );

  // Debug logging for patient view
  useEffect(() => {
    if (viewType === 'patient') {
      console.log('🔍 Patient View Debug:', {
        viewType,
        selectedTeam,
        teamScheduleData: {
          teams: teamScheduleData?.teams?.length || 0,
          appointments: teamScheduleData?.appointments?.length || 0
        },
        filteredTeamScheduleData: {
          teams: filteredTeamScheduleData?.teams?.length || 0,
          appointments: filteredTeamScheduleData?.appointments?.length || 0,
          appointmentDetails: filteredTeamScheduleData?.appointments?.slice(0, 3).map(app => ({
            id: app.id,
            patientId: app.patientId,
            therapistId: app.therapistId,
            serviceType: app.serviceType
          }))
        },
        patients: patients?.length || 0
      });
    }
  }, [viewType, selectedTeam, teamScheduleData, filteredTeamScheduleData, patients]);

  // Check loading state across all queries
  const isLoading = 
    ((viewType === 'daily' || viewType === 'weekly') && isLoadingSchedule) || 
    ((viewType === 'team' || viewType === 'enhanced' || viewType === 'contract' || viewType === 'unified' || viewType === 'grid' || viewType === 'patient' || viewType === 'lunch' || viewType === 'continuity') && isLoadingTeamSchedule);

  // Weekly view logic
  const weeklyTherapistGroups = useMemo(() => {
    if (!scheduleData || viewType !== 'weekly') return {};
    
    const startOfWeek = startOfDay(selectedDate);
    const endOfWeek = addDays(startOfWeek, 6);
    
    const weekAppointments = scheduleData.appointments?.filter(appointment => {
      const appointmentDate = parseISO(appointment.startTime);
      return appointmentDate >= startOfWeek && appointmentDate <= endOfWeek;
    }) || [];
    
    return weekAppointments.reduce((groups, appointment) => {
      const therapistId = appointment.therapistId || 'unknown';
      if (!groups[therapistId]) {
        groups[therapistId] = {
          therapist: appointment.therapist || { id: therapistId, name: 'Unknown Therapist' },
          appointments: []
        };
      }
      groups[therapistId].appointments.push(appointment);
      return groups;
    }, {});
  }, [scheduleData, selectedDate, viewType]);

  const todaysAppointments = useMemo(() => {
    if (viewType === 'grid') {
      return filteredTeamScheduleData?.appointments || [];
    } else if (viewType === 'patient') {
      return filteredTeamScheduleData?.appointments || [];
    } else if (viewType === 'lunch') {
      return filteredTeamScheduleData?.appointments || [];
    } else if (viewType === 'continuity') {
      return filteredTeamScheduleData?.appointments || [];
    } else if (viewType === 'team') {
      return filteredTeamScheduleData?.appointments || [];
    } else if (viewType === 'enhanced') {
      return filteredTeamScheduleData?.appointments || [];
    }
    return [];
  }, [viewType, filteredTeamScheduleData]);
  
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
      <ScheduleFilters
        showFilters={showFilters}
        selectedTherapist={selectedTherapist}
        selectedPatient={selectedPatient}
        therapists={therapists}
        patients={patients}
        onTherapistChange={setSelectedTherapist}
        onPatientChange={setSelectedPatient}
        onResetFilters={resetFilters}
      />
      
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
              location={selectedLocation}
            />
          )}
        </div>
      )}
      
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
          ) : !patients || patients.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No patients found.</p>
            </div>
          ) : !filteredTeamScheduleData?.appointments || filteredTeamScheduleData.appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No appointments found for the selected filters.</p>
              {selectedTeam && (
                <p className="text-sm mt-2">Try selecting "All Teams" to see all appointments.</p>
              )}
            </div>
          ) : (
            <PatientScheduleGrid
              key={`patient-grid-${selectedDate.toISOString()}-${filteredTeamScheduleData?.appointments?.length || 0}`}
              patients={patients || []}
              appointments={(filteredTeamScheduleData?.appointments || []).map(app => ({
                ...app,
                patientId: app.patientId || app.patient?.id
              }))}
              therapists={therapists || []}
              selectedDate={selectedDate}
              onAppointmentClick={handleAppointmentClick}
              onGapClick={({ patientId, timeSlot }) => {
                if (canEditSelectedTeam) {
                  console.log('Gap clicked:', { patientId, timeSlot });
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
              userRole={user?.roles?.includes('admin') ? 'admin' : 'bcba'}
              canEdit={canEditSelectedTeam}
              location={selectedLocation}
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
        <DailyScheduleView
          therapistGroups={therapistGroups}
          patientGroups={patientGroups}
          timeSlots={timeSlots}
          scheduleData={scheduleData}
          onAppointmentClick={handleAppointmentClick}
          onAddAppointment={toggleAppointmentForm}
          formatPatientName={formatPatientName}
          formatFullPatientName={formatFullPatientName}
        />
      )}
      
      {/* Weekly View */}
      {!isLoading && !scheduleError && viewType === 'weekly' && (
        <WeeklyScheduleView
          therapistGroups={weeklyTherapistGroups}
          onAppointmentClick={handleAppointmentClick}
        />
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
              onAppointmentUpdate={handleAppointmentUpdate}
              canEdit={canEditSelectedTeam}
              location={selectedLocation}
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
              onAppointmentUpdate={handleAppointmentUpdate}
              location={selectedLocation}
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
      <AppointmentDetailsModal
        appointment={selectedAppointment}
        onClose={closeAppointmentDetails}
        onEdit={openEditForm}
        onViewPatient={() => {
          // Navigate to patient page (to be implemented)
          closeAppointmentDetails();
        }}
        canEdit={canEditSelectedTeam}
        formatFullPatientName={formatFullPatientName}
      />

      {/* New Appointment Form */}
      {showAppointmentForm && (
        <AppointmentForm
          formState={formState}
          setFormState={setFormState}
          patients={patients}
          therapists={therapists}
          bcbas={bcbas}
          locations={locations}
          user={user}
          formError={formError}
          isSubmittingForm={isSubmittingForm}
          isCheckingAvailability={isCheckingAvailability}
          onSubmit={handleSubmitAppointment}
          onClose={toggleAppointmentForm}
          onCheckAvailability={handleCheckNextAvailable}
        />
      )}

      {/* Edit Appointment Form */}
      {showEditForm && editingAppointment && (
        <EditAppointmentForm
          editingAppointment={editingAppointment}
          editFormState={editFormState}
          setEditFormState={setEditFormState}
          patients={patients}
          therapists={therapists}
          bcbas={bcbas}
          locations={locations}
          user={user}
          formError={formError}
          isSubmittingForm={isSubmittingForm}
          timeSlots={timeSlots}
          onSubmit={handleSubmitEdit}
          onClose={toggleEditForm}
        />
      )}
    </div>
  );
}