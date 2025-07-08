import apiClient from './client';

// Get all patients (filtered by user role and query params)
export const getPatients = async (status) => {
  const response = await apiClient.get('/patient', {
    params: { status }
  });
  return response.data;
};

// Get a specific patient by ID
export const getPatientById = async (id) => {
  const response = await apiClient.get(`/patient/${id}`);
  return response.data;
};

// Create a new patient
export const createPatient = async (patientData) => {
  const response = await apiClient.post('/patient', patientData);
  return response.data;
};

// Update an existing patient
export const updatePatient = async (id, patientData) => {
  const response = await apiClient.put(`/patient/${id}`, patientData);
  return response.data;
};

// Delete/deactivate a patient
export const deletePatient = async (id) => {
  const response = await apiClient.delete(`/patient/${id}`);
  return response.data;
};

// Get patient notes
export const getPatientNotes = async (id, limit, offset, noteType) => {
  const response = await apiClient.get(`/patient/${id}/notes`, {
    params: { limit, offset, noteType }
  });
  return response.data;
};

// Create a patient note
export const createPatientNote = async (id, noteData) => {
  const response = await apiClient.post(`/patient/${id}/notes`, noteData);
  return response.data;
};

// For therapists
export const getAssignedPatients = async (status) => {
  const response = await apiClient.get('/therapist/patients', {
    params: { status }
  });
  return response.data;
};

// Check if a color is already in use
export const checkColorDuplicate = async (color, excludePatientId) => {
  const response = await apiClient.get('/patient/check-color', {
    params: { color, excludePatientId }
  });
  return response.data;
};