import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash, Check, X, MapPin, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { getLocations, createLocation, updateLocation, deleteLocation } from '../../api/admin';
import { useModal } from '../../context/modal-context';

const AdminLocationsPage = () => {
  const modal = useModal();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    slotDuration: 30, // 30 or 60 minutes
    active: true
  });
  const [formError, setFormError] = useState(null);
  
  const queryClient = useQueryClient();
  
  // Fetch locations
  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['locations'],
    queryFn: () => getLocations(false) // Get all locations including inactive
  });
  
  // Debug logging
  console.log('Locations query result:', { locations, isLoading, error });
  console.log('Locations type:', typeof locations, 'Is Array:', Array.isArray(locations));
  
  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries(['locations']);
      resetForm();
    },
    onError: (error) => {
      setFormError(error.response?.data?.message || 'Failed to create location');
    }
  });
  
  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }) => updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['locations']);
      resetForm();
    },
    onError: (error) => {
      setFormError(error.response?.data?.message || 'Failed to update location');
    }
  });
  
  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: (id) => deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['locations']);
    },
    onError: async (error) => {
      console.error('Failed to delete location', error);
      await modal.alert(error.response?.data?.message || 'Failed to delete location', 'Error', 'error');
    }
  });
  
  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, data }) => updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['locations']);
    },
    onError: async (error) => {
      console.error('Failed to toggle active status', error);
      await modal.alert(error.response?.data?.message || 'Failed to update location status', 'Error', 'error');
    }
  });
  
  // Handle form submission for new/edit location
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate the form
    if (!formState.name) {
      setFormError('Location name is required');
      return;
    }
    
    if (!formState.address) {
      setFormError('Address is required');
      return;
    }
    
    if (!formState.city) {
      setFormError('City is required');
      return;
    }
    
    if (!formState.state) {
      setFormError('State is required');
      return;
    }
    
    if (!formState.zipCode) {
      setFormError('ZIP code is required');
      return;
    }
    
    setFormError(null);
    
    try {
      if (selectedLocation) {
        // Update existing location
        await updateLocationMutation.mutateAsync({ 
          id: selectedLocation.id, 
          data: formState 
        });
      } else {
        // Create new location
        await createLocationMutation.mutateAsync(formState);
      }
    } catch (error) {
      // Error is handled in the mutation callbacks
      console.error('Form submission error:', error);
    }
  };
  
  // Reset the form and close it
  const resetForm = () => {
    setFormState({
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
      slotDuration: 30,
      active: true
    });
    setFormError(null);
    setShowAddForm(false);
    setShowEditForm(false);
    setSelectedLocation(null);
  };
  
  // Handle edit button click
  const handleEdit = (location) => {
    setSelectedLocation(location);
    setFormState({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      phone: location.phone || '',
      workingHoursStart: location.workingHoursStart || '08:00',
      workingHoursEnd: location.workingHoursEnd || '17:00',
      slotDuration: location.slotDuration || 30,
      active: location.active
    });
    setShowEditForm(true);
  };
  
  // Handle delete button click
  const handleDelete = async (locationId) => {
    const location = locations?.find(loc => loc.id === locationId);
    const confirmed = await modal.confirmDelete(
      location?.name || 'this location',
      'Are you sure you want to delete this location? This action cannot be undone.'
    );
    
    if (confirmed) {
      try {
        await deleteLocationMutation.mutateAsync(locationId);
      } catch (error) {
        // Error is handled in the mutation callbacks
      }
    }
  };
  
  // Handle toggle active status
  const handleToggleActive = async (location) => {
    try {
      await toggleActiveMutation.mutateAsync({
        id: location.id,
        data: { 
          ...location,
          active: !location.active 
        }
      });
    } catch (error) {
      // Error is handled in the mutation callbacks
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Locations</h1>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>
      
      {/* Location List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <p className="text-red-600">Error loading locations: {error.message}</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">Loading locations...</p>
        </div>
      ) : (Array.isArray(locations) ? locations : locations?.data || locations?.locations || [])?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(locations) ? locations : locations?.data || locations?.locations || []).map(location => (
            <div 
              key={location.id} 
              className={`bg-white p-6 rounded-lg shadow ${!location.active ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold">{location.name}</h2>
                <div className="flex space-x-2">
                  <button
                    className="text-blue-500 hover:text-blue-700"
                    onClick={() => handleEdit(location)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(location.id)}
                    title="Delete"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{location.address}</p>
                    <p>{location.city}, {location.state} {location.zipCode}</p>
                  </div>
                </div>
                
                {location.phone && (
                  <p>{location.phone}</p>
                )}
                
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>
                    Hours: {location.workingHoursStart || '08:00'} - {location.workingHoursEnd || '17:00'}
                  </span>
                </div>
                
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>
                    Slot duration: {location.slotDuration || 30} minutes
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${location.active ? 'text-green-600' : 'text-red-600'}`}>
                    {location.active ? 'Active' : 'Inactive'}
                  </span>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleActive(location)}
                  >
                    {location.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">No locations found.</p>
        </div>
      )}
      
      {/* Add Location Form */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Add New Location</h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  value={formState.name}
                  onChange={(e) => setFormState({...formState, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  value={formState.address}
                  onChange={(e) => setFormState({...formState, address: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.city}
                    onChange={(e) => setFormState({...formState, city: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.state}
                    onChange={(e) => setFormState({...formState, state: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.zipCode}
                    onChange={(e) => setFormState({...formState, zipCode: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.phone}
                    onChange={(e) => setFormState({...formState, phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium mb-2">Working Hours</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1">Start Time</label>
                    <input
                      type="time"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={formState.workingHoursStart}
                      onChange={(e) => setFormState({...formState, workingHoursStart: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs mb-1">End Time</label>
                    <input
                      type="time"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={formState.workingHoursEnd}
                      onChange={(e) => setFormState({...formState, workingHoursEnd: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Appointment Slot Duration</label>
                  <select
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.slotDuration}
                    onChange={(e) => setFormState({...formState, slotDuration: parseInt(e.target.value)})}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This determines the time slot intervals in the schedule view
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  className="mr-2"
                  checked={formState.active}
                  onChange={(e) => setFormState({...formState, active: e.target.checked})}
                />
                <label htmlFor="active" className="text-sm">Active</label>
              </div>
              
              {formError && (
                <div className="p-2 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md">
                  <p className="text-sm">{formError}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" type="button" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Location
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Location Form */}
      {showEditForm && selectedLocation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Edit Location</h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  value={formState.name}
                  onChange={(e) => setFormState({...formState, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  value={formState.address}
                  onChange={(e) => setFormState({...formState, address: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.city}
                    onChange={(e) => setFormState({...formState, city: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.state}
                    onChange={(e) => setFormState({...formState, state: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.zipCode}
                    onChange={(e) => setFormState({...formState, zipCode: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.phone}
                    onChange={(e) => setFormState({...formState, phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium mb-2">Working Hours</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1">Start Time</label>
                    <input
                      type="time"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={formState.workingHoursStart}
                      onChange={(e) => setFormState({...formState, workingHoursStart: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs mb-1">End Time</label>
                    <input
                      type="time"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      value={formState.workingHoursEnd}
                      onChange={(e) => setFormState({...formState, workingHoursEnd: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Appointment Slot Duration</label>
                  <select
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                    value={formState.slotDuration}
                    onChange={(e) => setFormState({...formState, slotDuration: parseInt(e.target.value)})}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This determines the time slot intervals in the schedule view
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active-edit"
                  className="mr-2"
                  checked={formState.active}
                  onChange={(e) => setFormState({...formState, active: e.target.checked})}
                />
                <label htmlFor="active-edit" className="text-sm">Active</label>
              </div>
              
              {formError && (
                <div className="p-2 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-md">
                  <p className="text-sm">{formError}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" type="button" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update Location
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLocationsPage;