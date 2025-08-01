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
      url: response.config.url,
      method: response.config.method,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Response error:', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Handle network errors or server not available
    if (!error.response) {
      console.error('Network error - no response from server');
      error.response = { 
        data: { 
          message: 'Unable to connect to server. Please check your network connection or try again later.' 
        } 
      };
    } else {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data,
        stack: error.response.data?.stack // Log stack trace if available
      });
      
      // Display detailed error in development
      if (process.env.NODE_ENV !== 'production') {
        // Add debugging information to the error object
        error.debug = {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        };
      }
    }
    
    // Authentication errors
    if (error.response && error.response.status === 401) {
      console.warn('Authentication error - token may be invalid or expired');
      
      // Only redirect to login if not already on login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        // Use navigate instead of direct window.location to prevent reload
        if (window.history) {
          window.history.pushState({}, '', '/login');
        } else {
          window.location.href = '/login';
        }
      }
    }
    
    // Authorization errors
    if (error.response && error.response.status === 403) {
      console.warn('Authorization error - user does not have necessary permissions');
      // You might want to redirect to a "not authorized" page
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;