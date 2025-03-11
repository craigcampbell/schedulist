import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/auth-context';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

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

// Common Pages
import ProfilePage from './pages/common/ProfilePage';
import NotFoundPage from './pages/common/NotFoundPage';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
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
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      
      {/* Dashboard Routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        {/* Therapist Routes */}
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
        
        {/* BCBA Routes */}
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
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminUsersPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/users/:id" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminUserDetailsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/locations" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminLocationsPage />
          </ProtectedRoute>
        } />
        
        {/* Common Routes */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      
      {/* Redirect root to appropriate dashboard based on role */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* 404 Route */}
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