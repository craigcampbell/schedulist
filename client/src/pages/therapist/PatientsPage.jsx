import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { getAssignedPatients } from '../../api/patients';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export default function TherapistPatientsPage() {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Fetch patients data
  const { data: patients, isLoading, error, refetch } = useQuery({
    queryKey: ['assignedPatients', statusFilter],
    queryFn: () => getAssignedPatients(statusFilter),
  });
  
  // Filter patients by name
  const filteredPatients = patients?.filter(patient => {
    if (!filter) return true;
    
    const searchTerm = filter.toLowerCase();
    return (
      patient.firstName.toLowerCase().includes(searchTerm) ||
      patient.lastInitial.toLowerCase().includes(searchTerm)
    );
  });
  
  return (
    <div className="h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Patients</h1>
        
        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              type="search"
              placeholder="Search patients..."
              className="pl-8"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          
          <select
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="">All</option>
          </select>
        </div>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex h-60 items-center justify-center">
          <p>Loading patients...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="flex h-60 flex-col items-center justify-center">
          <p className="text-red-500 mb-4">Failed to load patients</p>
          <Button onClick={refetch}>Try Again</Button>
        </div>
      )}
      
      {/* No patients state */}
      {!isLoading && !error && (!patients || patients.length === 0) && (
        <div className="flex h-60 flex-col items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No patients found</p>
          {statusFilter && (
            <Button variant="outline" onClick={() => setStatusFilter('')}>
              Show All Patients
            </Button>
          )}
        </div>
      )}
      
      {/* Patients list */}
      {!isLoading && !error && filteredPatients && filteredPatients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map(patient => (
            <Link 
              key={patient.id}
              to={`/therapist/patients/${patient.id}`}
              className="block"
            >
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-2 hover:shadow-md transition-shadow"
                style={{ borderColor: patient.color || '#6B7280' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {patient.firstName} {patient.lastInitial}.
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Date of Birth: {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Insurance: {patient.insuranceProvider}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div 
                      className="w-5 h-5 rounded-full border border-gray-300"
                      style={{ backgroundColor: patient.color || '#6B7280' }}
                      title="Patient color"
                    />
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      patient.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                    </span>
                  </div>
                </div>
                
                {patient.requiredWeeklyHours && (
                  <div className="mt-3 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm">
                    <span className="font-medium">Weekly Hours:</span> {patient.requiredWeeklyHours}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}