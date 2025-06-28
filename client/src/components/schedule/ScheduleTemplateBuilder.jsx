import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Save, 
  Copy,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { patientSchedulingAPI } from '../../api/patientScheduling';

const ScheduleTemplateBuilder = ({ 
  patientId, 
  onSave, 
  existingTemplate = null 
}) => {
  const [templateData, setTemplateData] = useState({
    name: '',
    description: '',
    effectiveStartDate: '',
    effectiveEndDate: '',
    locationId: '',
    weeklySchedule: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    },
    preferences: {
      preferredTherapistIds: [],
      excludedTherapistIds: []
    },
    settings: {
      allowSplitSessions: true,
      minimumSessionDuration: 30,
      maximumSessionDuration: 240,
      preferredSessionDuration: 60,
      generateWeeksInAdvance: 4,
      autoAssignTherapists: true
    }
  });

  const [locations, setLocations] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const dayNames = [
    'monday', 'tuesday', 'wednesday', 'thursday', 
    'friday', 'saturday', 'sunday'
  ];

  const serviceTypes = [
    { value: 'direct', label: 'Direct Service' },
    { value: 'indirect', label: 'Indirect Service' },
    { value: 'supervision', label: 'Supervision' }
  ];

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load locations and therapists (you'll need to implement these APIs)
        // const locationsData = await api.getLocations();
        // const therapistsData = await api.getTherapists();
        // setLocations(locationsData);
        // setTherapists(therapistsData);

        // If editing existing template, populate data
        if (existingTemplate) {
          setTemplateData({
            ...templateData,
            ...existingTemplate,
            weeklySchedule: {
              monday: existingTemplate.mondaySchedule || [],
              tuesday: existingTemplate.tuesdaySchedule || [],
              wednesday: existingTemplate.wednesdaySchedule || [],
              thursday: existingTemplate.thursdaySchedule || [],
              friday: existingTemplate.fridaySchedule || [],
              saturday: existingTemplate.saturdaySchedule || [],
              sunday: existingTemplate.sundaySchedule || []
            }
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [existingTemplate]);

  // Add time block to a day
  const addTimeBlock = (day) => {
    const newBlock = {
      id: Date.now(), // Temporary ID
      startTime: '09:00',
      endTime: '10:00',
      serviceType: 'direct',
      duration: 60
    };

    setTemplateData(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: [...prev.weeklySchedule[day], newBlock]
      }
    }));
  };

  // Remove time block from a day
  const removeTimeBlock = (day, blockIndex) => {
    setTemplateData(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].filter((_, index) => index !== blockIndex)
      }
    }));
  };

  // Update time block
  const updateTimeBlock = (day, blockIndex, field, value) => {
    setTemplateData(prev => {
      const updatedSchedule = { ...prev.weeklySchedule };
      const updatedBlock = { ...updatedSchedule[day][blockIndex] };
      
      updatedBlock[field] = value;
      
      // Recalculate duration if start or end time changed
      if (field === 'startTime' || field === 'endTime') {
        const start = new Date(`2000-01-01 ${updatedBlock.startTime}`);
        const end = new Date(`2000-01-01 ${updatedBlock.endTime}`);
        updatedBlock.duration = (end - start) / (1000 * 60);
      }
      
      updatedSchedule[day][blockIndex] = updatedBlock;
      
      return {
        ...prev,
        weeklySchedule: updatedSchedule
      };
    });
  };

  // Copy schedule from one day to another
  const copyDaySchedule = (fromDay, toDay) => {
    setTemplateData(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [toDay]: [...prev.weeklySchedule[fromDay]]
      }
    }));
  };

  // Validate template data
  const validateTemplate = () => {
    const errors = [];
    
    if (!templateData.name.trim()) {
      errors.push('Template name is required');
    }
    
    if (!templateData.effectiveStartDate) {
      errors.push('Effective start date is required');
    }
    
    if (!templateData.locationId) {
      errors.push('Location is required');
    }

    // Check for overlapping time blocks
    dayNames.forEach(day => {
      const daySchedule = templateData.weeklySchedule[day];
      for (let i = 0; i < daySchedule.length - 1; i++) {
        for (let j = i + 1; j < daySchedule.length; j++) {
          const block1 = daySchedule[i];
          const block2 = daySchedule[j];
          
          const start1 = new Date(`2000-01-01 ${block1.startTime}`);
          const end1 = new Date(`2000-01-01 ${block1.endTime}`);
          const start2 = new Date(`2000-01-01 ${block2.startTime}`);
          const end2 = new Date(`2000-01-01 ${block2.endTime}`);
          
          if (start1 < end2 && end1 > start2) {
            errors.push(`Overlapping time blocks on ${day}: ${block1.startTime}-${block1.endTime} and ${block2.startTime}-${block2.endTime}`);
          }
        }
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Calculate total weekly hours
  const calculateTotalHours = () => {
    let totalMinutes = 0;
    
    dayNames.forEach(day => {
      templateData.weeklySchedule[day].forEach(block => {
        totalMinutes += block.duration || 0;
      });
    });
    
    return totalMinutes / 60;
  };

  // Save template
  const handleSave = async () => {
    if (!validateTemplate()) {
      return;
    }

    setSaving(true);
    try {
      const result = await patientSchedulingAPI.createScheduleTemplate({
        ...templateData,
        patientId
      });
      
      onSave?.(result);
    } catch (error) {
      console.error('Error saving template:', error);
      setValidationErrors(['Failed to save template. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {existingTemplate ? 'Edit' : 'Create'} Schedule Template
        </h2>
        <p className="text-gray-600">
          Define the weekly schedule pattern for this patient.
        </p>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Name *
          </label>
          <input
            type="text"
            value={templateData.name}
            onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., School Year Schedule"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <select
            value={templateData.locationId}
            onChange={(e) => setTemplateData(prev => ({ ...prev, locationId: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select location...</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Effective Start Date *
          </label>
          <input
            type="date"
            value={templateData.effectiveStartDate}
            onChange={(e) => setTemplateData(prev => ({ ...prev, effectiveStartDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Effective End Date
          </label>
          <input
            type="date"
            value={templateData.effectiveEndDate}
            onChange={(e) => setTemplateData(prev => ({ ...prev, effectiveEndDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={templateData.description}
          onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description of this schedule template..."
        />
      </div>

      {/* Weekly Schedule */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Weekly Schedule</h3>
          <div className="text-sm text-gray-600">
            Total: <span className="font-medium">{calculateTotalHours().toFixed(1)} hours/week</span>
          </div>
        </div>

        <div className="space-y-6">
          {dayNames.map(day => (
            <div key={day} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 capitalize">{day}</h4>
                <div className="flex items-center space-x-2">
                  {dayNames.filter(d => d !== day).map(otherDay => (
                    <button
                      key={otherDay}
                      onClick={() => copyDaySchedule(day, otherDay)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      title={`Copy to ${otherDay}`}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {otherDay.slice(0, 3)}
                    </button>
                  ))}
                  <button
                    onClick={() => addTimeBlock(day)}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Block
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {templateData.weeklySchedule[day].map((block, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-md">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <input
                        type="time"
                        value={block.startTime}
                        onChange={(e) => updateTimeBlock(day, index, 'startTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={block.endTime}
                        onChange={(e) => updateTimeBlock(day, index, 'endTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>

                    <select
                      value={block.serviceType}
                      onChange={(e) => updateTimeBlock(day, index, 'serviceType', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {serviceTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>

                    <span className="text-sm text-gray-600 min-w-[60px]">
                      {block.duration}m
                    </span>

                    <button
                      onClick={() => removeTimeBlock(day, index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {templateData.weeklySchedule[day].length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm italic">
                    No time blocks scheduled for {day}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={templateData.settings.allowSplitSessions}
                onChange={(e) => setTemplateData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, allowSplitSessions: e.target.checked }
                }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Allow split sessions (multiple therapists per day)</span>
            </label>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={templateData.settings.autoAssignTherapists}
                onChange={(e) => setTemplateData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, autoAssignTherapists: e.target.checked }
                }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Auto-assign therapists based on preferences</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred session duration (minutes)
            </label>
            <input
              type="number"
              value={templateData.settings.preferredSessionDuration}
              onChange={(e) => setTemplateData(prev => ({
                ...prev,
                settings: { ...prev.settings, preferredSessionDuration: parseInt(e.target.value) }
              }))}
              min="15"
              max="480"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Generate blocks (weeks in advance)
            </label>
            <input
              type="number"
              value={templateData.settings.generateWeeksInAdvance}
              onChange={(e) => setTemplateData(prev => ({
                ...prev,
                settings: { ...prev.settings, generateWeeksInAdvance: parseInt(e.target.value) }
              }))}
              min="1"
              max="12"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ScheduleTemplateBuilder;