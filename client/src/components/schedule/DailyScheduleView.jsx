import React from 'react';
import { format } from 'date-fns';
import { Clock, Calendar, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { calculateAppointmentStyle, formatTime } from '../../utils/date-utils';

export default function DailyScheduleView({
  therapistGroups,
  patientGroups,
  timeSlots,
  scheduleData,
  onAppointmentClick,
  onAddAppointment,
  formatPatientName,
  formatFullPatientName
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Therapist View */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b flex justify-between items-center">
            <h3 className="font-semibold">Therapist Schedule</h3>
            <Button variant="ghost" size="sm" onClick={onAddAppointment}>
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
                          onClick={() => onAppointmentClick(appointment)}
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
                  onClick={onAddAppointment}
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
            <Button variant="ghost" size="sm" onClick={onAddAppointment}>
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
                          onClick={() => onAppointmentClick(appointment)}
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
                  onClick={onAddAppointment}
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
  );
}