import apiClient from './client';

// Get admin dashboard summary
export const getAdminDashboardSummary = async () => {
  const response = await apiClient.get('/admin/dashboard');
  return response.data;
};

// Get all users (with optional role filter)
export const getUsers = async (role, active) => {
  const response = await apiClient.get('/admin/users', {
    params: { role, active }
  });
  return response.data;
};

// Get a specific user by ID
export const getUserById = async (id) => {
  const response = await apiClient.get(`/admin/users/${id}`);
  return response.data;
};

// Create a new user
export const createUser = async (userData) => {
  const response = await apiClient.post('/admin/users', userData);
  return response.data;
};

// Update an existing user
export const updateUser = async (id, userData) => {
  const response = await apiClient.put(`/admin/users/${id}`, userData);
  return response.data;
};

// Delete/deactivate a user
export const deleteUser = async (id, deactivateOnly = true) => {
  const response = await apiClient.delete(`/admin/users/${id}`, {
    params: { deactivateOnly }
  });
  return response.data;
};

// Get all locations
export const getLocations = async (active) => {
  const response = await apiClient.get('/admin/locations', {
    params: { active }
  });
  return response.data;
};

// Create a new location
export const createLocation = async (locationData) => {
  const response = await apiClient.post('/admin/locations', locationData);
  return response.data;
};

// Update an existing location
export const updateLocation = async (id, locationData) => {
  const response = await apiClient.put(`/admin/locations/${id}`, locationData);
  return response.data;
};

// Delete/deactivate a location
export const deleteLocation = async (id, deactivateOnly = true) => {
  const response = await apiClient.delete(`/admin/locations/${id}`, {
    params: { deactivateOnly }
  });
  return response.data;
};