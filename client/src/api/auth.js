import apiClient from './client';

export const loginUser = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

export const getProfile = async () => {
  const response = await apiClient.get('/auth/profile');
  return response.data.user;
};

export const updateProfile = async (userData) => {
  const response = await apiClient.put('/auth/profile', userData);
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, newPassword) => {
  const response = await apiClient.post('/auth/reset-password', { token, newPassword });
  return response.data;
};