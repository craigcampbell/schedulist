import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  AlertTriangle,
  User,
  MapPin,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { format, addDays, subDays, parseISO, isToday } from 'date-fns';
import MiniCalendar from './MiniCalendar';

const PatientScheduleView = ({ 
  patientId, 
  selectedDate = new Date(), 
  onDateChange,
  userRole = 'bcba' 
}) => {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState(null);
  const [availableTherapists, setAvailableTherapists] = useState([]);
  const [showDetails, setShowDetails] = useState(true);

  // Time slots configuration
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour}:00`);
      slots.push(`${hour}:30`);
    }
    return slots;
  }, []);

  // Fetch schedule data for the selected date
  useEffect(() => {
    fetchScheduleData();
  }, [patientId, selectedDate]);

  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Fetch patient time blocks and assignments
      const response = await fetch(
        `/api/patient-scheduling/time-blocks/patient/${patientId}?startDate=${dateStr}&endDate=${dateStr}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setScheduleData(data.timeBlocks);
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert time string to minutes for easier calculations
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes back to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Generate schedule blocks for visualization
  const scheduleBlocks = useMemo(() => {
    if (!scheduleData) return [];

    const blocks = [];
    
    scheduleData.forEach(timeBlock => {
      const startMinutes = timeToMinutes(timeBlock.startTime);
      const endMinutes = timeToMinutes(timeBlock.endTime);
      const durationMinutes = endMinutes - startMinutes;

      // Patient time block (blue background)
      blocks.push({
        id: `patient-${timeBlock.id}`,
        type: 'patient',
        timeBlockId: timeBlock.id,
        startTime: timeBlock.startTime,
        endTime: timeBlock.endTime,
        startMinutes,
        endMinutes,
        durationMinutes,
        patient: true,
        serviceType: timeBlock.serviceType,
        priority: timeBlock.priority
      });

      // Therapist assignments (green blocks on top of patient blocks)
      timeBlock.assignments?.forEach(assignment => {
        const assignmentStartMinutes = timeToMinutes(assignment.startTime);
        const assignmentEndMinutes = timeToMinutes(assignment.endTime);
        
        blocks.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          timeBlockId: timeBlock.id,
          assignmentId: assignment.id,
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          startMinutes: assignmentStartMinutes,
          endMinutes: assignmentEndMinutes,
          durationMinutes: assignmentEndMinutes - assignmentStartMinutes,
          therapist: assignment.Therapist,
          serviceType: assignment.serviceType,
          status: assignment.status
        });
      });

      // Coverage gaps (red blocks)
      if (timeBlock.gaps?.length > 0) {
        timeBlock.gaps.forEach((gap, index) => {
          const gapStartMinutes = timeToMinutes(gap.startTime);
          const gapEndMinutes = timeToMinutes(gap.endTime);
          
          blocks.push({
            id: `gap-${timeBlock.id}-${index}`,
            type: 'gap',
            timeBlockId: timeBlock.id,
            startTime: gap.startTime,
            endTime: gap.endTime,
            startMinutes: gapStartMinutes,
            endMinutes: gapEndMinutes,
            durationMinutes: gap.durationMinutes,
            gap: true,
            description: gap.description
          });
        });
      }
    });

    return blocks.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [scheduleData]);

  // Handle date navigation
  const handlePreviousDay = () => {
    const previousDay = subDays(selectedDate, 1);
    onDateChange?.(previousDay);
  };

  const handleNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    onDateChange?.(nextDay);
  };

  const handleToday = () => {
    const today = new Date();
    onDateChange?.(today);
  };

  // Handle gap click for therapist assignment
  const handleGapClick = async (gapBlock) => {
    setSelectedGap(gapBlock);
    
    // Fetch available therapists for this time slot
    try {
      const response = await fetch('/api/patient-scheduling/gaps/resolve-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          timeBlockId: gapBlock.timeBlockId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTherapists(data.resolutionOptions[0]?.availableTherapists || []);
        setShowAssignmentModal(true);
      }
    } catch (error) {
      console.error('Error fetching available therapists:', error);
    }
  };

  // Handle therapist assignment
  const handleAssignTherapist = async (therapistId) => {
    if (!selectedGap) return;

    try {
      const response = await fetch('/api/patient-scheduling/assign/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          timeBlockId: selectedGap.timeBlockId,
          therapistId,
          startTime: selectedGap.startTime,
          endTime: selectedGap.endTime
        })
      });

      if (response.ok) {
        setShowAssignmentModal(false);
        setSelectedGap(null);
        fetchScheduleData(); // Refresh the schedule
      }
    } catch (error) {
      console.error('Error assigning therapist:', error);
    }
  };

  // Calculate time slot height and position
  const getBlockStyle = (block) => {
    // Each 30-minute slot is 30px, so 1 minute = 1px
    // 7:00 AM is our baseline (0px), so subtract 7*60 = 420 minutes
    const baseMinutes = 7 * 60; // 7:00 AM in minutes
    const top = block.startMinutes - baseMinutes;
    const height = block.durationMinutes;
    
    return {
      position: 'absolute',
      top: `${top}px`,
      height: `${height}px`,
      left: '0',
      right: '0',
      minHeight: '15px'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading schedule...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Schedule View */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h1>
              <span className="text-lg text-gray-600 capitalize">
                {format(selectedDate, 'EEEE')}
              </span>
              {isToday(selectedDate) && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  Today
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousDay}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Today
              </button>
              
              <button
                onClick={handleNextDay}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                {showDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="flex-1 overflow-auto">
          <div className="flex">
            {/* Time Labels */}
            <div className="w-20 bg-white border-r border-gray-200">
              <div className="h-6"></div> {/* Header spacer */}
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className={`h-[30px] px-2 text-xs text-gray-600 border-b border-gray-100 flex items-center ${
                    time.endsWith(':00') ? 'font-medium' : 'text-gray-400'
                  }`}
                >
                  {time.endsWith(':00') ? format(parseISO(`2000-01-01T${time}`), 'h a') : ''}
                </div>
              ))}
            </div>

            {/* Schedule Content */}
            <div className="flex-1 relative">
              {/* Time Grid Lines */}
              <div className="absolute inset-0">
                {timeSlots.map((time, index) => (
                  <div
                    key={time}
                    className={`h-[30px] border-b ${
                      time.endsWith(':00') ? 'border-gray-200' : 'border-gray-100'
                    }`}
                  />
                ))}
              </div>

              {/* Schedule Blocks */}
              <div className="relative" style={{ height: `${timeSlots.length * 30}px` }}>
                {scheduleBlocks.map((block) => (
                  <div
                    key={block.id}
                    style={getBlockStyle(block)}
                    className={`
                      border rounded-md mx-1 flex items-center justify-between px-2 text-xs font-medium
                      ${block.type === 'patient' 
                        ? 'bg-blue-100 border-blue-300 text-blue-800 z-10' 
                        : block.type === 'assignment'
                        ? 'bg-green-100 border-green-300 text-green-800 z-20'
                        : 'bg-red-100 border-red-300 text-red-800 z-30 cursor-pointer hover:bg-red-200 transition-colors'
                      }
                      ${block.type === 'gap' ? 'animate-pulse' : ''}
                    `}
                    onClick={() => block.type === 'gap' && handleGapClick(block)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {block.type === 'patient' && (
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Patient Schedule
                          </span>
                        )}
                        {block.type === 'assignment' && (
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {block.therapist?.firstName} {block.therapist?.lastName}
                          </span>
                        )}
                        {block.type === 'gap' && (
                          <span className="flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            No Coverage
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">
                        {block.startTime} - {block.endTime}
                      </div>
                    </div>
                    
                    {block.type === 'gap' && (
                      <Plus className="h-3 w-3 ml-1 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {showDetails && (
        <div className="w-80 bg-white border-l border-gray-200 overflow-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule Details</h2>
            
            {/* Mini Calendar */}
            <div className="mb-6">
              <MiniCalendar
                selectedDate={selectedDate}
                onDateSelect={onDateChange}
                className="border-0 p-0"
              />
            </div>
            
            {/* Schedule Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Coverage Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Blocks:</span>
                  <span className="font-medium">{scheduleBlocks.filter(b => b.type === 'patient').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Covered:</span>
                  <span className="font-medium text-green-600">
                    {scheduleBlocks.filter(b => b.type === 'assignment').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gaps:</span>
                  <span className="font-medium text-red-600">
                    {scheduleBlocks.filter(b => b.type === 'gap').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Assignments List */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">Today's Assignments</h3>
              <div className="space-y-2">
                {scheduleBlocks
                  .filter(block => block.type === 'assignment')
                  .map(assignment => (
                    <div
                      key={assignment.id}
                      className="bg-green-50 border border-green-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-green-800">
                          {assignment.therapist?.firstName} {assignment.therapist?.lastName}
                        </span>
                        <span className="text-xs text-green-600 capitalize">
                          {assignment.status}
                        </span>
                      </div>
                      <div className="text-sm text-green-700">
                        {assignment.startTime} - {assignment.endTime}
                      </div>
                      <div className="text-xs text-green-600 mt-1 capitalize">
                        {assignment.serviceType} Service
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Coverage Gaps */}
            {scheduleBlocks.filter(b => b.type === 'gap').length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                  Coverage Gaps
                </h3>
                <div className="space-y-2">
                  {scheduleBlocks
                    .filter(block => block.type === 'gap')
                    .map(gap => (
                      <div
                        key={gap.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition-colors"
                        onClick={() => handleGapClick(gap)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-red-800">
                            {gap.durationMinutes} min gap
                          </span>
                          <Plus className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="text-sm text-red-700">
                          {gap.startTime} - {gap.endTime}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Click to assign therapist
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Therapist Assignment Modal */}
      {showAssignmentModal && selectedGap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Therapist
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Time Slot: {selectedGap.startTime} - {selectedGap.endTime}
              </p>
              <p className="text-sm text-gray-600">
                Duration: {selectedGap.durationMinutes} minutes
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <h4 className="font-medium text-gray-900">Available Therapists:</h4>
              {availableTherapists.length > 0 ? (
                availableTherapists.map(therapist => (
                  <button
                    key={therapist.therapistId}
                    onClick={() => handleAssignTherapist(therapist.therapistId)}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {therapist.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {therapist.reason}
                        </div>
                      </div>
                      {therapist.isPreferred && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Preferred
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No available therapists found for this time slot.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientScheduleView;