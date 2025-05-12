import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBCBADashboardSummary } from '../../api/bcba';
import { Link } from 'react-router-dom';
import { Calendar, Users, UserCheck, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import PatientAssignmentList from '../../components/PatientAssignmentList';

const DashboardCard = ({ title, value, icon, color, linkTo, linkText }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className={`bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-300 p-2 rounded-full`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-4">{value}</div>
      {linkTo && (
        <Link to={linkTo}>
          <Button variant="outline" size="sm" className="w-full">
            {linkText || "View All"}
          </Button>
        </Link>
      )}
    </div>
  );
};

const BCBADashboardPage = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['bcba-dashboard'],
    queryFn: getBCBADashboardSummary,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-6">BCBA Dashboard</h1>
      
      {isLoading ? (
        <div className="text-center py-10">Loading dashboard data...</div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <p>Error loading dashboard data. Please try refreshing the page.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardCard 
              title="Patients" 
              value={dashboardData?.patientCount || 0} 
              icon={<Users size={24} />} 
              color="blue" 
              linkTo="/bcba/patients"
              linkText="View Patients"
            />
            <DashboardCard 
              title="Active Patients" 
              value={dashboardData?.activePatientCount || 0} 
              icon={<UserCheck size={24} />} 
              color="green" 
            />
            <DashboardCard 
              title="Therapists" 
              value={dashboardData?.therapistCount || 0} 
              icon={<Users size={24} />} 
              color="purple" 
              linkTo="/bcba/therapists"
              linkText="View Therapists"
            />
            <DashboardCard 
              title="Upcoming Sessions" 
              value={dashboardData?.upcomingAppointmentsCount || 0} 
              icon={<Calendar size={24} />} 
              color="amber" 
              linkTo="/bcba/schedule"
              linkText="View Schedule"
            />
          </div>

          <div className="mt-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Patient Assignments</h2>
              <Link to="/bcba/patients">
                <Button variant="outline" size="sm">View All Patients</Button>
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <PatientAssignmentList />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BCBADashboardPage;