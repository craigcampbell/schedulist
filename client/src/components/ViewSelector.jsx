import React from 'react';
import { 
  Calendar, 
  User, 
  Coffee, 
  BarChart3, 
  Users, 
  Settings, 
  Clock,
  ChevronDown
} from 'lucide-react';

const VIEW_OPTIONS = [
  { value: 'grid', label: 'Excel Grid', icon: Clock },
  { value: 'patient', label: 'Patient View', icon: User },
  { value: 'lunch', label: 'Lunch Manager', icon: Coffee },
  { value: 'continuity', label: 'Continuity', icon: BarChart3 },
  { value: 'team', label: 'Team View', icon: Users },
  { value: 'enhanced', label: 'Enhanced View', icon: Settings },
  { value: 'unified', label: 'Unified View', icon: Calendar }
];

const ViewSelector = ({ value, onChange, className = "" }) => {
  const currentView = VIEW_OPTIONS.find(option => option.value === value) || VIEW_OPTIONS[0];
  const Icon = currentView.icon;

  return (
    <div className={`relative ${className}`}>
      <select
        className="w-full pl-9 pr-8 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {VIEW_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
};

export default ViewSelector;