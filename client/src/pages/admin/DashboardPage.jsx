import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Users, 
  UserCircle, 
  Calendar, 
  MapPin, 
  Activity,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { getAdminDashboardSummary } from '../../api/admin';
import { Button } from '../../components/ui/button';

export default function AdminDashboardPage() {
  // Fetch dashboard summary data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: getAdminDashboardSummary,
  });
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading dashboard data...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Failed to load dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error.message}</p>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }
  
  // Extract data
  const { 
    userCountsByRole = [], 
    activePatientCount = 0, 
    totalPatientCount = 0,
    inactivePatientCount = 0,
    locationCount = 0, 
    upcomingAppointmentsCount = 0 
  } = data || {};
  
  // Find specific role counts
  const adminCount = userCountsByRole.find(r => r.role === 'admin')?.count || 0;
  const bcbaCount = userCountsByRole.find(r => r.role === 'bcba')?.count || 0;
  const therapistCount = userCountsByRole.find(r => r.role === 'therapist')?.count || 0;
  
  return (
    <div className="h-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Patients"
          value={totalPatientCount}
          icon={<Users className="h-6 w-6 text-indigo-500" />}
          description={`${activePatientCount} active, ${inactivePatientCount} inactive`}
          link="/admin/users?role=patient"
        />
        
        <StatCard 
          title="Locations"
          value={locationCount}
          icon={<MapPin className="h-6 w-6 text-green-500" />}
          description="Active clinical locations"
          link="/admin/locations"
        />
        
        <StatCard 
          title="Upcoming Appointments"
          value={upcomingAppointmentsCount}
          icon={<Calendar className="h-6 w-6 text-blue-500" />}
          description="Scheduled in the next 7 days"
        />
        
        <StatCard 
          title="Total Providers"
          value={bcbaCount + therapistCount}
          icon={<UserCircle className="h-6 w-6 text-purple-500" />}
          description={`${bcbaCount} BCBAs, ${therapistCount} Therapists`}
          link="/admin/users"
        />
      </div>
      
      {/* Staff Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Staff Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StaffCard 
            title="Admins"
            count={adminCount}
            icon={<User className="h-5 w-5 text-gray-500" />}
            color="bg-gray-100 dark:bg-gray-700"
            link="/admin/users?role=admin"
          />
          
          <StaffCard 
            title="BCBAs"
            count={bcbaCount}
            icon={<UserCircle className="h-5 w-5 text-purple-500" />}
            color="bg-purple-100 dark:bg-purple-900/20"
            link="/admin/users?role=bcba"
          />
          
          <StaffCard 
            title="Therapists"
            count={therapistCount}
            icon={<UserCircle className="h-5 w-5 text-blue-500" />}
            color="bg-blue-100 dark:bg-blue-900/20"
            link="/admin/users?role=therapist"
          />
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <ActionCard
            title="Add User"
            icon={<User className="h-5 w-5" />}
            link="/admin/users/new"
          />
          
          <ActionCard
            title="Add Location"
            icon={<MapPin className="h-5 w-5" />}
            link="/admin/locations/new"
          />
          
          <ActionCard
            title="Generate Reports"
            icon={<Activity className="h-5 w-5" />}
            link="/admin/reports"
          />
          
          <ActionCard
            title="View Schedule"
            icon={<Clock className="h-5 w-5" />}
            link="/admin/schedule"
          />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, description, link }) {
  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full">
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-3">
          {icon}
        </div>
      </div>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{description}</p>
      )}
    </div>
  );
  
  if (link) {
    return <Link to={link} className="block h-full hover:opacity-90 transition">{content}</Link>;
  }
  
  return content;
}

// Staff Card Component
function StaffCard({ title, count, icon, color, link }) {
  return (
    <Link to={link} className="block hover:opacity-90 transition">
      <div className={`${color} rounded-lg p-4 flex justify-between items-center`}>
        <div className="flex items-center">
          <div className="rounded-full bg-white dark:bg-gray-800 p-2 mr-3">
            {icon}
          </div>
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total: {count}</p>
          </div>
        </div>
        <div>
          <Button variant="ghost" size="sm">View</Button>
        </div>
      </div>
    </Link>
  );
}

// Action Card Component
function ActionCard({ title, icon, link }) {
  return (
    <Link to={link} className="block hover:opacity-90 transition">
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
        <div className="rounded-full bg-white dark:bg-gray-800 p-3 inline-flex mx-auto mb-3">
          {icon}
        </div>
        <p className="font-medium">{title}</p>
      </div>
    </Link>
  );
}