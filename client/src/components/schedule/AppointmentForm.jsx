import React from 'react';
import { format, parseISO } from 'date-fns';
import { X, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import PatientColorSelect from '../PatientColorSelect';
import { getAppointmentTypeOptions, requiresPatient } from '../../utils/appointmentTypes';
import { formatTime } from '../../utils/date-utils';

export default function AppointmentForm({
  formState,
  setFormState,
  patients,
  therapists,
  bcbas,
  locations,
  user,
  formError,
  isSubmittingForm,
  isCheckingAvailability,
  onSubmit,
  onClose,
  onCheckAvailability
}) {
  return (
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
                    onClick={onCheckAvailability}
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
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={onSubmit}
              disabled={isSubmittingForm}
            >
              {isSubmittingForm ? 'Creating...' : 'Create Appointment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}