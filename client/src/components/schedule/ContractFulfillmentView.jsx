import React, { useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock,
  Calendar,
  User
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ContractFulfillmentView = ({ patients = [], appointments = [] }) => {
  const contractStats = useMemo(() => {
    return patients.map(patient => {
      if (!patient.approvedHours || !patient.approvedHoursStartDate || !patient.approvedHoursEndDate) {
        return null;
      }

      const patientAppointments = appointments.filter(app => 
        app.patient?.id === patient.id && 
        app.status === 'completed'
      );

      const totalScheduledHours = patientAppointments.reduce((total, app) => {
        const start = new Date(app.startTime);
        const end = new Date(app.endTime);
        const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
        return total + duration;
      }, 0);

      const approvedPeriodStart = new Date(patient.approvedHoursStartDate);
      const approvedPeriodEnd = new Date(patient.approvedHoursEndDate);
      const totalDays = differenceInDays(approvedPeriodEnd, approvedPeriodStart);
      const daysElapsed = Math.max(0, differenceInDays(new Date(), approvedPeriodStart));
      const daysRemaining = Math.max(0, differenceInDays(approvedPeriodEnd, new Date()));
      
      const percentTimeElapsed = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
      const percentHoursUsed = patient.approvedHours > 0 ? (totalScheduledHours / patient.approvedHours) * 100 : 0;
      const expectedUsagePercent = percentTimeElapsed;
      
      const utilizationStatus = percentHoursUsed < expectedUsagePercent - 10 ? 'under' : 
                               percentHoursUsed > expectedUsagePercent + 10 ? 'over' : 'on-track';

      const weeklyTarget = patient.requiredWeeklyHours || 0;
      const weeksElapsed = Math.max(1, Math.floor(daysElapsed / 7));
      const expectedHours = weeklyTarget * weeksElapsed;
      const variance = totalScheduledHours - expectedHours;

      return {
        patient,
        totalScheduledHours,
        approvedHours: patient.approvedHours,
        percentHoursUsed,
        percentTimeElapsed,
        utilizationStatus,
        daysRemaining,
        variance,
        weeklyTarget,
        approvedPeriodStart,
        approvedPeriodEnd,
        appointments: patientAppointments.length
      };
    }).filter(Boolean);
  }, [patients, appointments]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'under':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'over':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'on-track':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'under':
        return <TrendingDown className="h-4 w-4" />;
      case 'over':
        return <TrendingUp className="h-4 w-4" />;
      case 'on-track':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'under':
        return 'Under-utilized';
      case 'over':
        return 'Over-utilized';
      case 'on-track':
        return 'On Track';
      default:
        return 'Unknown';
    }
  };

  const summary = useMemo(() => {
    const total = contractStats.length;
    const underUtilized = contractStats.filter(s => s.utilizationStatus === 'under').length;
    const overUtilized = contractStats.filter(s => s.utilizationStatus === 'over').length;
    const onTrack = contractStats.filter(s => s.utilizationStatus === 'on-track').length;
    
    return { total, underUtilized, overUtilized, onTrack };
  }, [contractStats]);

  if (contractStats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Contract Data Available</p>
        <p>Patients need approved hours data to show contract fulfillment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <User className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Patients</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">On Track</p>
              <p className="text-2xl font-bold text-green-600">{summary.onTrack}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Under-utilized</p>
              <p className="text-2xl font-bold text-red-600">{summary.underUtilized}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Over-utilized</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.overUtilized}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Contract Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium">Contract Fulfillment Details</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contract Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Hours Used / Approved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Days Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Weekly Target
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {contractStats.map((stat) => (
                <tr key={stat.patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {stat.patient.firstName} {stat.patient.lastName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {stat.appointments} appointments
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div>{format(stat.approvedPeriodStart, 'MMM d, yyyy')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      to {format(stat.approvedPeriodEnd, 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div className="font-medium">
                      {stat.totalScheduledHours.toFixed(1)} / {stat.approvedHours} hrs
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {stat.percentHoursUsed.toFixed(1)}% used
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={cn(
                          "h-2 rounded-full transition-all",
                          stat.utilizationStatus === 'under' ? 'bg-red-500' :
                          stat.utilizationStatus === 'over' ? 'bg-yellow-500' :
                          'bg-green-500'
                        )}
                        style={{ width: `${Math.min(100, stat.percentHoursUsed)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Expected: {stat.percentTimeElapsed.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      getStatusColor(stat.utilizationStatus)
                    )}>
                      {getStatusIcon(stat.utilizationStatus)}
                      <span className="ml-1">{getStatusText(stat.utilizationStatus)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {stat.daysRemaining} days
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div>{stat.weeklyTarget} hrs/week</div>
                    <div className={cn(
                      "text-xs",
                      stat.variance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {stat.variance >= 0 ? '+' : ''}{stat.variance.toFixed(1)} hrs {stat.variance >= 0 ? 'ahead' : 'behind'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ContractFulfillmentView;