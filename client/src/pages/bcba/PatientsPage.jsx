import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { 
  getPatientsWithAssignments, 
  getAllPatients,
  getAvailableTherapists, 
  getAvailableBCBAs,
  updateTherapistAssignment,
  updateBCBAAssignment,
  setPrimaryBCBA 
} from '../../api/bcba';
import { PlusIcon } from '@heroicons/react/24/outline';
import PatientForm from '../../components/PatientForm';

const PatientsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddPatientForm, setShowAddPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  
  // Fetch patients with their assignments
  const { data: patients = [], isLoading: patientsLoading, error: patientsError } = useQuery({
    queryKey: ['patients-with-assignments'],
    queryFn: getPatientsWithAssignments
  });
  
  // Fetch available therapists for assignment
  const { data: availableTherapists = [], isLoading: therapistsLoading, error: therapistsError } = useQuery({
    queryKey: ['available-therapists'],
    queryFn: getAvailableTherapists
  });
  
  // Fetch available BCBAs for assignment
  const { data: availableBCBAs = [], isLoading: bcbasLoading, error: bcbasError } = useQuery({
    queryKey: ['available-bcbas'],
    queryFn: getAvailableBCBAs
  });

  
  // Mutations
  const assignTherapistMutation = useMutation({
    mutationFn: (data) => updateTherapistAssignment(data.patientId, data.therapistId, 'assign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    },
    onError: (error) => {
      console.error('Error assigning therapist:', error);
    }
  });
  
  const unassignTherapistMutation = useMutation({
    mutationFn: (data) => updateTherapistAssignment(data.patientId, data.therapistId, 'unassign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    },
    onError: (error) => {
      console.error('Error unassigning therapist:', error);
    }
  });
  
  const assignBCBAMutation = useMutation({
    mutationFn: (data) => updateBCBAAssignment(data.patientId, data.bcbaId, 'assign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    },
    onError: (error) => {
      console.error('Error assigning BCBA:', error);
    }
  });
  
  const unassignBCBAMutation = useMutation({
    mutationFn: (data) => updateBCBAAssignment(data.patientId, data.bcbaId, 'unassign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    },
    onError: (error) => {
      console.error('Error unassigning BCBA:', error);
    }
  });
  
  const setPrimaryBCBAMutation = useMutation({
    mutationFn: (data) => setPrimaryBCBA(data.patientId, data.bcbaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    },
    onError: (error) => {
      console.error('Error setting primary BCBA:', error);
    }
  });
  
  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => {
    const patientName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    return patientName.includes(searchTerm.toLowerCase()) ||
      patient.id.toString().includes(searchTerm);
  });
  
  const handleAssignTherapist = (patientId, therapistId) => {
    assignTherapistMutation.mutate({ patientId, therapistId });
  };
  
  const handleUnassignTherapist = (patientId, therapistId) => {
    unassignTherapistMutation.mutate({ patientId, therapistId });
  };
  
  const handleAssignBCBA = (patientId, bcbaId) => {
    assignBCBAMutation.mutate({ patientId, bcbaId });
  };
  
  const handleUnassignBCBA = (patientId, bcbaId) => {
    unassignBCBAMutation.mutate({ patientId, bcbaId });
  };
  
  const handleSetPrimaryBCBA = (patientId, bcbaId) => {
    setPrimaryBCBAMutation.mutate({ patientId, bcbaId });
  };

  const handlePatientClick = (patient) => {
    // Determine the correct schedule path based on user role and current location
    const isAdminPath = location.pathname.startsWith('/admin');
    const schedulePath = isAdminPath ? '/admin/schedule' : '/bcba/schedule';
    
    // Navigate to schedule page with patient filter
    navigate(schedulePath, { 
      state: { 
        selectedPatient: patient,
        filterByPatient: true 
      } 
    });
  };
  
  if (patientsLoading) return <div className="p-6">Loading patients...</div>;
  
  if (patientsError) {
    return <div className="p-6 text-red-600">Error loading patients: {patientsError.message}</div>;
  }
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Patients & Assignments</h1>
      
      {/* Debug info */}
      {(therapistsError || bcbasError) && (
        <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded">
          {therapistsError && <p>Therapists loading error: {therapistsError.message}</p>}
          {bcbasError && <p>BCBAs loading error: {bcbasError.message}</p>}
        </div>
      )}
      
      {/* Loading states */}
      {(therapistsLoading || bcbasLoading) && selectedPatient && (
        <div className="mb-4 p-4 bg-blue-100 text-blue-800 rounded">
          {therapistsLoading && <p>Loading available therapists...</p>}
          {bcbasLoading && <p>Loading available BCBAs...</p>}
        </div>
      )}
      
      {/* Search and filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search patients by name or ID..."
          className="w-full p-2 border rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Patients list */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">No patients found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map(patient => (
            <div 
              key={patient.id}
              className={`bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border-2 ${
                selectedPatient?.id === patient.id ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ borderColor: patient.color || '#6B7280' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium">{patient.firstName} {patient.lastName}</h3>
                  <p className="text-sm text-gray-500">ID: {patient.id}</p>
                </div>
                <div 
                  className="w-6 h-6 rounded-full border border-gray-300"
                  style={{ backgroundColor: patient.color || '#6B7280' }}
                  title="Patient color"
                />
              </div>
              <p className="text-sm text-gray-500">
                Primary BCBA: {patient.primaryBCBA ? patient.primaryBCBA.name : 'None'}
              </p>
              {patient.team && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-600">Team:</span>
                  <span 
                    className="text-xs px-2 py-1 rounded-full text-white font-medium"
                    style={{ backgroundColor: patient.team.color || '#6B7280' }}
                  >
                    {patient.team.name}
                  </span>
                </div>
              )}
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-600">Assigned Therapists</p>
                {patient.therapists && patient.therapists.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.therapists.map(therapist => (
                      <span key={therapist.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {therapist.firstName} {therapist.lastName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No therapists assigned</p>
                )}
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-600">Assigned BCBAs</p>
                {patient.bcbas && patient.bcbas.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.bcbas.map(bcba => (
                      <span key={bcba.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {bcba.firstName} {bcba.lastName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No BCBAs assigned</p>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handlePatientClick(patient)}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                >
                  View Schedule
                </button>
                <button
                  onClick={() => setEditingPatient(patient)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPatient(patient);
                  }}
                  className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600 transition-colors"
                >
                  Assignments
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Patient details and assignment panel */}
      {selectedPatient && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{selectedPatient.firstName} {selectedPatient.lastName} - Assignments</h2>
            <button
              onClick={() => setSelectedPatient(null)}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Therapists assignment section */}
            <div>
              <h3 className="text-lg font-medium mb-3">Therapists</h3>
              
              {/* Currently assigned therapists */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Currently Assigned</h4>
                {selectedPatient.therapists && selectedPatient.therapists.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPatient.therapists.map(therapist => (
                      <div key={therapist.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{therapist.firstName} {therapist.lastName}</span>
                        <button
                          className="text-red-500 text-sm hover:underline"
                          onClick={() => handleUnassignTherapist(selectedPatient.id, therapist.id)}
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No therapists assigned</p>
                )}
              </div>
              
              {/* Available therapists to assign */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Available to Assign</h4>
                {availableTherapists.length > 0 ? (
                  <div className="space-y-2">
                    {availableTherapists
                      .filter(therapist => 
                        !selectedPatient.therapists?.some(t => t.id === therapist.id)
                      )
                      .map(therapist => (
                        <div key={therapist.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{therapist.firstName} {therapist.lastName}</span>
                          <button
                            className="text-green-500 text-sm hover:underline"
                            onClick={() => handleAssignTherapist(selectedPatient.id, therapist.id)}
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No available therapists</p>
                )}
              </div>
            </div>
            
            {/* BCBAs assignment section */}
            <div>
              <h3 className="text-lg font-medium mb-3">BCBAs</h3>
              
              {/* Currently assigned BCBAs */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Currently Assigned</h4>
                {selectedPatient.bcbas && selectedPatient.bcbas.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPatient.bcbas.map(bcba => (
                      <div key={bcba.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <span>{bcba.firstName} {bcba.lastName}</span>
                          {selectedPatient.primaryBCBA?.id === bcba.id && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Primary</span>
                          )}
                        </div>
                        <div className="flex space-x-3">
                          {selectedPatient.primaryBCBA?.id !== bcba.id && (
                            <button
                              className="text-blue-500 text-sm hover:underline"
                              onClick={() => handleSetPrimaryBCBA(selectedPatient.id, bcba.id)}
                            >
                              Set as Primary
                            </button>
                          )}
                          <button
                            className="text-red-500 text-sm hover:underline"
                            onClick={() => handleUnassignBCBA(selectedPatient.id, bcba.id)}
                          >
                            Unassign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No BCBAs assigned</p>
                )}
              </div>
              
              {/* Available BCBAs to assign */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Available to Assign</h4>
                {availableBCBAs.length > 0 ? (
                  <div className="space-y-2">
                    {availableBCBAs
                      .filter(bcba => 
                        !selectedPatient.bcbas?.some(b => b.id === bcba.id)
                      )
                      .map(bcba => (
                        <div key={bcba.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{bcba.firstName} {bcba.lastName}</span>
                          <button
                            className="text-green-500 text-sm hover:underline"
                            onClick={() => handleAssignBCBA(selectedPatient.id, bcba.id)}
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No available BCBAs</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add/Edit Patient Form Modal */}
      {(showAddPatientForm || editingPatient) && (
        <PatientForm
          patient={editingPatient}
          onClose={() => {
            setShowAddPatientForm(false);
            setEditingPatient(null);
          }}
          onSuccess={() => {
            setShowAddPatientForm(false);
            setEditingPatient(null);
            queryClient.invalidateQueries(['patients-with-assignments']);
          }}
        />
      )}
    </div>
  );
};

export default PatientsPage;