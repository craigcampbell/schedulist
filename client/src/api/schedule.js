import apiClient from './client';

// Get schedule with various filtering options
export const getSchedule = async (view = 'daily', date, locationId, therapistId) => {
  const response = await apiClient.get('/schedule', {
    params: {
      view,
      date,
      locationId,
      therapistId
    }
  });
  return response.data;
};

// Get a specific patient's schedule
export const getPatientSchedule = async (patientId, limit, includePast) => {
  const response = await apiClient.get(`/schedule/patient/${patientId}`, {
    params: {
      limit,
      includePast
    }
  });
  return response.data;
};

// Create a new appointment
export const createAppointment = async (appointmentData) => {
  const response = await apiClient.post('/schedule', appointmentData);
  return response.data;
};

// Update an existing appointment
export const updateAppointment = async (id, appointmentData) => {
  const response = await apiClient.put(`/schedule/${id}`, appointmentData);
  return response.data;
};

// Delete an appointment
export const deleteAppointment = async (id) => {
  const response = await apiClient.delete(`/schedule/${id}`);
  return response.data;
};

// Update appointment status (for therapists)
export const updateAppointmentStatus = async (id, status, notes) => {
  const response = await apiClient.put(`/therapist/appointments/${id}/status`, { 
    status, 
    notes 
  });
  return response.data;
};