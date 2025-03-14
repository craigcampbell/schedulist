import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      data: config.data,
      baseURL: config.baseURL
    });
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response success:', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Response error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // If request returns 401 Unauthorized, redirect to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;