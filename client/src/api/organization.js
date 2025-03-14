import apiClient from './client';

// Create a new organization
export const createOrganization = async (organizationData) => {
  const response = await apiClient.post('/organization', organizationData);
  return response.data;
};

// Get organization details
export const getOrganizationDetails = async () => {
  const response = await apiClient.get('/organization/details');
  return response.data;
};

// Update organization details
export const updateOrganization = async (updateData) => {
  const response = await apiClient.put('/organization', updateData);
  return response.data;
};

// Update subscription
export const updateSubscription = async (subscriptionData) => {
  const response = await apiClient.put('/organization/subscription', subscriptionData);
  return response.data;
};

// Upload organization logo
export const uploadLogo = async (logoFile) => {
  const formData = new FormData();
  formData.append('logo', logoFile);
  
  const response = await apiClient.post('/organization/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};

// Get organization by slug
export const getOrganizationBySlug = async (slug) => {
  const response = await apiClient.get(`/organization/by-slug/${slug}`);
  return response.data;
};