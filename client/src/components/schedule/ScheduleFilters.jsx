import React from 'react';
import { Button } from '../ui/button';
import PatientColorSelect from '../PatientColorSelect';

export default function ScheduleFilters({
  showFilters,
  selectedTherapist,
  selectedPatient,
  therapists,
  patients,
  onTherapistChange,
  onPatientChange,
  onResetFilters
}) {
  if (!showFilters) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-4 border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Therapist</label>
          <select 
            className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
            value={selectedTherapist || ''}
            onChange={(e) => onTherapistChange(e.target.value || null)}
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
            onChange={(e) => onPatientChange(e.target.value || null)}
            showAll={true}
          />
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onResetFilters}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
}