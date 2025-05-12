import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser, getProfile, logoutUser } from '../api/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [organizationInfo, setOrganizationInfo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already logged in (token in localStorage)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await getProfile();
          setUser(userData);
          
          // Set organization info if available
          if (userData.organization) {
            setOrganizationInfo(userData.organization);
            
            // Check for subdomain navigation if needed
            if (userData.organization.slug) {
              const host = window.location.host;
              const isProduction = !host.includes('localhost');
              
              if (isProduction && !host.startsWith(`${userData.organization.slug}.`)) {
                // Extract domain from current host
                const parts = host.split('.');
                const domain = parts.length > 1 ? parts.slice(1).join('.') : host;
                
                // Redirect to tenant subdomain
                const targetHost = `${userData.organization.slug}.${domain}`;
                window.location.href = `${window.location.protocol}//${targetHost}${location.pathname}`;
                return;
              }
            }
          }
        } catch (err) {
          console.error('Failed to validate token:', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [location]);

  const login = async (email, password, organizationSlug = null) => {
    setLoading(true);
    setError(null);
    setSubscriptionRequired(false);
    
    console.log('Auth context login called with:', { email, password, organizationSlug });
    
    try {
      console.log('Making API request to /auth/login');
      const data = await loginUser(email, password, organizationSlug);
      console.log('Login response:', data);
      
      localStorage.setItem('token', data.token);
      setUser(data.user);
      
      // Set organization info if available
      if (data.user.organization) {
        setOrganizationInfo(data.user.organization);
      }
      
      // Check if need to redirect to tenant subdomain
      if (data.user.organization?.slug) {
        const host = window.location.host;
        const isProduction = !host.includes('localhost');
        
        if (isProduction && !host.startsWith(`${data.user.organization.slug}.`)) {
          // Extract domain from current host
          const parts = host.split('.');
          const domain = parts.length > 1 ? parts.slice(1).join('.') : host;
          
          // Redirect to tenant subdomain with proper path
          const targetHost = `${data.user.organization.slug}.${domain}`;
          window.location.href = `${window.location.protocol}//${targetHost}`;
          return data;
        }
      }
      
      // Redirect based on role
      if (data.user.roles.includes('admin')) {
        navigate('/admin/dashboard');
      } else if (data.user.roles.includes('bcba')) {
        navigate('/bcba/dashboard');
      } else {
        navigate('/therapist/schedule');
      }
      
      return data;
    } catch (err) {
      console.error('Login error in auth context:', err);
      
      // Handle subscription required error
      if (err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setSubscriptionRequired(true);
        setOrganizationInfo({
          id: err.response.data.organizationId,
          name: err.response.data.organizationName
        });
      }
      
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setOrganizationInfo(null);
    setSubscriptionRequired(false);
    
    // If on a subdomain, redirect to main domain
    const host = window.location.host;
    if (host.includes('.') && !host.startsWith('www.') && !host.includes('localhost')) {
      const parts = host.split('.');
      const domain = parts.length > 1 ? parts.slice(1).join('.') : host;
      window.location.href = `${window.location.protocol}//${domain}/login`;
    } else {
      navigate('/login');
    }
  };

  const isAdmin = () => {
    return user?.roles?.includes('admin') || false;
  };

  const isBCBA = () => {
    return user?.roles?.includes('bcba') || isAdmin() || false;
  };

  const isTherapist = () => {
    return user?.roles?.includes('therapist') || isBCBA() || false;
  };

  const isSuperAdmin = () => {
    return user?.isSuperAdmin || false;
  };
  
  const hasActiveSubscription = () => {
    return user?.organization?.subscriptionActive || isAdmin() || isSuperAdmin() || false;
  };
  
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAdmin,
    isBCBA,
    isTherapist,
    isSuperAdmin,
    hasActiveSubscription,
    subscriptionRequired,
    organizationInfo
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};