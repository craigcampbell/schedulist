import React, { useState, useEffect } from 'react';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { checkColorDuplicate } from '../api/patients';

const predefinedColors = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
  '#6366F1', // indigo
  '#84CC16', // lime
  '#A855F7', // purple
  '#F43F5E', // rose
  '#0EA5E9', // sky
  '#22C55E', // green
  '#6B7280', // gray (default)
];

const ColorPicker = ({ value, onChange, patientId = null, patientName = '' }) => {
  const [selectedColor, setSelectedColor] = useState(value || '#6B7280');
  const [customColor, setCustomColor] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setSelectedColor(value || '#6B7280');
    setIsCustom(!predefinedColors.includes(value));
    if (!predefinedColors.includes(value) && value) {
      setCustomColor(value);
    }
  }, [value]);

  useEffect(() => {
    const checkDuplicate = async () => {
      if (!selectedColor || selectedColor === '#6B7280') {
        setDuplicateWarning(null);
        return;
      }

      setIsChecking(true);
      try {
        const result = await checkColorDuplicate(selectedColor, patientId);
        if (result.isDuplicate) {
          setDuplicateWarning({
            message: `This color is already used by: ${result.patients.map(p => p.name).join(', ')}`,
            patients: result.patients
          });
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error('Error checking color duplicate:', error);
      } finally {
        setIsChecking(false);
      }
    };

    const debounceTimer = setTimeout(checkDuplicate, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedColor, patientId]);

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setIsCustom(false);
    onChange(color);
  };

  const handleCustomColorChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    setSelectedColor(color);
    setIsCustom(true);
    onChange(color);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Patient Color {patientName && <span className="text-gray-500">for {patientName}</span>}
        </label>
        
        {/* Predefined colors grid */}
        <div className="grid grid-cols-8 gap-2 mb-4">
          {predefinedColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorSelect(color)}
              className={`relative w-10 h-10 rounded-lg border-2 transition-all ${
                selectedColor === color && !isCustom
                  ? 'border-gray-900 scale-110'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            >
              {selectedColor === color && !isCustom && (
                <CheckIcon className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-lg" />
              )}
            </button>
          ))}
        </div>

        {/* Custom color input */}
        <div className="flex items-center space-x-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isCustom}
              onChange={(e) => setIsCustom(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Custom color</span>
          </label>
          {isCustom && (
            <input
              type="color"
              value={customColor || selectedColor}
              onChange={handleCustomColorChange}
              className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
            />
          )}
        </div>

        {/* Current selection preview */}
        <div className="mt-4 flex items-center space-x-3">
          <div
            className="w-16 h-16 rounded-lg border-2 border-gray-300"
            style={{ backgroundColor: selectedColor }}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Selected Color</p>
            <p className="text-sm text-gray-500">{selectedColor}</p>
          </div>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <div className="text-sm">
                <p className="text-yellow-800 font-medium">Color already in use</p>
                <p className="text-yellow-700 mt-1">{duplicateWarning.message}</p>
                <p className="text-yellow-600 text-xs mt-2">
                  You can still use this color if you want to group patients together.
                </p>
              </div>
            </div>
          </div>
        )}

        {isChecking && (
          <p className="mt-2 text-sm text-gray-500">Checking for duplicate colors...</p>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;