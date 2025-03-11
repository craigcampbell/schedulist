import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, startOfDay, isSameDay } from 'date-fns';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User 
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { getSchedule } from '../../api/schedule';
import { calculateAppointmentStyle, formatTime } from '../../utils/date-utils';

export default function TherapistSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState('daily');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Fetch schedule data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['therapistSchedule', viewType, selectedDate],
    queryFn: () => getSchedule(viewType, selectedDate.toISOString()),
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
  
  // Handle appointment click
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
  };
  
  // Close appointment details modal
  const closeAppointmentDetails = () => {
    setSelectedAppointment(null);
  };
  
  // Generate time slots from 8 AM to 6 PM
  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    timeSlots.push(new Date(selectedDate).setHours(hour, 0, 0, 0));
  }
  
  // Filter appointments for daily view
  const filterDailyAppointments = () => {
    if (!data || !data.appointments) return [];
    
    return data.appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      return isSameDay(appointmentDate, selectedDate);
    });
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        
        <div className="flex items-center space-x-2">
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
        </div>
      </div>
      
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
      {error && (
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">Failed to load schedule</p>
            <Button onClick={refetch}>Try Again</Button>
          </div>
        </div>
      )}
      
      {/* Daily View */}
      {!isLoading && !error && viewType === 'daily' && (
        <div className="flex-1 overflow-y-auto relative">
          <div className="schedule-grid">
            {/* Time column */}
            <div className="border-r border-gray-200 dark:border-gray-700">
              {timeSlots.map((time, i) => (
                <div key={i} className="h-24 px-2 py-1 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {format(time, 'h a')}
                </div>
              ))}
            </div>
            
            {/* Appointments column */}
            <div className="relative">
              {timeSlots.map((time, i) => (
                <div key={i} className="h-24 border-b border-gray-200 dark:border-gray-700">
                  {/* Half-hour line */}
                  <div className="absolute w-full h-px bg-gray-100 dark:bg-gray-800" style={{ top: `${i * 96 + 48}px` }}></div>
                </div>
              ))}
              
              {/* Appointments */}
              {filterDailyAppointments().map((appointment) => {
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
                    <div className="font-medium truncate">{appointment.patient.firstName} {appointment.patient.lastInitial}.</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Weekly View */}
      {!isLoading && !error && viewType === 'weekly' && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {data?.appointments?.map(appointment => (
              <div
                key={appointment.id}
                className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleAppointmentClick(appointment)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">
                      {appointment.patient.firstName} {appointment.patient.lastInitial}.
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(appointment.startTime), 'EEEE, MMMM d')}
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
            
            {data?.appointments?.length === 0 && (
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
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Date & Time</h3>
                <p>{format(new Date(selectedAppointment.startTime), 'PPPP')}</p>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}