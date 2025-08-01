import React from 'react';
import { format, parseISO } from 'date-fns';
import { User, Calendar } from 'lucide-react';
import { formatTime } from '../../utils/date-utils';

export default function WeeklyScheduleView({
  therapistGroups,
  onAppointmentClick
}) {
  return (
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
                    onClick={() => onAppointmentClick(appointment)}
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
  );
}