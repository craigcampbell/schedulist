import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import PatientColorSelect from '../PatientColorSelect';
import { getAppointmentTypeOptions, requiresPatient } from '../../utils/appointmentTypes';
import { formatTime } from '../../utils/date-utils';

export default function EditAppointmentForm({
  editingAppointment,
  editFormState,
  setEditFormState,
  patients,
  therapists,
  bcbas,
  locations,
  user,
  formError,
  isSubmittingForm,
  timeSlots,
  onSubmit,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Edit Appointment</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Editing: {editingAppointment.title || `${editingAppointment.serviceType} appointment`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
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
          
          {/* Additional Fields */}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              value={editFormState.title || ''}
              onChange={(e) => setEditFormState({...editFormState, title: e.target.value})}
              placeholder="Session title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              rows="3"
              value={editFormState.notes || ''}
              onChange={(e) => setEditFormState({...editFormState, notes: e.target.value})}
              placeholder="Add any notes about this appointment"
            ></textarea>
          </div>
          
          {formError && (
            <div className="p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md">
              <p className="text-sm">{formError}</p>
            </div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={onSubmit}
              disabled={isSubmittingForm}
            >
              {isSubmittingForm ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}