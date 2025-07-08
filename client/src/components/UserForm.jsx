import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Save, User, Mail, Phone, MapPin, Building, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { getLocations } from '../api/admin';

const UserForm = ({ 
  user = null, 
  onSubmit, 
  onCancel, 
  isSubmitting = false 
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    roles: [],
    locationIds: [],
    active: true,
    defaultLocationId: '',
    ...user // Override with existing user data if editing
  });

  const [errors, setErrors] = useState({});

  // Fetch locations for multi-select
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => getLocations(true)
  });

  useEffect(() => {
    if (user) {
      setFormData({
        ...user,
        password: '', // Don't populate password for existing users
        roles: user.roles || [],
        locationIds: user.locationIds || [],
        defaultLocationId: user.defaultLocationId || ''
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleToggle = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleLocationToggle = (locationId) => {
    setFormData(prev => {
      const newLocationIds = prev.locationIds.includes(locationId)
        ? prev.locationIds.filter(id => id !== locationId)
        : [...prev.locationIds, locationId];
      
      // If removing the default location, clear it
      if (!newLocationIds.includes(prev.defaultLocationId)) {
        return {
          ...prev,
          locationIds: newLocationIds,
          defaultLocationId: ''
        };
      }
      
      return {
        ...prev,
        locationIds: newLocationIds
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (formData.roles.length === 0) {
      newErrors.roles = 'At least one role is required';
    }
    
    if (formData.locationIds.length === 0) {
      newErrors.locationIds = 'At least one location is required';
    }
    
    if (!user && !formData.password) {
      newErrors.password = 'Password is required for new users';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={`w-full rounded-md border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800`}
              placeholder="John"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`w-full rounded-md border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800`}
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              <Mail className="inline h-4 w-4 mr-1" />
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full rounded-md border ${errors.email ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800`}
              placeholder="john.doe@example.com"
              disabled={user !== null} // Don't allow email changes for existing users
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              <Phone className="inline h-4 w-4 mr-1" />
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Password {!user && <span className="text-red-500">*</span>}
            {user && <span className="text-sm font-normal text-gray-500 ml-2">(leave blank to keep current)</span>}
          </label>
          <input
            type="password"
            name="password"
            value={formData.password || ''}
            onChange={handleInputChange}
            className={`w-full rounded-md border ${errors.password ? 'border-red-500' : 'border-gray-300'} dark:border-gray-700 dark:bg-gray-800`}
            placeholder={user ? "Enter new password to change" : "Minimum 6 characters"}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password}</p>
          )}
        </div>
      </div>
      
      {/* Roles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          User Roles <span className="text-red-500">*</span>
        </h3>
        
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.roles.includes('admin')}
              onChange={() => handleRoleToggle('admin')}
              className="h-4 w-4 rounded"
            />
            <div>
              <span className="font-medium">Admin</span>
              <p className="text-sm text-gray-500">Full system access and user management</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.roles.includes('bcba')}
              onChange={() => handleRoleToggle('bcba')}
              className="h-4 w-4 rounded"
            />
            <div>
              <span className="font-medium">BCBA</span>
              <p className="text-sm text-gray-500">Board Certified Behavior Analyst - manages teams and schedules</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.roles.includes('therapist')}
              onChange={() => handleRoleToggle('therapist')}
              className="h-4 w-4 rounded"
            />
            <div>
              <span className="font-medium">Therapist</span>
              <p className="text-sm text-gray-500">ABA Therapist - provides direct patient care</p>
            </div>
          </label>
        </div>
        
        {errors.roles && (
          <p className="text-red-500 text-sm">{errors.roles}</p>
        )}
      </div>
      
      {/* Locations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building className="h-5 w-5" />
          Location Access <span className="text-red-500">*</span>
        </h3>
        
        <div className="space-y-2">
          {locations.map(location => (
            <label key={location.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.locationIds.includes(location.id)}
                onChange={() => handleLocationToggle(location.id)}
                className="h-4 w-4 rounded"
              />
              <div className="flex-1">
                <span className="font-medium">{location.name}</span>
                <p className="text-sm text-gray-500">{location.address}</p>
              </div>
              {formData.locationIds.includes(location.id) && (
                <select
                  value={formData.defaultLocationId === location.id ? location.id : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    defaultLocationId: e.target.value || null 
                  }))}
                  className="text-sm rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Not default</option>
                  <option value={location.id}>Default location</option>
                </select>
              )}
            </label>
          ))}
        </div>
        
        {errors.locationIds && (
          <p className="text-red-500 text-sm">{errors.locationIds}</p>
        )}
      </div>
      
      {/* Status */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          name="active"
          id="active"
          checked={formData.active}
          onChange={handleInputChange}
          className="h-4 w-4 rounded"
        />
        <label htmlFor="active" className="font-medium">
          Active User
        </label>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Saving...' : (user ? 'Update User' : 'Create User')}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;