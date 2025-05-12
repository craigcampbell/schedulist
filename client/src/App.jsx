import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/auth-context';
import SignupDefault from './pages/signup/default';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import OrganizationSignupPage from './pages/auth/OrganizationSignupPage';

// Therapist Pages
import TherapistSchedulePage from './pages/therapist/SchedulePage';
import TherapistPatientsPage from './pages/therapist/PatientsPage';
import TherapistPatientDetailsPage from './pages/therapist/PatientDetailsPage';

// BCBA Pages
import BCBADashboardPage from './pages/bcba/DashboardPage';
import BCBASchedulePage from './pages/bcba/SchedulePage';
import BCBAPatientsPage from './pages/bcba/PatientsPage';
import BCBAPatientDetailsPage from './pages/bcba/PatientDetailsPage';
import BCBATherapistsPage from './pages/bcba/TherapistsPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/DashboardPage';
import AdminUsersPage from './pages/admin/UsersPage';
import AdminUserDetailsPage from './pages/admin/UserDetailsPage';
import AdminLocationsPage from './pages/admin/LocationsPage';
import SubscriptionPage from './pages/admin/SubscriptionPage';

// Common Pages
import ProfilePage from './pages/common/ProfilePage';
import NotFoundPage from './pages/common/NotFoundPage';
import SubscriptionRequiredPage from './pages/SubscriptionRequiredPage';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRoles = [], requireSubscription = true }) => {
  const { user, loading, hasActiveSubscription, subscriptionRequired } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check subscription if required
  if (requireSubscription && !hasActiveSubscription() && !user.roles.includes('admin')) {
    return <Navigate to="/subscription-required" replace />;
  }
  
  // If specific roles are required, check if user has any of them
  if (requiredRoles.length > 0) {
    const hasRequiredRole = user.roles.some(role => requiredRoles.includes(role));
    const isAdmin = user.roles.includes('admin');
    
    // Allow access if user has a required role or is an admin
    if (!hasRequiredRole && !isAdmin) {
      // Redirect to appropriate dashboard based on user's highest role
      if (user.roles.includes('bcba')) {
        return <Navigate to="/bcba/dashboard" replace />;
      } else {
        return <Navigate to="/therapist/schedule" replace />;
      }
    }
  }
  
  return children;
};

// Main App Component with Router
function AppRoutes() {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user && !loading;

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/" 
        element={
          isAuthenticated 
            ? (user?.roles.includes('admin') 
                ? <Navigate to="/admin/dashboard" /> 
                : user?.roles.includes('bcba') 
                    ? <Navigate to="/bcba/dashboard" /> 
                    : <Navigate to="/therapist/schedule" />)
            : <SignupDefault />
        } 
      />
      
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<OrganizationSignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/subscription-required" element={<SubscriptionRequiredPage />} />
      </Route>
      
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/therapist/schedule" element={
          <ProtectedRoute requiredRoles={['therapist', 'bcba']}>
            <TherapistSchedulePage />
          </ProtectedRoute>
        } />
        <Route path="/therapist/patients" element={
          <ProtectedRoute requiredRoles={['therapist', 'bcba']}>
            <TherapistPatientsPage />
          </ProtectedRoute>
        } />
        <Route path="/therapist/patients/:id" element={
          <ProtectedRoute requiredRoles={['therapist', 'bcba']}>
            <TherapistPatientDetailsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/bcba/dashboard" element={
          <ProtectedRoute requiredRoles={['bcba']}>
            <BCBADashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/bcba/schedule" element={
          <ProtectedRoute requiredRoles={['bcba']}>
            <BCBASchedulePage />
          </ProtectedRoute>
        } />
        <Route path="/bcba/patients" element={
          <ProtectedRoute requiredRoles={['bcba']}>
            <BCBAPatientsPage />
          </ProtectedRoute>
        } />
        <Route path="/bcba/patients/:id" element={
          <ProtectedRoute requiredRoles={['bcba']}>
            <BCBAPatientDetailsPage />
          </ProtectedRoute>
        } />
        <Route path="/bcba/therapists" element={
          <ProtectedRoute requiredRoles={['bcba']}>
            <BCBATherapistsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRoles={['admin']} requireSubscription={false}>
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute requiredRoles={['admin']} requireSubscription={false}>
            <AdminUsersPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/users/:id" element={
          <ProtectedRoute requiredRoles={['admin']} requireSubscription={false}>
            <AdminUserDetailsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/locations" element={
          <ProtectedRoute requiredRoles={['admin']} requireSubscription={false}>
            <AdminLocationsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/subscription" element={
          <ProtectedRoute requiredRoles={['admin']} requireSubscription={false}>
            <SubscriptionPage />
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute requireSubscription={false}>
            <ProfilePage />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}