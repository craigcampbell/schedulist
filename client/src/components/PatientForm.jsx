import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPatient, updatePatient } from '../api/patients';
import ColorPicker from './ColorPicker';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';

const PatientForm = ({ patient = null, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditMode = !!patient;
  
  console.log('PatientForm rendered:', { isEditMode, patient });

  const [formData, setFormData] = useState({
    firstName: patient?.firstName || '',
    lastName: patient?.lastName || '',
    dateOfBirth: patient?.dateOfBirth || '',
    insuranceProvider: patient?.insuranceProvider || '',
    insuranceId: patient?.insuranceId || '',
    phone: patient?.phone || '',
    address: patient?.address || '',
    requiredWeeklyHours: patient?.requiredWeeklyHours || '',
    color: patient?.color || '#6B7280',
    teamId: patient?.teamId || '',
  });

  const [errors, setErrors] = useState({});

  // Fetch teams based on user role
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-for-patient-form'],
    queryFn: async () => {
      const endpoint = user.roles.includes('admin') ? '/admin/teams' : '/bcba/teams';
      const response = await apiClient.get(endpoint);
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['patients']);
      if (onSuccess) {
        onSuccess(data.patient);
      } else {
        navigate(`/patients/${data.patient.id}`);
      }
    },
    onError: (error) => {
      console.error('Error creating patient:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to create patient' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePatient(id, data),
    onSuccess: (data) => {
      console.log('Update patient success:', data);
      queryClient.invalidateQueries(['patients']);
      queryClient.invalidateQueries(['patient', patient.id]);
      queryClient.invalidateQueries(['patients-with-assignments']);
      if (onSuccess) {
        onSuccess(data.patient);
      }
    },
    onError: (error) => {
      console.error('Error updating patient:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to update patient' });
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleColorChange = (color) => {
    setFormData(prev => ({
      ...prev,
      color
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    console.log('Validating form data:', formData);
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }
    
    if (formData.requiredWeeklyHours && (isNaN(formData.requiredWeeklyHours) || formData.requiredWeeklyHours < 0)) {
      newErrors.requiredWeeklyHours = 'Weekly hours must be a positive number';
    }
    
    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    console.log('handleSubmit called');
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('Validation failed');
      return;
    }

    const dataToSubmit = {
      ...formData,
      requiredWeeklyHours: formData.requiredWeeklyHours ? parseFloat(formData.requiredWeeklyHours) : null,
    };

    console.log('Submitting patient data:', { isEditMode, patientId: patient?.id, data: dataToSubmit });

    if (isEditMode) {
      updateMutation.mutate({ id: patient.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Patient' : 'Add New Patient'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.firstName
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.lastName
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.dateOfBirth
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                name="address"
                id="address"
                rows={2}
                value={formData.address}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Insurance Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Insurance Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="insuranceProvider" className="block text-sm font-medium text-gray-700">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  name="insuranceProvider"
                  id="insuranceProvider"
                  value={formData.insuranceProvider}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="insuranceId" className="block text-sm font-medium text-gray-700">
                  Insurance ID
                </label>
                <input
                  type="text"
                  name="insuranceId"
                  id="insuranceId"
                  value={formData.insuranceId}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Therapy Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Therapy Information</h3>
            <div>
              <label htmlFor="requiredWeeklyHours" className="block text-sm font-medium text-gray-700">
                Required Weekly Hours
              </label>
              <input
                type="number"
                name="requiredWeeklyHours"
                id="requiredWeeklyHours"
                min="0"
                step="0.5"
                value={formData.requiredWeeklyHours}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm sm:max-w-xs ${
                  errors.requiredWeeklyHours
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {errors.requiredWeeklyHours && (
                <p className="mt-1 text-sm text-red-600">{errors.requiredWeeklyHours}</p>
              )}
            </div>
          </div>

          {/* Team Assignment */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Team Assignment</h3>
            <div>
              <label htmlFor="teamId" className="block text-sm font-medium text-gray-700">
                Assigned Team
              </label>
              <select
                name="teamId"
                id="teamId"
                value={formData.teamId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm sm:max-w-xs"
              >
                <option value="">No team assigned</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} (Lead: {team.LeadBCBA?.firstName} {team.LeadBCBA?.lastName})
                  </option>
                ))}
              </select>
              {formData.teamId && teams.find(t => t.id === formData.teamId) && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Team color:</span>
                  <span 
                    className="inline-block w-4 h-4 rounded"
                    style={{ backgroundColor: teams.find(t => t.id === formData.teamId)?.color || '#6B7280' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Visual Preferences */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Visual Preferences</h3>
            <ColorPicker
              value={formData.color}
              onChange={handleColorChange}
              patientId={patient?.id}
              patientName={formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : ''}
            />
          </div>

          {/* Error message */}
          {errors.submit && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Form actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => console.log('Submit button clicked')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Patient' : 'Add Patient')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientForm;