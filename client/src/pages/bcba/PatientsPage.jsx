import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getPatientsWithAssignments, 
  getAvailableTherapists, 
  getAvailableBCBAs,
  updateTherapistAssignment,
  updateBCBAAssignment,
  setPrimaryBCBA 
} from '../../api/bcba';

const PatientsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Fetch patients with their assignments
  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-with-assignments'],
    queryFn: getPatientsWithAssignments
  });
  
  // Fetch available therapists for assignment
  const { data: availableTherapists = [] } = useQuery({
    queryKey: ['available-therapists'],
    queryFn: getAvailableTherapists
  });
  
  // Fetch available BCBAs for assignment
  const { data: availableBCBAs = [] } = useQuery({
    queryKey: ['available-bcbas'],
    queryFn: getAvailableBCBAs
  });
  
  // Mutations
  const assignTherapistMutation = useMutation({
    mutationFn: (data) => updateTherapistAssignment(data.patientId, data.therapistId, 'assign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    }
  });
  
  const unassignTherapistMutation = useMutation({
    mutationFn: (data) => updateTherapistAssignment(data.patientId, data.therapistId, 'unassign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    }
  });
  
  const assignBCBAMutation = useMutation({
    mutationFn: (data) => updateBCBAAssignment(data.patientId, data.bcbaId, 'assign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    }
  });
  
  const unassignBCBAMutation = useMutation({
    mutationFn: (data) => updateBCBAAssignment(data.patientId, data.bcbaId, 'unassign'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    }
  });
  
  const setPrimaryBCBAMutation = useMutation({
    mutationFn: (data) => setPrimaryBCBA(data.patientId, data.bcbaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-with-assignments'] });
    }
  });
  
  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.toString().includes(searchTerm)
  );
  
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
  
  if (patientsLoading) return <div className="p-6">Loading patients...</div>;
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Patients & Assignments</h1>
      
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
              className={`bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow ${
                selectedPatient?.id === patient.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedPatient(patient)}
            >
              <h3 className="text-lg font-medium">{patient.name}</h3>
              <p className="text-sm text-gray-500">ID: {patient.id}</p>
              <p className="text-sm text-gray-500">
                Primary BCBA: {patient.primaryBcba ? patient.primaryBcba.name : 'None'}
              </p>
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-600">Assigned Therapists</p>
                {patient.therapists && patient.therapists.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.therapists.map(therapist => (
                      <span key={therapist.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {therapist.name}
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
                        {bcba.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No BCBAs assigned</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Patient details and assignment panel */}
      {selectedPatient && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">{selectedPatient.name} - Assignments</h2>
          
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
                        <span>{therapist.name}</span>
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
                          <span>{therapist.name}</span>
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
                          <span>{bcba.name}</span>
                          {selectedPatient.primaryBcbaId === bcba.id && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Primary</span>
                          )}
                        </div>
                        <div className="flex space-x-3">
                          {selectedPatient.primaryBcbaId !== bcba.id && (
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
                          <span>{bcba.name}</span>
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
    </div>
  );
};

export default PatientsPage;