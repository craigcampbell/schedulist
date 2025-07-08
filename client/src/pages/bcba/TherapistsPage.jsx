import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTherapists } from '../../api/bcba';
import { getSchedule } from '../../api/schedule';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Users, Clock, Calendar, ChevronRight, ChevronDown, Activity, Coffee, Circle, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

// Service type icons and colors
const SERVICE_TYPE_CONFIG = {
  direct: { icon: '👤', label: 'Direct Service', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  circle: { icon: '⭕', label: 'Circle Time', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
  cleaning: { icon: '🧹', label: 'Cleaning', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
  lunch: { icon: '🍽️', label: 'Lunch', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  indirect: { icon: '📋', label: 'Indirect', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200' },
  supervision: { icon: '👥', label: 'Supervision', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200' },
  parentTraining: { icon: '👨‍👩‍👧', label: 'Parent Training', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200' },
  noOw: { icon: '❌', label: 'No Show', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' }
};

const BCBATherapistsPage = () => {
  const [expandedTherapist, setExpandedTherapist] = useState(null);
  const [expandedPatients, setExpandedPatients] = useState({});
  const [expandedDailyBreakdown, setExpandedDailyBreakdown] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  
  // Fetch therapists
  const { data: therapists, isLoading: isLoadingTherapists } = useQuery({
    queryKey: ['bcba-therapists'],
    queryFn: getTherapists
  });

  // Get week dates
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch schedule data for the week
  const { data: weekSchedule, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['weekly-therapist-schedule', weekStart.toISOString()],
    queryFn: async () => {
      // Fetch schedule for each day of the week
      const schedulePromises = weekDays.map(day => 
        getSchedule('daily', day.toISOString())
      );
      const results = await Promise.all(schedulePromises);
      return results.map((result, index) => ({
        date: weekDays[index],
        appointments: result.appointments || []
      }));
    },
    enabled: !!therapists && therapists.length > 0
  });

  // Calculate statistics for a therapist
  const calculateTherapistStats = (therapistId) => {
    if (!weekSchedule) return null;

    const stats = {
      daily: {},
      weekly: {
        direct: 0,
        circle: 0,
        cleaning: 0,
        lunch: 0,
        indirect: 0,
        supervision: 0,
        parentTraining: 0,
        total: 0
      },
      patients: new Set(),
      appointments: []
    };

    weekSchedule.forEach(dayData => {
      const dayKey = format(dayData.date, 'yyyy-MM-dd');
      stats.daily[dayKey] = {
        direct: 0,
        circle: 0,
        cleaning: 0,
        lunch: 0,
        indirect: 0,
        supervision: 0,
        parentTraining: 0,
        total: 0
      };

      dayData.appointments
        .filter(app => app.therapistId === therapistId || app.therapist?.id === therapistId)
        .forEach(appointment => {
          const duration = (new Date(appointment.endTime) - new Date(appointment.startTime)) / (1000 * 60 * 60); // hours
          const serviceType = appointment.serviceType || 'direct';
          
          // Add to daily stats
          stats.daily[dayKey][serviceType] = (stats.daily[dayKey][serviceType] || 0) + duration;
          stats.daily[dayKey].total += duration;
          
          // Add to weekly stats
          stats.weekly[serviceType] = (stats.weekly[serviceType] || 0) + duration;
          stats.weekly.total += duration;
          
          // Track unique patients
          if (appointment.patient?.id) {
            stats.patients.add(appointment.patient.id);
          }
          
          // Store appointment details
          stats.appointments.push({
            ...appointment,
            duration
          });
        });
    });

    // Calculate averages
    const workDays = Object.values(stats.daily).filter(day => day.total > 0).length || 1;
    stats.averagePerDay = {
      direct: stats.weekly.direct / workDays,
      circle: stats.weekly.circle / workDays,
      cleaning: stats.weekly.cleaning / workDays,
      lunch: stats.weekly.lunch / workDays,
      indirect: stats.weekly.indirect / workDays,
      supervision: stats.weekly.supervision / workDays,
      parentTraining: stats.weekly.parentTraining / workDays,
      total: stats.weekly.total / workDays
    };

    return stats;
  };

  const toggleTherapist = (therapistId) => {
    setExpandedTherapist(expandedTherapist === therapistId ? null : therapistId);
  };

  const togglePatient = (therapistId, patientId) => {
    const key = `${therapistId}-${patientId}`;
    setExpandedPatients(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleDailyBreakdown = (therapistId) => {
    setExpandedDailyBreakdown(prev => ({
      ...prev,
      [therapistId]: !prev[therapistId]
    }));
  };

  const isLoading = isLoadingTherapists || isLoadingSchedule;

  return (
    <div className="h-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          My Therapists
        </h1>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedWeek(new Date())}
          >
            Current Week
          </Button>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Week of {format(weekStart, 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-60 items-center justify-center">
          <p>Loading therapists and schedules...</p>
        </div>
      )}

      {!isLoading && (!therapists || therapists.length === 0) && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No therapists assigned yet.</p>
          <p className="text-sm text-gray-400">Therapists assigned to your patients will appear here.</p>
        </div>
      )}

      {!isLoading && therapists && therapists.length > 0 && (
        <div className="space-y-4">
          {therapists.map(therapist => {
            const stats = calculateTherapistStats(therapist.id);
            const isExpanded = expandedTherapist === therapist.id;
            
            return (
              <div key={therapist.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {/* Therapist Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => toggleTherapist(therapist.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                          {therapist.firstName?.[0]}{therapist.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {therapist.firstName} {therapist.lastName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {stats?.patients.size || 0} patients • {stats?.weekly.total.toFixed(1) || 0} hrs/week
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Quick Stats */}
                      <div className="flex gap-2">
                        <div className={cn("px-2 py-1 rounded text-xs font-medium", SERVICE_TYPE_CONFIG.direct.color)}>
                          {SERVICE_TYPE_CONFIG.direct.icon} {stats?.weekly.direct.toFixed(1) || 0}h
                        </div>
                        {stats?.weekly.circle > 0 && (
                          <div className={cn("px-2 py-1 rounded text-xs font-medium", SERVICE_TYPE_CONFIG.circle.color)}>
                            {SERVICE_TYPE_CONFIG.circle.icon} {stats.weekly.circle.toFixed(1)}h
                          </div>
                        )}
                      </div>
                      
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && stats && (
                  <div className="border-t dark:border-gray-700">
                    {/* Weekly Summary */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Weekly Summary
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(SERVICE_TYPE_CONFIG).map(([type, config]) => {
                          const hours = stats.weekly[type] || 0;
                          if (hours === 0 && type !== 'direct') return null;
                          
                          return (
                            <div key={type} className={cn("p-3 rounded-lg", config.color)}>
                              <div className="flex items-center gap-2 mb-1">
                                <span>{config.icon}</span>
                                <span className="font-medium text-sm">{config.label}</span>
                              </div>
                              <div className="text-lg font-semibold">{hours.toFixed(1)}h</div>
                              <div className="text-xs opacity-75">
                                avg {stats.averagePerDay[type].toFixed(1)}h/day
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assigned Patients */}
                    <div className="p-4 border-t dark:border-gray-700">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Assigned Patients
                      </h4>
                      <div className="space-y-2">
                        {(() => {
                          // Create a map to deduplicate patients by ID
                          const uniquePatients = new Map();
                          
                          stats.appointments.forEach(app => {
                            if (app.patient?.id && !uniquePatients.has(app.patient.id)) {
                              uniquePatients.set(app.patient.id, app.patient);
                            }
                          });
                          
                          // Convert map to array and render
                          return Array.from(uniquePatients.values()).map(patient => {
                            const patientApps = stats.appointments.filter(app => app.patient?.id === patient.id);
                            const patientHours = patientApps.reduce((sum, app) => sum + app.duration, 0);
                            const isPatientExpanded = expandedPatients[`${therapist.id}-${patient.id}`];
                            
                            // Group patient appointments by day
                            const patientDailySchedule = {};
                            patientApps.forEach(app => {
                              const dayKey = format(new Date(app.startTime), 'yyyy-MM-dd');
                              if (!patientDailySchedule[dayKey]) {
                                patientDailySchedule[dayKey] = [];
                              }
                              patientDailySchedule[dayKey].push(app);
                            });
                            
                            return (
                              <div key={patient.id} className="border rounded-lg dark:border-gray-700 overflow-hidden">
                                <div 
                                  className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30"
                                  onClick={() => togglePatient(therapist.id, patient.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-8 h-8 rounded-full border-2"
                                      style={{ 
                                        backgroundColor: patient.color || '#6B7280',
                                        borderColor: patient.color || '#6B7280'
                                      }}
                                    />
                                    <div>
                                      <div className="font-medium">
                                        {patient.firstName} {patient.lastName?.[0]}.
                                      </div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {patientApps.length} sessions
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium">
                                      {patientHours.toFixed(1)}h/week
                                    </div>
                                    {isPatientExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Patient Daily Breakdown */}
                                {isPatientExpanded && (
                                  <div className="border-t dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/30">
                                    <div className="space-y-2">
                                      {weekDays.map(day => {
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const dayAppointments = patientDailySchedule[dayKey] || [];
                                        const isToday = isSameDay(day, new Date());
                                        
                                        if (dayAppointments.length === 0) {
                                          return (
                                            <div key={dayKey} className="text-xs text-gray-500 dark:text-gray-400">
                                              {format(day, 'EEE')} - No sessions
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <div 
                                            key={dayKey} 
                                            className={cn(
                                              "p-2 rounded text-sm",
                                              isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-white dark:bg-gray-800"
                                            )}
                                          >
                                            <div className="font-medium mb-1">
                                              {format(day, 'EEEE')}
                                              {isToday && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Today)</span>}
                                            </div>
                                            {dayAppointments.map((app, idx) => (
                                              <div key={idx} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                  <span className={cn("px-1.5 py-0.5 rounded", SERVICE_TYPE_CONFIG[app.serviceType || 'direct'].color)}>
                                                    {SERVICE_TYPE_CONFIG[app.serviceType || 'direct'].icon} {SERVICE_TYPE_CONFIG[app.serviceType || 'direct'].label}
                                                  </span>
                                                  <span className="text-gray-600 dark:text-gray-400">
                                                    {format(new Date(app.startTime), 'h:mm a')} - {format(new Date(app.endTime), 'h:mm a')}
                                                  </span>
                                                </div>
                                                <span className="font-medium">
                                                  {app.duration.toFixed(1)}h
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Daily Breakdown */}
                    <div className="border-t dark:border-gray-700">
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        onClick={() => toggleDailyBreakdown(therapist.id)}
                      >
                        <h4 className="font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Daily Breakdown
                          </span>
                          {expandedDailyBreakdown[therapist.id] ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </h4>
                      </div>
                      
                      {expandedDailyBreakdown[therapist.id] && (
                        <div className="p-4 pt-0">
                          <div className="space-y-2">
                            {weekDays.map(day => {
                              const dayKey = format(day, 'yyyy-MM-dd');
                              const dayStats = stats.daily[dayKey];
                              const isToday = isSameDay(day, new Date());
                              
                              return (
                                <div 
                                  key={dayKey} 
                                  className={cn(
                                    "p-3 rounded-lg",
                                    isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-800/30"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">
                                      {format(day, 'EEEE, MMM d')}
                                      {isToday && (
                                        <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">Today</span>
                                      )}
                                    </div>
                                    <div className="text-sm font-medium">
                                      {dayStats?.total.toFixed(1) || 0}h total
                                    </div>
                                  </div>
                                  {dayStats?.total > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                      {Object.entries(SERVICE_TYPE_CONFIG).map(([type, config]) => {
                                        const hours = dayStats[type] || 0;
                                        if (hours === 0) return null;
                                        
                                        return (
                                          <div key={type} className={cn("px-2 py-1 rounded text-xs", config.color)}>
                                            {config.icon} {hours.toFixed(1)}h
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BCBATherapistsPage;