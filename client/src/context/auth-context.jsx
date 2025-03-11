import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, getProfile, logoutUser } from '../api/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if user is already logged in (token in localStorage)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await getProfile();
          setUser(userData);
        } catch (err) {
          console.error('Failed to validate token:', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.token);
      setUser(data.user);
      
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
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
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

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAdmin,
    isBCBA,
    isTherapist,
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