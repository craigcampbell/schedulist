import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, Settings, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { getLocationTimeSlots, generateTimeSlots } from '../../utils/location-time-slots';

/**
 * Demo component showing how location-specific time slots work
 * This demonstrates the flexibility of the new system
 */
export default function LocationTimeSlotDemo() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  // Example locations with different working hours
  const exampleLocations = [
    {
      id: '1',
      name: 'Main Clinic',
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
      address: '123 Main St'
    },
    {
      id: '2', 
      name: 'Early Bird Center',
      workingHoursStart: '06:30',
      workingHoursEnd: '15:30',
      address: '456 Early Ave'
    },
    {
      id: '3',
      name: 'Evening Clinic',
      workingHoursStart: '12:00',
      workingHoursEnd: '20:00',
      address: '789 Evening Blvd'
    },
    {
      id: '4',
      name: 'Weekend Center',
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      address: '321 Weekend Way'
    }
  ];

  // Get time slots for the selected location
  const { timeSlots: excelSlots, timeSlotRanges: excelRanges } = useMemo(() => {
    return getLocationTimeSlots(selectedLocation, 'excel');
  }, [selectedLocation]);

  const { timeSlots: rangeSlots, timeSlotRanges: rangeRanges } = useMemo(() => {
    return getLocationTimeSlots(selectedLocation, 'range');
  }, [selectedLocation]);

  const { timeSlots: simpleSlots, timeSlotRanges: simpleRanges } = useMemo(() => {
    return getLocationTimeSlots(selectedLocation, 'simple');
  }, [selectedLocation]);

  // Configuration form state
  const [configForm, setConfigForm] = useState({
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    slotDuration: 30
  });

  const handleConfigChange = (field, value) => {
    setConfigForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveConfig = () => {
    setSelectedLocation(prev => ({
      ...prev,
      ...configForm
    }));
    setShowConfig(false);
  };

  // Generate custom time slots based on config
  const customSlots = useMemo(() => {
    if (!showConfig) return [];
    
    const customLocation = {
      workingHoursStart: configForm.workingHoursStart,
      workingHoursEnd: configForm.workingHoursEnd
    };
    
    return generateTimeSlots(customLocation, configForm.slotDuration, 'excel');
  }, [configForm, showConfig]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Location-Specific Time Slots Demo
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          See how different locations can have different working hours and time slots
        </p>
      </div>

      {/* Location Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          Select Location
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {exampleLocations.map(location => (
            <div
              key={location.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedLocation?.id === location.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => setSelectedLocation(location)}
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {location.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {location.address}
              </p>
              <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4 mr-1" />
                {location.workingHoursStart} - {location.workingHoursEnd}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowConfig(true)}
            className="flex items-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Custom Hours
          </Button>
        </div>
      </div>

      {/* Custom Configuration */}
      {showConfig && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Custom Configuration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={configForm.workingHoursStart}
                onChange={(e) => handleConfigChange('workingHoursStart', e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={configForm.workingHoursEnd}
                onChange={(e) => handleConfigChange('workingHoursEnd', e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slot Duration (minutes)
              </label>
              <select
                value={configForm.slotDuration}
                onChange={(e) => handleConfigChange('slotDuration', parseInt(e.target.value))}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveConfig}>
              Apply Configuration
            </Button>
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Cancel
            </Button>
          </div>

          {customSlots.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Preview: Custom Time Slots
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {customSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="p-2 text-xs bg-gray-100 dark:bg-gray-700 rounded text-center"
                  >
                    {slot}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Slot Display */}
      {selectedLocation && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Time Slots for {selectedLocation.name}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Excel Format */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Excel Format (7:30 AM)
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {excelSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-center"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </div>

              {/* Range Format */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Range Format (7:30-8:00 AM)
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {rangeSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-2 text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-center"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </div>

              {/* Simple Format */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Simple Format (7:30-8:00)
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {simpleSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="p-2 text-xs bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded text-center"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Location Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Working Hours:</span>
                  <span className="ml-2 font-medium">
                    {selectedLocation.workingHoursStart} - {selectedLocation.workingHoursEnd}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Slots:</span>
                  <span className="ml-2 font-medium">{excelSlots.length}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Address:</span>
                  <span className="ml-2 font-medium">{selectedLocation.address}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Slot Duration:</span>
                  <span className="ml-2 font-medium">30 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Benefits Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Benefits of Location-Specific Time Slots
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              For Administrators
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Configure different working hours per location</li>
              <li>• Set custom slot durations (15, 30, 45, 60 minutes)</li>
              <li>• Manage multiple locations with different schedules</li>
              <li>• Easy to update working hours without code changes</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              For Users
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• See accurate time slots for their specific location</li>
              <li>• Schedule appointments within actual working hours</li>
              <li>• Consistent experience across all schedule views</li>
              <li>• Automatic fallback to default times if needed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 