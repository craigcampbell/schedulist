import React from 'react';

const PatientColorSelect = ({ patients, value, onChange, placeholder = "Select a patient", required = false, className = "", showAll = false }) => {
  return (
    <div className="relative">
      <select 
        className={`w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 ${value ? 'pl-10' : ''} ${className}`}
        value={value || ''}
        onChange={onChange}
        required={required}
      >
        {showAll && <option value="">All Patients</option>}
        {!showAll && <option value="">{placeholder}</option>}
        {patients?.map(patient => (
          <option key={patient.id} value={patient.id}>
            {patient.firstName} {patient.lastName?.charAt(0)}.
          </option>
        ))}
      </select>
      
      {/* Color indicator overlay */}
      {value && patients && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <div 
            className="w-4 h-4 rounded-full border border-gray-300"
            style={{ 
              backgroundColor: patients.find(p => p.id === value)?.color || '#6B7280' 
            }}
          />
        </div>
      )}
      
    </div>
  );
};

export default PatientColorSelect;