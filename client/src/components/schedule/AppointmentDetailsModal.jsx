import React from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '../ui/button';
import { formatTime } from '../../utils/date-utils';
import { getAppointmentType, requiresPatient } from '../../utils/appointmentTypes';

export default function AppointmentDetailsModal({
  appointment,
  onClose,
  onEdit,
  onViewPatient,
  canEdit,
  formatFullPatientName
}) {
  if (!appointment) return null;

  const appointmentType = getAppointmentType(appointment.serviceType);
  const hasPatient = requiresPatient(appointment.serviceType) && appointment.patient;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Appointment Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        
        <div className="space-y-4">
          {/* Show service type with icon */}
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Service Type</h3>
            <p className="text-lg flex items-center gap-2">
              <span>{appointmentType.icon}</span>
              <span>{appointmentType.label}</span>
            </p>
          </div>

          {/* Only show patient if it's a patient-required service */}
          {hasPatient && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Patient</h3>
              <p className="text-lg">
                {formatFullPatientName(appointment.patient)}
              </p>
            </div>
          )}

          {/* Show title for non-patient services */}
          {!hasPatient && appointment.title && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Title</h3>
              <p className="text-lg">{appointment.title}</p>
            </div>
          )}
          
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Therapist</h3>
            <p className="text-lg">
              {appointment?.therapist?.name || 
               `${appointment?.therapist?.firstName || ''} ${appointment?.therapist?.lastName || ''}` || 
               'Unknown'}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Date & Time</h3>
            <p>{appointment?.startTime ? format(parseISO(appointment.startTime), 'PPPP') : 'Unknown date'}</p>
            <p>
              {appointment?.startTime ? formatTime(appointment.startTime) : 'N/A'} - 
              {appointment?.endTime ? formatTime(appointment.endTime) : 'N/A'}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Location</h3>
            <p>{appointment?.location?.name || 'No location'}</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Status</h3>
            <div className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              {appointment?.status || 'Unknown'}
            </div>
          </div>
          
          {appointment?.notes && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Notes</h3>
              <p className="text-gray-600 dark:text-gray-400">{appointment.notes}</p>
            </div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {hasPatient && (
              <Button 
                variant="default" 
                onClick={onViewPatient}
              >
                View Patient
              </Button>
            )}
            {canEdit && (
              <Button 
                variant="default" 
                onClick={() => onEdit(appointment)}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}