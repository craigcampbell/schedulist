import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { 
  AlertTriangle,
  CheckCircle,
  Users,
  Eye,
  EyeOff,
  Clock,
  User,
  Calendar,
  GripVertical,
  UserPlus,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { analyzeTherapistContinuity, calculateContinuityScore } from '../../utils/continuity-tracker';
import { getAppointmentType, getAppointmentColors } from '../../utils/appointmentTypes';

// Time slots matching the Excel format
const TIME_SLOTS = [
  "7:30-8:00", "8:00-8:30", "8:30-9:00", "9:00-9:30", "9:30-10:00", 
  "10:00-10:30", "10:30-11:00", "11:00-11:30", "11:30-12:00", "12:00-12:30", 
  "12:30-1:00", "1:00-1:30", "1:30-2:00", "2:00-2:30", "2:30-3:00", 
  "3:00-3:30", "3:30-4:00", "4:00-4:30", "4:30-5:00", "5:00-5:30"
];

// Coverage status colors
const COVERAGE_COLORS = {
  covered: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300',
  uncovered: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-400 animate-pulse',
  gap: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300',
  partial: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300',
  none: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 border-gray-300'
};

export default function PatientScheduleGrid({
  patients = [],
  appointments = [],
  therapists = [],
  selectedDate,
  onAppointmentClick = () => {},
  onGapClick = () => {},
  onTherapistAssignment = () => {},
  onCellClick = () => {},
  userRole = 'bcba',
  showOnlyUncovered = false,
  viewMode = 'grid' // 'grid' or 'columns'
}) {
  // Debug data received by component - ALWAYS LOG THIS
  console.log('========================');
  console.log('📋 PATIENT SCHEDULE DEBUG');
  console.log('========================');
  console.log('Patients:', patients.length);
  console.log('Appointments:', appointments.length);
  console.log('Selected Date:', selectedDate.toISOString().split('T')[0]);
  
  console.log('\n📝 ALL APPOINTMENTS:');
  appointments.forEach((app, index) => {
    console.log(`${index + 1}. ID: ${app.id}`);
    console.log(`   - patientId: ${app.patientId}`);
    console.log(`   - serviceType: "${app.serviceType}"`);
    console.log(`   - startTime: ${app.startTime}`);
    console.log(`   - status: ${app.status}`);
  });
  
  console.log('\n👥 ALL PATIENTS:');
  patients.forEach((patient, index) => {
    console.log(`${index + 1}. ID: ${patient.id} - Name: ${patient.firstName} ${patient.lastName}`);
  });
  console.log('========================');
  const [expandedPatients, setExpandedPatients] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [draggedTherapist, setDraggedTherapist] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [isTherapistDrawerOpen, setIsTherapistDrawerOpen] = useState(false);
  const [patientOrder, setPatientOrder] = useState([]);
  const [draggedPatient, setDraggedPatient] = useState(null);
  const [dragOverPatient, setDragOverPatient] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderAnimation, setReorderAnimation] = useState(null);
  const [layoutDensity, setLayoutDensity] = useState('normal'); // 'compact', 'normal', 'spacious'
  const dragRef = useRef(null);

  // Format names based on user role
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    
    // For all roles in schedule grid, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || '--';
    const lastTwo = patient.lastName?.substring(0, 2) || '--';
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || 'Unknown'} ${patient.lastName || ''}`;
  };

  const formatTherapistName = (therapist) => {
    if (!therapist) return 'Unassigned';
    return `${therapist.firstName?.charAt(0) || ''}${therapist.lastName?.charAt(0) || ''}`;
  };

  // Detect gaps in patient schedule
  const detectScheduleGaps = (appointments) => {
    if (appointments.length < 2) return [];
    
    const gaps = [];
    const sortedApps = [...appointments].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    for (let i = 0; i < sortedApps.length - 1; i++) {
      const currentEnd = new Date(sortedApps[i].endTime);
      const nextStart = new Date(sortedApps[i + 1].startTime);
      const gapMinutes = (nextStart - currentEnd) / (1000 * 60);
      
      // Flag gaps longer than 30 minutes during therapy hours
      if (gapMinutes > 30 && gapMinutes < 180) { // 30 min to 3 hours
        gaps.push({
          startTime: currentEnd,
          endTime: nextStart,
          duration: gapMinutes,
          type: 'schedule_gap'
        });
      }
    }
    
    return gaps;
  };

  // Get appointments for selected date
  const todaysAppointments = useMemo(() => {
    const filtered = appointments.filter(app => 
      app && app.startTime && isSameDay(new Date(app.startTime), new Date(selectedDate))
    );
    console.log('🗓️ PatientScheduleGrid appointments filtered:', {
      totalAppointments: appointments.length,
      todaysAppointments: filtered.length,
      selectedDate: selectedDate.toISOString().split('T')[0],
      appointments: filtered.map(app => ({
        id: app.id,
        startTime: app.startTime,
        patientId: app.patientId,
        patient: app.patient?.firstName + ' ' + app.patient?.lastName,
        therapist: app.therapist?.firstName + ' ' + app.therapist?.lastName,
        serviceType: app.serviceType,
        status: app.status
      }))
    });
    return filtered;
  }, [appointments, selectedDate]);

  // Group appointments by patient and analyze coverage
  const patientScheduleData = useMemo(() => {
    const scheduleData = {};
    
    // Initialize with all patients
    patients.forEach(patient => {
      scheduleData[patient.id] = {
        patient,
        appointments: [],
        scheduledSlots: [],
        uncoveredSlots: [],
        gaps: [],
        therapistCount: new Set(),
        totalHours: 0,
        coverageStatus: 'none'
      };
    });
    
    // Add appointments to patient schedules
    const directAppointments = todaysAppointments.filter(app => app.patientId && app.serviceType === 'direct');
    console.log('🎯 Direct appointments for patients:', {
      totalTodaysAppointments: todaysAppointments.length,
      directAppointments: directAppointments.length,
      serviceTypes: todaysAppointments.map(app => ({ id: app.id, serviceType: app.serviceType, patientId: app.patientId })),
      filteredOut: todaysAppointments.filter(app => !(app.patientId && app.serviceType === 'direct')).map(app => ({
        id: app.id,
        patientId: app.patientId,
        serviceType: app.serviceType,
        reason: !app.patientId ? 'No patientId' : app.serviceType !== 'direct' ? `serviceType is '${app.serviceType}' not 'direct'` : 'unknown'
      })),
      appointments: directAppointments.map(app => ({
        id: app.id,
        patientId: app.patientId,
        serviceType: app.serviceType,
        startTime: app.startTime
      }))
    });
    
    console.log('🔗 Processing direct appointments into patient schedules...');
    directAppointments.forEach(appointment => {
      console.log(`📝 Processing appointment ${appointment.id} for patient ${appointment.patientId}`);
      if (scheduleData[appointment.patientId]) {
        scheduleData[appointment.patientId].appointments.push(appointment);
        
        if (appointment.therapistId) {
          scheduleData[appointment.patientId].therapistCount.add(appointment.therapistId);
        }
        
        console.log(`✅ Added appointment to patient ${appointment.patientId} schedule. Total appointments: ${scheduleData[appointment.patientId].appointments.length}`);
      } else {
        console.warn(`⚠️ Patient ${appointment.patientId} not found in scheduleData keys:`, Object.keys(scheduleData));
      }
    });
    
    console.log('📊 Final patientScheduleData summary:', 
      Object.entries(scheduleData).map(([patientId, data]) => ({
        patientId,
        patientName: `${data.patient.firstName} ${data.patient.lastName}`,
        appointmentsCount: data.appointments.length
      }))
    );
    
    // Analyze each patient's schedule
    Object.values(scheduleData).forEach(data => {
      if (data.appointments.length === 0) {
        // Patients with no appointments get 'none' status
        data.coverageStatus = 'none';
        data.totalHours = 0;
        return;
      }
      
      // Sort appointments by time
      data.appointments.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      
      // Calculate coverage metrics
      data.totalHours = data.appointments.reduce((total, app) => {
        const duration = (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60 * 60);
        return total + duration;
      }, 0);
      
      // Determine coverage status
      const uncoveredCount = data.appointments.filter(app => !app.therapistId).length;
      const totalCount = data.appointments.length;
      
      if (uncoveredCount === 0) {
        data.coverageStatus = 'covered';
      } else if (uncoveredCount === totalCount) {
        data.coverageStatus = 'uncovered';
      } else {
        data.coverageStatus = 'partial';
      }
      
      // Detect gaps in coverage
      data.gaps = detectScheduleGaps(data.appointments);
      
      // Analyze continuity
      if (data.appointments.length > 0) {
        try {
          const continuityAnalysis = analyzeTherapistContinuity(patient.id, appointments, selectedDate, 'weekly');
          data.continuityScore = calculateContinuityScore(continuityAnalysis);
          data.continuityWarnings = continuityAnalysis.warnings;
          data.therapistRotation = continuityAnalysis.uniqueTherapists.size;
        } catch (error) {
          console.warn('Error analyzing continuity:', error);
          data.continuityScore = 0;
          data.continuityWarnings = [];
          data.therapistRotation = 0;
        }
      }
    });
    
    return scheduleData;
  }, [todaysAppointments, patients]);

  // Check if appointment is in time slot
  const isAppointmentInTimeSlot = (appointment, timeSlot) => {
    const [slotStart, slotEnd] = timeSlot.split('-');
    const slotStartTime = parseTimeToMinutes(slotStart);
    const slotEndTime = parseTimeToMinutes(slotEnd);
    
    const appStart = new Date(appointment.startTime);
    const appEnd = new Date(appointment.endTime);
    
    const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
    const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
    
    return (
      (appStartMinutes >= slotStartTime && appStartMinutes < slotEndTime) ||
      (appEndMinutes > slotStartTime && appEndMinutes <= slotEndTime) ||
      (appStartMinutes <= slotStartTime && appEndMinutes >= slotEndTime)
    );
  };

  const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get appointment for specific patient and time slot
  const getPatientAppointmentForSlot = (patientId, timeSlot) => {
    const patientData = patientScheduleData[patientId];
    if (!patientData) return null;
    
    return patientData.appointments.find(app => isAppointmentInTimeSlot(app, timeSlot));
  };

  // Filter patients based on coverage filter
  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const data = patientScheduleData[patient.id];
      if (!data) return false;
      
      // For columns view, show all patients even if they have no appointments
      if (viewMode === 'columns') {
        if (showOnlyUncovered) {
          return data.appointments.length === 0 || data.coverageStatus === 'uncovered' || data.coverageStatus === 'partial';
        }
        return true;
      }
      
      // For other views, only show patients with appointments
      if (data.appointments.length === 0) return false;
      
      if (showOnlyUncovered) {
        return data.coverageStatus === 'uncovered' || data.coverageStatus === 'partial';
      }
      
      return true;
    });
  }, [patients, patientScheduleData, showOnlyUncovered, viewMode]);

  // Load patient order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('patientColumnOrder');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        setPatientOrder(parsedOrder);
      } catch (error) {
        console.warn('Failed to parse saved patient order:', error);
      }
    }
    
    // Load layout density preference
    const savedDensity = localStorage.getItem('patientLayoutDensity');
    if (savedDensity && ['compact', 'normal', 'spacious'].includes(savedDensity)) {
      setLayoutDensity(savedDensity);
    }
  }, []);

  // Save patient order to localStorage whenever it changes
  useEffect(() => {
    if (patientOrder.length > 0) {
      localStorage.setItem('patientColumnOrder', JSON.stringify(patientOrder));
    }
  }, [patientOrder]);

  // Save layout density to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('patientLayoutDensity', layoutDensity);
  }, [layoutDensity]);

  // Initialize patient order when filtered patients change
  const orderedPatients = useMemo(() => {
    if (patientOrder.length === 0) {
      const initialOrder = filteredPatients.map(p => p.id);
      setPatientOrder(initialOrder);
      return filteredPatients;
    }
    
    // Sort filtered patients by the custom order
    const ordered = patientOrder
      .map(id => filteredPatients.find(p => p.id === id))
      .filter(Boolean);
    
    // Add any new patients not in the order
    const newPatients = filteredPatients.filter(p => !patientOrder.includes(p.id));
    const finalOrder = [...ordered, ...newPatients];
    
    // Update order if there are new patients
    if (newPatients.length > 0) {
      setPatientOrder([...patientOrder, ...newPatients.map(p => p.id)]);
    }
    
    return finalOrder;
  }, [filteredPatients, patientOrder]);

  const togglePatient = (patientId) => {
    setExpandedPatients(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
  };

  // Layout density controls
  const setCompactLayout = () => setLayoutDensity('compact');
  const setNormalLayout = () => setLayoutDensity('normal');
  const setSpaciousLayout = () => setLayoutDensity('spacious');

  // Get layout dimensions based on density
  const getLayoutDimensions = () => {
    switch (layoutDensity) {
      case 'compact':
        return {
          cardWidth: 240,
          cardMinWidth: 220,
          gap: 'gap-2',
          padding: 'p-2',
          textSize: 'text-sm',
          headerPadding: 'p-3'
        };
      case 'spacious':
        return {
          cardWidth: 400,
          cardMinWidth: 360,
          gap: 'gap-6',
          padding: 'p-4',
          textSize: 'text-base',
          headerPadding: 'p-5'
        };
      default: // normal
        return {
          cardWidth: 320,
          cardMinWidth: 280,
          gap: 'gap-4',
          padding: 'p-3',
          textSize: 'text-sm',
          headerPadding: 'p-4'
        };
    }
  };

  // Patient drag and drop handlers
  const handlePatientDragStart = (e, patient) => {
    setDraggedPatient(patient);
    setIsReordering(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', patient.id);
    
    // Find the patient card container (parent of the drag handle)
    const patientCard = e.currentTarget.closest('[data-patient-card]');
    if (patientCard) {
      // Create a custom drag image of the entire card
      const rect = patientCard.getBoundingClientRect();
      const dragImage = patientCard.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.width = rect.width + 'px';
      dragImage.style.height = rect.height + 'px';
      dragImage.style.opacity = '0.8';
      dragImage.style.transform = 'rotate(2deg)';
      dragImage.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
      document.body.appendChild(dragImage);
      
      e.dataTransfer.setDragImage(dragImage, rect.width / 2, 20);
      
      // Clean up the drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 100);
    }
  };

  const handlePatientDragEnd = (e) => {
    setDraggedPatient(null);
    setDragOverPatient(null);
    
    // Clear reordering state after animation completes
    setTimeout(() => {
      setIsReordering(false);
      setReorderAnimation(null);
    }, 500);
  };

  const handlePatientDragOver = (e, targetPatientId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedPatient && draggedPatient.id !== targetPatientId) {
      setDragOverPatient(targetPatientId);
    }
  };

  const handlePatientDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear if we're actually leaving the target element
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverPatient(null);
    }
  };

  const handlePatientDrop = (e, targetPatientId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedPatient && draggedPatient.id !== targetPatientId) {
      const currentOrder = [...patientOrder];
      const draggedIndex = currentOrder.indexOf(draggedPatient.id);
      const targetIndex = currentOrder.indexOf(targetPatientId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Set animation state before reordering
        setReorderAnimation({
          draggedId: draggedPatient.id,
          targetId: targetPatientId,
          direction: draggedIndex < targetIndex ? 'right' : 'left'
        });
        
        // Animate the reorder with more dramatic effect
        setTimeout(() => {
          // Remove dragged item and insert at target position
          currentOrder.splice(draggedIndex, 1);
          currentOrder.splice(targetIndex, 0, draggedPatient.id);
          setPatientOrder(currentOrder);
          
          // Flash success animation
          setTimeout(() => {
            setReorderAnimation({
              ...reorderAnimation,
              success: true
            });
            
            // Clear success flash after brief moment
            setTimeout(() => {
              setReorderAnimation(null);
            }, 800);
          }, 200);
        }, 300);
      }
    }
    setDraggedPatient(null);
    setDragOverPatient(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e, therapist) => {
    setDraggedTherapist(therapist);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', therapist.id);
  };

  const handleDragOver = (e, patientId, timeSlot) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ patientId, timeSlot });
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e, patientId, timeSlot) => {
    e.preventDefault();
    if (draggedTherapist) {
      const appointment = getPatientAppointmentForSlot(patientId, timeSlot);
      if (appointment) {
        onTherapistAssignment({
          appointmentId: appointment.id,
          therapistId: draggedTherapist.id,
          patientId,
          timeSlot
        });
      }
    }
    setDraggedTherapist(null);
    setDragOverSlot(null);
  };

  const handleUnassignTherapist = (appointment) => {
    onTherapistAssignment({
      appointmentId: appointment.id,
      therapistId: null,
      patientId: appointment.patientId,
      action: 'unassign'
    });
  };

  if (orderedPatients.length === 0) {
    console.log('PatientScheduleGrid: No filtered patients', {
      totalPatients: patients.length,
      viewMode,
      showOnlyUncovered,
      patientScheduleData: Object.keys(patientScheduleData)
    });
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">
          {showOnlyUncovered ? 'All Patients Covered' : 'No Patient Schedules'}
        </p>
        <p>
          {showOnlyUncovered 
            ? 'All patients have therapist coverage for their scheduled sessions.'
            : viewMode === 'columns' 
              ? `No patients found. Total available: ${patients.length}`
              : 'No patients have appointments scheduled for this date.'
          }
        </p>
      </div>
    );
  }

  // Daily view - show single day schedule
  if (viewMode === 'daily') {
    return (
      <div className="flex flex-col h-full">
        {/* Available Therapists Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Available Therapists</h3>
          <div className="flex flex-wrap gap-2">
            {therapists.map(therapist => (
              <div
                key={therapist.id}
                draggable
                onDragStart={(e) => handleDragStart(e, therapist)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-700 cursor-move hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <GripVertical className="h-4 w-4" />
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {therapist.firstName} {therapist.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Schedule Grid */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredPatients.length} patients with scheduled sessions
            </p>
          </div>

          {/* Time slots and appointments */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <div className="grid grid-cols-[100px_1fr] gap-0">
                {/* Time column header */}
                <div className="p-3 border-r border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold sticky top-0 z-10">
                  Time
                </div>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold sticky top-0 z-10">
                  Appointments & Assignments
                </div>
                
                {/* Time slot rows */}
                {TIME_SLOTS.map((timeSlot, index) => {
                  // Get all appointments for this time slot
                  const timeSlotAppointments = filteredPatients.flatMap(patient => {
                    const appointment = getPatientAppointmentForSlot(patient.id, timeSlot);
                    return appointment ? [{ ...appointment, patient }] : [];
                  });
                  
                  return (
                    <React.Fragment key={timeSlot}>
                      <div className={cn(
                        "p-3 border-r border-b border-gray-100 dark:border-gray-700/50 text-sm font-medium",
                        index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                      )}>
                        {timeSlot}
                      </div>
                      
                      <div className={cn(
                        "p-3 border-b border-gray-100 dark:border-gray-700/50 min-h-[60px]",
                        index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        // Handle drop on time slot - could create new appointment
                        if (draggedTherapist) {
                          console.log('Dropped therapist on time slot:', timeSlot, draggedTherapist);
                        }
                        setDraggedTherapist(null);
                      }}
                      >
                        {timeSlotAppointments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {timeSlotAppointments.map(appointment => (
                              <div
                                key={appointment.id}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-lg border text-sm cursor-pointer hover:shadow-sm transition-all",
                                  appointment.therapistId ? COVERAGE_COLORS.covered : COVERAGE_COLORS.uncovered
                                )}
                                onClick={() => onAppointmentClick(appointment)}
                                onDragOver={(e) => handleDragOver(e, appointment.patient.id, timeSlot)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, appointment.patient.id, timeSlot)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" title={formatFullPatientName(appointment.patient)}>
                                    {formatPatientName(appointment.patient)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({appointment.serviceType || 'direct'})
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {appointment.therapistId ? (
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span className="text-xs">{formatTherapistName(appointment.therapist)}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnassignTherapist(appointment);
                                        }}
                                        className="hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                                        title="Unassign therapist"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span className="text-xs font-medium">NEEDS THERAPIST</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm italic">No appointments</div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Column view - show patients side by side
  if (viewMode === 'columns') {
    return (
      <div className="flex flex-col h-full">
        {/* Collapsible Therapist Drawer */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 transition-all duration-300">
          {/* Drawer Header */}
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            onClick={() => setIsTherapistDrawerOpen(!isTherapistDrawerOpen)}
          >
            <div className="flex items-center gap-2">
              <Menu className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Available Therapists ({therapists.length})
              </h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Layout Density Controls */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={setCompactLayout}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    layoutDensity === 'compact' 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                  title="Compact view - see more patients"
                >
                  Compact
                </button>
                <button
                  onClick={setNormalLayout}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    layoutDensity === 'normal' 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                  title="Normal view"
                >
                  Normal
                </button>
                <button
                  onClick={setSpaciousLayout}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-colors",
                    layoutDensity === 'spacious' 
                      ? "bg-blue-500 text-white" 
                      : "hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                  title="Spacious view - more detail"
                >
                  Spacious
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isTherapistDrawerOpen ? 'Click to collapse' : 'Click to expand'}
                </span>
                {isTherapistDrawerOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </div>
            </div>
          </div>
          
          {/* Drawer Content */}
          {isTherapistDrawerOpen && (
            <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="flex flex-wrap gap-2">
                {therapists.map(therapist => (
                  <div
                    key={therapist.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, therapist)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-700 cursor-move hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <GripVertical className="h-4 w-4" />
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {therapist.firstName} {therapist.lastName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Patient Columns */}
        <div className="flex-1 overflow-hidden relative">
          {/* Reordering notification */}
          {isReordering && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                <span className="text-sm font-medium">Reordering patients...</span>
              </div>
            </div>
          )}
          
          {/* Success notification */}
          {reorderAnimation?.success && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm font-medium">Order updated!</span>
              </div>
            </div>
          )}
          
          <div className="h-full overflow-x-auto">
            <div 
              className={cn(
                `flex ${getLayoutDimensions().gap} min-w-max h-full transition-all duration-300`,
                isReordering && "transform-gpu"
              )}
            >
              {orderedPatients.map((patient, index) => {
                const data = patientScheduleData[patient.id];
                const isExpanded = expandedPatients[patient.id] !== false; // Default expanded
                const isDragTarget = dragOverPatient === patient.id;
                const isBeingDragged = draggedPatient?.id === patient.id;
                const isAnimating = reorderAnimation && (
                  reorderAnimation.draggedId === patient.id || 
                  reorderAnimation.targetId === patient.id
                );
                const isSuccessFlash = reorderAnimation?.success && isAnimating;
                const dimensions = getLayoutDimensions();
                
                return (
                  <div
                    key={patient.id}
                    data-patient-card
                    onDragOver={(e) => handlePatientDragOver(e, patient.id)}
                    onDragLeave={handlePatientDragLeave}
                    onDrop={(e) => handlePatientDrop(e, patient.id)}
                    style={{
                      transitionDelay: isReordering ? `${index * 80}ms` : '0ms',
                      width: `${dimensions.cardWidth}px`,
                      minWidth: `${dimensions.cardMinWidth}px`,
                      borderColor: patient.color || '#6B7280'
                    }}
                    className={cn(
                      "flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border-2 shadow-sm h-full flex flex-col transition-all duration-500 ease-in-out",
                      isDragTarget && "transform scale-110 shadow-2xl border-blue-500 dark:border-blue-400 ring-4 ring-blue-300 dark:ring-blue-600 bg-blue-50 dark:bg-blue-900/20",
                      isBeingDragged && "opacity-30 shadow-2xl z-50 transform scale-95",
                      isAnimating && !isSuccessFlash && "transform translateX(20px) scale(105)",
                      isSuccessFlash && "transform scale-110 ring-4 ring-green-400 dark:ring-green-500 shadow-2xl border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20",
                      isReordering && "transition-all duration-500 ease-out"
                    )}
                  >
                    {/* Patient Accordion Header */}
                    <div 
                      className={cn(
                        `${dimensions.headerPadding} transition-colors relative cursor-pointer`,
                        data.coverageStatus === 'covered' && "bg-green-50 dark:bg-green-900/20",
                        data.coverageStatus === 'partial' && "bg-yellow-50 dark:bg-yellow-900/20", 
                        data.coverageStatus === 'uncovered' && "bg-red-50 dark:bg-red-900/20",
                        data.coverageStatus === 'none' && "bg-gray-50 dark:bg-gray-900/20",
                        "hover:opacity-90"
                      )}
                      onClick={() => togglePatient(patient.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Dedicated drag handle */}
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handlePatientDragStart(e, patient);
                            }}
                            onDragEnd={handlePatientDragEnd}
                            className={cn(
                              "cursor-move hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded transition-all duration-200",
                              "hover:scale-110 active:scale-95",
                              isBeingDragged && "bg-blue-100 dark:bg-blue-900/30"
                            )}
                            title="Drag to reorder patients"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className={cn(
                              "h-4 w-4 transition-colors duration-200",
                              isBeingDragged ? "text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            )} />
                          </div>
                          <div 
                            className="w-3 h-3 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: patient.color || '#6B7280' }}
                            title="Patient color"
                          ></div>
                          <div>
                            <h3 
                              className={cn(
                                "font-bold text-gray-900 dark:text-white",
                                layoutDensity === 'compact' ? "text-sm" : layoutDensity === 'spacious' ? "text-xl" : "text-lg"
                              )}
                              title={formatFullPatientName(patient)}
                            >
                              {layoutDensity === 'compact' ? formatPatientName(patient) : formatFullPatientName(patient)}
                            </h3>
                            {/* Patient Summary - Always visible */}
                            <div className={cn(
                              "mt-1 text-gray-600 dark:text-gray-400",
                              layoutDensity === 'compact' ? "text-xs" : "text-sm"
                            )}>
                              <div className={cn(
                                "flex",
                                layoutDensity === 'compact' ? "gap-2 flex-col" : "gap-4"
                              )}>
                                <span>{data.totalHours.toFixed(1)}h</span>
                                <span>{data.appointments.length} sessions</span>
                                {layoutDensity !== 'compact' && (
                                  <span>Required: {patient.requiredWeeklyHours || 0}h/week</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {isExpanded ? 'Click to collapse' : 'Click to expand'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Time Slots - Only show when expanded */}
                    {isExpanded && (
                      <div className="flex-1 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                        {TIME_SLOTS.map((timeSlot, index) => {
                        const appointment = getPatientAppointmentForSlot(patient.id, timeSlot);
                        const isDropTarget = dragOverSlot?.patientId === patient.id && dragOverSlot?.timeSlot === timeSlot;
                        
                        return (
                          <div
                            key={timeSlot}
                            className={cn(
                              `${dimensions.padding} border-b border-gray-100 dark:border-gray-700/50 transition-all`,
                              layoutDensity === 'compact' ? "min-h-[45px]" : layoutDensity === 'spacious' ? "min-h-[80px]" : "min-h-[60px]",
                              index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50",
                              isDropTarget && "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600"
                            )}
                            onDragOver={(e) => handleDragOver(e, patient.id, timeSlot)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, patient.id, timeSlot)}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className={cn(
                                "font-medium text-gray-500 dark:text-gray-400",
                                layoutDensity === 'compact' ? "text-[10px]" : "text-xs"
                              )}>
                                {layoutDensity === 'compact' ? timeSlot.replace('-', '-') : timeSlot}
                              </span>
                              {isDropTarget && (
                                <span className={cn(
                                  "text-blue-600 dark:text-blue-400 font-medium",
                                  layoutDensity === 'compact' ? "text-[10px]" : "text-xs"
                                )}>
                                  Drop to assign
                                </span>
                              )}
                            </div>
                            
                            {appointment ? (
                              <div className="space-y-1">
                                <div className={cn(
                                  "px-2 py-1 rounded font-medium border",
                                  layoutDensity === 'compact' ? "text-[10px]" : "text-xs",
                                  appointment.therapistId ? COVERAGE_COLORS.covered : COVERAGE_COLORS.uncovered
                                )}>
                                  {appointment.therapistId ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        <User className={cn(
                                          layoutDensity === 'compact' ? "h-2 w-2" : "h-3 w-3"
                                        )} />
                                        <span className="font-semibold">
                                          {layoutDensity === 'compact' 
                                            ? formatTherapistName(appointment.therapist)
                                            : `${appointment.therapist?.firstName} ${appointment.therapist?.lastName}`
                                          }
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleUnassignTherapist(appointment)}
                                        className="hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                                        title="Unassign therapist"
                                      >
                                        <X className={cn(
                                          layoutDensity === 'compact' ? "h-2 w-2" : "h-3 w-3"
                                        )} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle className={cn(
                                        layoutDensity === 'compact' ? "h-2 w-2" : "h-3 w-3"
                                      )} />
                                      <span>{layoutDensity === 'compact' ? 'NEEDS' : 'NEEDS THERAPIST'}</span>
                                    </div>
                                  )}
                                </div>
                                {layoutDensity !== 'compact' && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {appointment.serviceType || 'Direct Service'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div 
                                className={cn(
                                  "text-gray-400 cursor-pointer hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors",
                                  layoutDensity === 'compact' ? "text-[10px] p-1" : "text-xs p-2"
                                )}
                                onClick={() => onCellClick({ patientId: patient.id, timeSlot, selectedDate })}
                                title="Click to add appointment"
                              >
                                <Plus className={cn(
                                  "mx-auto mb-1 opacity-50",
                                  layoutDensity === 'compact' ? "h-2 w-2" : "h-3 w-3"
                                )} />
                                {layoutDensity === 'compact' ? 'No' : 'No session'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default grid view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Patient Coverage - {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredPatients.length} patients with scheduled sessions
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span>Fully Covered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>Partially Covered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-100 border border-red-400 rounded animate-pulse"></div>
              <span>Uncovered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Schedule Grids */}
      <div className="space-y-6">
        {filteredPatients.map(patient => {
          const isExpanded = expandedPatients[patient.id] !== false; // Default expanded
          const data = patientScheduleData[patient.id];
          const therapistNames = Array.from(data.therapistCount).map(id => {
            const therapist = therapists.find(t => t.id === id);
            return formatTherapistName(therapist);
          });
          
          return (
            <div 
              key={patient.id}
              className="bg-white dark:bg-gray-800 rounded-lg border-2 overflow-hidden shadow-sm"
              style={{ borderColor: patient.color || '#6B7280' }}
            >
              {/* Patient Header */}
              <div 
                className={cn(
                  "p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors",
                  data.coverageStatus === 'covered' && "bg-green-50 dark:bg-green-900/20",
                  data.coverageStatus === 'partial' && "bg-yellow-50 dark:bg-yellow-900/20", 
                  data.coverageStatus === 'uncovered' && "bg-red-50 dark:bg-red-900/20"
                )}
                onClick={() => togglePatient(patient.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: patient.color || '#6B7280' }}
                      title="Patient color"
                    ></div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        <span 
                          title={formatFullPatientName(patient)}
                          className="cursor-help"
                        >
                          {formatPatientName(patient)}
                        </span>
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{data.totalHours.toFixed(1)} hours scheduled</span>
                        <span>{data.appointments.length} sessions</span>
                        {therapistNames.length > 0 && (
                          <span>Therapists: {therapistNames.join(', ')}</span>
                        )}
                        {data.therapistRotation > 3 && (
                          <span className="text-amber-600 font-medium">
                            <AlertTriangle className="h-4 w-4 inline mr-1" />
                            {data.therapistRotation} different therapists
                          </span>
                        )}
                        {data.continuityScore !== undefined && (
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            data.continuityScore >= 80 ? "bg-green-100 text-green-800" :
                            data.continuityScore >= 60 ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          )}>
                            Continuity: {data.continuityScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {data.gaps.length > 0 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400">
                        {data.gaps.length} schedule gaps
                      </div>
                    )}
                    
                    <Button variant="ghost" size="sm">
                      {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    {/* Time Slot Grid */}
                    <div className="grid grid-cols-[140px_1fr] gap-0">
                      {/* Time column header */}
                      <div className="p-3 border-r border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                        Time Slots
                      </div>
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                        Therapist Assignment
                      </div>
                      
                      {/* Time slot rows */}
                      {TIME_SLOTS.map((timeSlot, index) => {
                        const appointment = getPatientAppointmentForSlot(patient.id, timeSlot);
                        
                        return (
                          <React.Fragment key={timeSlot}>
                            <div className={cn(
                              "p-3 border-r border-b border-gray-100 dark:border-gray-700/50 text-sm font-medium",
                              index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                            )}>
                              {timeSlot}
                            </div>
                            
                            <div className={cn(
                              "p-3 border-b border-gray-100 dark:border-gray-700/50 min-h-[50px] flex items-center",
                              index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/30 dark:bg-gray-800/50"
                            )}>
                              {appointment ? (
                                <div 
                                  className={cn(
                                    "px-3 py-1 rounded-full border cursor-pointer hover:shadow-sm transition-all text-sm font-medium",
                                    appointment.therapistId ? COVERAGE_COLORS.covered : COVERAGE_COLORS.uncovered
                                  )}
                                  onClick={() => onAppointmentClick(appointment)}
                                  onDragOver={(e) => handleDragOver(e, patient.id, timeSlot)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, patient.id, timeSlot)}
                                >
                                  {appointment.therapistId ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        <span>{formatTherapistName(appointment.therapist)}</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnassignTherapist(appointment);
                                        }}
                                        className="hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                                        title="Unassign therapist"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                                      NEEDS THERAPIST
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div 
                                  className="text-gray-400 text-sm cursor-pointer hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition-colors flex items-center gap-1"
                                  onClick={() => onCellClick({ patientId: patient.id, timeSlot, selectedDate })}
                                  title="Click to add appointment"
                                >
                                  <Plus className="h-3 w-3 opacity-50" />
                                  No session
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}