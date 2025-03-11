import apiClient from './client';

// Get BCBA dashboard summary
export const getBCBADashboardSummary = async () => {
  const response = await apiClient.get('/bcba/dashboard');
  return response.data;
};

// Get therapists managed by this BCBA
export const getTherapists = async () => {
  const response = await apiClient.get('/bcba/therapists');
  return response.data;
};

// Add a new therapist
export const addTherapist = async (therapistData) => {
  const response = await apiClient.post('/bcba/therapists', therapistData);
  return response.data;
};

// Update a therapist
export const updateTherapist = async (id, therapistData) => {
  const response = await apiClient.put(`/bcba/therapists/${id}`, therapistData);
  return response.data;
};

// Assign patients to a therapist
export const assignPatients = async (therapistId, patientIds) => {
  const response = await apiClient.post(`/bcba/therapists/${therapistId}/patients`, { patientIds });
  return response.data;
};