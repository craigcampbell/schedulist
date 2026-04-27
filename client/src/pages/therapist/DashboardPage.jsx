import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { Calendar, Clock, User, ChevronRight, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { getTherapistSchedule } from '../../api/schedule';

const SERVICE_TYPE_COLORS = {
  direct: 'bg-blue-100 text-blue-800 border-blue-300',
  indirect: 'bg-gray-100 text-gray-700 border-gray-300',
  supervision: 'bg-purple-100 text-purple-800 border-purple-300',
  lunch: 'bg-green-100 text-green-800 border-green-300',
  circle: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cleaning: 'bg-orange-100 text-orange-800 border-orange-300',
};

export default function TherapistDashboardPage() {
  const { user } = useAuth();

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['therapistSchedule', 14],
    queryFn: () => getTherapistSchedule(14),
  });

  const appointments = scheduleData?.appointments || [];

  const today = startOfDay(new Date());

  const todaysAppointments = appointments
    .filter(a => isToday(parseISO(a.startTime)))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const tomorrowsAppointments = appointments
    .filter(a => isTomorrow(parseISO(a.startTime)))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const upcomingAppointments = appointments
    .filter(a => {
      const d = parseISO(a.startTime);
      return !isToday(d) && !isTomorrow(d) && d >= today;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 5);

  const formatTime = (iso) => format(parseISO(iso), 'h:mm a');
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown';
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown';
  };

  const AppointmentCard = ({ appointment }) => {
    const colorClass = SERVICE_TYPE_COLORS[appointment.serviceType] || SERVICE_TYPE_COLORS.direct;
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${colorClass}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-medium">
              {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 capitalize">
              {appointment.serviceType}
            </span>
          </div>
          {appointment.patient && (
            <div className="flex items-center gap-1 mt-1 text-sm opacity-80 truncate">
              <User className="h-3.5 w-3.5 shrink-0" />
              {formatPatientName(appointment.patient)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, appointments, emptyText }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-sm text-gray-500">{appointments.length} session{appointments.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="p-4 space-y-2">
        {appointments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">{emptyText}</p>
        ) : (
          appointments.map(a => <AppointmentCard key={a.id} appointment={a} />)
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {user?.firstName || 'Therapist'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Link to="/therapist/schedule">
          <Button size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            View Full Schedule
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Today', count: todaysAppointments.length, icon: Calendar },
          { label: 'Tomorrow', count: tomorrowsAppointments.length, icon: Clock },
          { label: 'This Week', count: appointments.filter(a => {
            const d = parseISO(a.startTime);
            return d >= today && d <= new Date(today.getTime() + 7 * 86400000);
          }).length, icon: Users },
        ].map(({ label, count, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center shadow-sm">
            <Icon className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Today / Tomorrow / Upcoming */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading schedule...</div>
      ) : (
        <>
          <Section
            title="Today"
            appointments={todaysAppointments}
            emptyText="No sessions scheduled for today"
          />
          <Section
            title="Tomorrow"
            appointments={tomorrowsAppointments}
            emptyText="No sessions scheduled for tomorrow"
          />
          {upcomingAppointments.length > 0 && (
            <Section
              title="Upcoming"
              appointments={upcomingAppointments}
              emptyText=""
            />
          )}
        </>
      )}

      <div className="flex justify-center pb-4">
        <Link to="/therapist/schedule" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          View full schedule <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
