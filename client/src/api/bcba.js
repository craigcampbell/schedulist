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

// Get all available therapists in the organization for assignment
export const getAvailableTherapists = async () => {
  const response = await apiClient.get('/bcba/available-therapists');
  return response.data;
};

// Get all available BCBAs in the organization for assignment
export const getAvailableBCBAs = async () => {
  const response = await apiClient.get('/bcba/available-bcbas');
  return response.data;
};

// Get patients with their assignments (BCBAs and therapists)
export const getPatientsWithAssignments = async () => {
  try {
    const response = await apiClient.get('/bcba/patients-with-assignments');
    return response.data;
  } catch (error) {
    console.error('Error fetching patients with assignments:', error);
    // Return empty array instead of throwing
    if (error.response && error.response.status === 401) {
      // If unauthorized, let the auth interceptor handle redirect
      throw error;
    }
    return [];
  }
};

// Set primary BCBA for a patient
export const setPrimaryBCBA = async (patientId, bcbaId) => {
  const response = await apiClient.post('/bcba/set-primary-bcba', { patientId, bcbaId });
  return response.data;
};

// Update therapist assignment (assign or unassign)
export const updateTherapistAssignment = async (patientId, therapistId, action) => {
  const response = await apiClient.post('/bcba/update-therapist-assignment', { 
    patientId, 
    therapistId, 
    action // 'assign' or 'unassign'
  });
  return response.data;
};

// Update BCBA assignment (assign or unassign)
export const updateBCBAAssignment = async (patientId, bcbaId, action) => {
  const response = await apiClient.post('/bcba/update-bcba-assignment', { 
    patientId, 
    bcbaId, 
    action // 'assign' or 'unassign'
  });
  return response.data;
};

export const getUnassignedPatients = async () => {
  const response = await apiClient.get('/bcba/unassigned-patients');
  return response.data;
};