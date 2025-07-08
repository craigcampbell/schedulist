import React, { useState } from 'react';
import { X, Send, Mail, Shield } from 'lucide-react';
import { Button } from './ui/button';

const InviteUserModal = ({ 
  isOpen, 
  onClose, 
  onInvite, 
  isSubmitting = false 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    role: ''
  });
  
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.role) {
      newErrors.role = 'Please select a user role';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onInvite(formData);
    }
  };

  const handleClose = () => {
    setFormData({ email: '', role: '' });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite User
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full rounded-md border ${errors.email ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800 px-3 py-2`}
              placeholder="user@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              An invitation email will be sent to this address
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              <Shield className="inline h-4 w-4 mr-1" />
              User Role <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className={`w-full rounded-md border ${errors.role ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800 px-3 py-2`}
              disabled={isSubmitting}
            >
              <option value="">Select a role</option>
              <option value="admin">Admin - Full system access</option>
              <option value="bcba">BCBA - Team and schedule management</option>
              <option value="therapist">Therapist - Patient care</option>
            </select>
            {errors.role && (
              <p className="text-red-500 text-sm mt-1">{errors.role}</p>
            )}
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
            <p className="text-blue-800 dark:text-blue-200">
              The invited user will receive an email with instructions to create their account and set up their password.
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;