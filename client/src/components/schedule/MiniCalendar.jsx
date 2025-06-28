import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Circle,
  AlertTriangle
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';

const MiniCalendar = ({ 
  selectedDate, 
  onDateSelect, 
  coverageData = {}, 
  className = "" 
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;

  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Navigate months
  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Get coverage status for a date
  const getCoverageStatus = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const coverage = coverageData[dateStr];
    
    if (!coverage) return null;
    
    if (coverage.coveragePercentage >= 0.9) return 'good';
    if (coverage.coveragePercentage >= 0.7) return 'partial';
    if (coverage.coveragePercentage > 0) return 'poor';
    return 'none';
  };

  // Get status indicator
  const getStatusIndicator = (status) => {
    switch (status) {
      case 'good':
        return <Circle className="h-2 w-2 fill-green-500 text-green-500" />;
      case 'partial':
        return <Circle className="h-2 w-2 fill-yellow-500 text-yellow-500" />;
      case 'poor':
        return <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />;
      case 'none':
        return <AlertTriangle className="h-2 w-2 fill-red-500 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={previousMonth}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-xs font-medium text-gray-500 text-center py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const coverageStatus = getCoverageStatus(day);
          
          return (
            <button
              key={day.toString()}
              onClick={() => onDateSelect(day)}
              className={`
                relative h-8 w-8 text-xs rounded transition-colors flex items-center justify-center
                ${isCurrentMonth 
                  ? 'text-gray-900 hover:bg-gray-100' 
                  : 'text-gray-400'
                }
                ${isSelected 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : ''
                }
                ${isTodayDate && !isSelected 
                  ? 'bg-blue-100 text-blue-600 font-medium' 
                  : ''
                }
              `}
            >
              <span className="relative z-10">
                {format(day, 'd')}
              </span>
              
              {/* Coverage status indicator */}
              {isCurrentMonth && coverageStatus && (
                <div className="absolute bottom-0 right-0 transform translate-x-1/2 translate-y-1/2">
                  {getStatusIndicator(coverageStatus)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-600 mb-2">Coverage Status:</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center">
            <Circle className="h-2 w-2 fill-green-500 text-green-500 mr-1" />
            <span className="text-gray-600">Good (90%+)</span>
          </div>
          <div className="flex items-center">
            <Circle className="h-2 w-2 fill-yellow-500 text-yellow-500 mr-1" />
            <span className="text-gray-600">Partial (70-89%)</span>
          </div>
          <div className="flex items-center">
            <Circle className="h-2 w-2 fill-orange-500 text-orange-500 mr-1" />
            <span className="text-gray-600">Poor (1-69%)</span>
          </div>
          <div className="flex items-center">
            <AlertTriangle className="h-2 w-2 fill-red-500 text-red-500 mr-1" />
            <span className="text-gray-600">No Coverage</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniCalendar;