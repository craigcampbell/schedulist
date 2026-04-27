import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPatientsWithAssignments,
  getAvailableBCBAs,
  getAvailableTherapists,
  setPrimaryBCBA,
  updateBCBAAssignment,
  updateTherapistAssignment
} from '../api/bcba';
import { Check, Edit, Plus, Trash, Star, StarOff, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

// Returns true if provider's insurancePanels fuzzy-match the patient's insuranceProvider string
function insuranceMatches(providerPanels = [], patientInsurance = '') {
  if (!patientInsurance) return null; // unknown — no indicator shown
  const needle = patientInsurance.toLowerCase();
  return providerPanels.some(p => {
    const hay = p.toLowerCase();
    // Check mutual containment of significant tokens
    const tokens = needle.split(/[\s/,&]+/).filter(t => t.length > 3);
    return tokens.some(t => hay.includes(t)) || hay.includes(needle) || needle.includes(hay);
  });
}

const PatientAssignmentList = () => {
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // all, assigned, unassigned
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [assignmentType, setAssignmentType] = useState(null); // 'bcba' or 'therapist'
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');

  const queryClient = useQueryClient();

  // Queries
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients-with-assignments'],
    queryFn: getPatientsWithAssignments
  });

  const { data: availableBCBAs = [], isLoading: isLoadingBCBAs } = useQuery({
    queryKey: ['available-bcbas'],
    queryFn: getAvailableBCBAs,
    enabled: assignmentType === 'bcba' && !!editingPatient
  });

  const { data: availableTherapists = [], isLoading: isLoadingTherapists } = useQuery({
    queryKey: ['available-therapists'],
    queryFn: getAvailableTherapists,
    enabled: assignmentType === 'therapist' && !!editingPatient
  });

  // Mutations
  const setPrimaryBCBAMutation = useMutation({
    mutationFn: ({ patientId, bcbaId }) => setPrimaryBCBA(patientId, bcbaId),
    onSuccess: () => {
      queryClient.invalidateQueries(['patients-with-assignments']);
    }
  });

  const updateBCBAAssignmentMutation = useMutation({
    mutationFn: ({ patientId, bcbaId, action }) => updateBCBAAssignment(patientId, bcbaId, action),
    onSuccess: () => {
      queryClient.invalidateQueries(['patients-with-assignments']);
      setEditingPatient(null);
      setAssignmentType(null);
    }
  });

  const updateTherapistAssignmentMutation = useMutation({
    mutationFn: ({ patientId, therapistId, action }) => updateTherapistAssignment(patientId, therapistId, action),
    onSuccess: () => {
      queryClient.invalidateQueries(['patients-with-assignments']);
      setEditingPatient(null);
      setAssignmentType(null);
    }
  });

  // Handle filtered patients
  const filteredPatients = patients.filter(patient => {
    // Format patient name for searching
    const patientName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    const matchesSearch = patientName.includes(searchTerm.toLowerCase());
    const hasAssignments = (patient.bcbas?.length > 0 || patient.therapists?.length > 0);
    
    if (assignmentFilter === 'assigned') return matchesSearch && hasAssignments;
    if (assignmentFilter === 'unassigned') return matchesSearch && !hasAssignments;
    return matchesSearch;
  });

  // Handle setting primary BCBA
  const handleSetPrimaryBCBA = (patientId, bcbaId) => {
    setPrimaryBCBAMutation.mutate({ patientId, bcbaId });
  };

  // Handle removing an assignment
  const handleRemoveAssignment = (patientId, assigneeId, type) => {
    if (type === 'bcba') {
      updateBCBAAssignmentMutation.mutate({
        patientId,
        bcbaId: assigneeId,
        action: 'unassign'
      });
    } else {
      updateTherapistAssignmentMutation.mutate({
        patientId,
        therapistId: assigneeId,
        action: 'unassign'
      });
    }
  };

  // Handle adding a new assignment
  const handleAddAssignment = () => {
    if (!selectedAssigneeId) return;
    
    if (assignmentType === 'bcba') {
      updateBCBAAssignmentMutation.mutate({
        patientId: editingPatient,
        bcbaId: selectedAssigneeId,
        action: 'assign'
      });
    } else {
      updateTherapistAssignmentMutation.mutate({
        patientId: editingPatient,
        therapistId: selectedAssigneeId,
        action: 'assign'
      });
    }
  };

  // Start editing patient assignments
  const startEditingAssignments = (patientId, type) => {
    setEditingPatient(patientId);
    setAssignmentType(type);
    setSelectedAssigneeId('');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPatient(null);
    setAssignmentType(null);
    setSelectedAssigneeId('');
  };

  if (isLoadingPatients) return <div className="p-4">Loading patients...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search patients..."
          className="flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
        >
          <option value="all">All Patients</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 shadow-sm rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Primary BCBA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Assigned BCBAs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Assigned Therapists
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPatients.map(patient => (
              <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{patient.status}</div>
                  {patient.insuranceProvider && (
                    <div className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">{patient.insuranceProvider}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {patient.primaryBCBA ? (
                    <div className="flex items-center">
                      <span className="font-medium">{patient.primaryBCBA.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">None assigned</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    {patient.bcbas?.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {patient.bcbas.map(bcba => (
                            <div key={bcba.id} className="group flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                              {bcba.name}
                              {patient.primaryBCBA?.id !== bcba.id && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleSetPrimaryBCBA(patient.id, bcba.id)}
                                    className="opacity-50 hover:opacity-100 transition-opacity"
                                    title="Set as primary BCBA"
                                  >
                                    <Star size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleRemoveAssignment(patient.id, bcba.id, 'bcba')}
                                    className="opacity-50 hover:opacity-100 transition-opacity text-red-600 dark:text-red-400"
                                    title="Remove assignment"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                              {patient.primaryBCBA?.id === bcba.id && (
                                <Star size={12} className="text-yellow-500" />
                              )}
                            </div>
                          ))}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-auto"
                          onClick={() => startEditingAssignments(patient.id, 'bcba')}
                        >
                          <Plus size={16} />
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-500">None assigned</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-auto"
                          onClick={() => startEditingAssignments(patient.id, 'bcba')}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    )}
                    
                    {/* BCBA Assignment Form */}
                    {editingPatient === patient.id && assignmentType === 'bcba' && (
                      <div className="mt-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 w-full space-y-2">
                        {patient.insuranceProvider && (
                          <p className="text-xs text-gray-500">
                            Patient insurance: <span className="font-medium text-gray-700 dark:text-gray-300">{patient.insuranceProvider}</span>
                            {' — '}providers with a ✓ are credentialed with this plan
                          </p>
                        )}
                        <div className="flex gap-2">
                          <select
                            value={selectedAssigneeId}
                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                            className="flex-1 p-2 rounded dark:bg-gray-700 text-sm"
                            disabled={isLoadingBCBAs}
                          >
                            <option value="">Select a BCBA</option>
                            {availableBCBAs
                              .filter(bcba => !patient.bcbas?.some(a => a.id === bcba.id))
                              .sort((a, b) => {
                                const am = insuranceMatches(a.insurancePanels, patient.insuranceProvider);
                                const bm = insuranceMatches(b.insurancePanels, patient.insuranceProvider);
                                if (am && !bm) return -1;
                                if (!am && bm) return 1;
                                return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
                              })
                              .map(bcba => {
                                const match = insuranceMatches(bcba.insurancePanels, patient.insuranceProvider);
                                const suffix = match === true ? ' ✓' : match === false ? ' ⚠' : '';
                                return (
                                  <option key={bcba.id} value={bcba.id}>
                                    {bcba.firstName} {bcba.lastName}{bcba.credentials ? `, ${bcba.credentials}` : ''}{suffix}
                                  </option>
                                );
                              })
                            }
                          </select>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleAddAssignment}
                            disabled={!selectedAssigneeId || updateBCBAAssignmentMutation.isPending}
                          >
                            Add
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEditing}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    {patient.therapists?.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {patient.therapists.map(therapist => (
                            <div key={therapist.id} className="group flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs">
                              {therapist.name}
                              <button 
                                onClick={() => handleRemoveAssignment(patient.id, therapist.id, 'therapist')}
                                className="opacity-50 hover:opacity-100 transition-opacity text-red-600 dark:text-red-400"
                                title="Remove assignment"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-auto"
                          onClick={() => startEditingAssignments(patient.id, 'therapist')}
                        >
                          <Plus size={16} />
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-500">None assigned</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-auto"
                          onClick={() => startEditingAssignments(patient.id, 'therapist')}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    )}
                    
                    {/* Therapist Assignment Form */}
                    {editingPatient === patient.id && assignmentType === 'therapist' && (
                      <div className="mt-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 w-full space-y-2">
                        {patient.insuranceProvider && (
                          <p className="text-xs text-gray-500">
                            Patient insurance: <span className="font-medium text-gray-700 dark:text-gray-300">{patient.insuranceProvider}</span>
                            {' — '}providers with a ✓ are credentialed with this plan
                          </p>
                        )}
                        <div className="flex gap-2">
                          <select
                            value={selectedAssigneeId}
                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                            className="flex-1 p-2 rounded dark:bg-gray-700 text-sm"
                            disabled={isLoadingTherapists}
                          >
                            <option value="">Select a Therapist</option>
                            {availableTherapists
                              .filter(t => !patient.therapists?.some(a => a.id === t.id))
                              .sort((a, b) => {
                                const am = insuranceMatches(a.insurancePanels, patient.insuranceProvider);
                                const bm = insuranceMatches(b.insurancePanels, patient.insuranceProvider);
                                if (am && !bm) return -1;
                                if (!am && bm) return 1;
                                return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
                              })
                              .map(therapist => {
                                const match = insuranceMatches(therapist.insurancePanels, patient.insuranceProvider);
                                const suffix = match === true ? ' ✓' : match === false ? ' ⚠' : '';
                                return (
                                  <option key={therapist.id} value={therapist.id}>
                                    {therapist.firstName} {therapist.lastName}{therapist.credentials ? `, ${therapist.credentials}` : ''}{suffix}
                                  </option>
                                );
                              })
                            }
                          </select>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleAddAssignment}
                            disabled={!selectedAssigneeId || updateTherapistAssignmentMutation.isPending}
                          >
                            Add
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEditing}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatientAssignmentList;