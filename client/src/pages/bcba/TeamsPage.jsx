import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { useModal } from '../../context/modal-context';
import { 
  Users, 
  Plus, 
  Edit2, 
  Save, 
  X, 
  UserPlus,
  UserMinus,
  Palette,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import apiClient from '../../api/client';
import { getAvailableTherapists, getAvailableBCBAs } from '../../api/bcba';

// API functions for teams
const getTeams = async () => {
  const response = await apiClient.get('/bcba/teams');
  return response.data;
};

const createTeam = async (teamData) => {
  const response = await apiClient.post('/bcba/teams', teamData);
  return response.data;
};

const updateTeam = async ({ id, ...teamData }) => {
  const response = await apiClient.put(`/bcba/teams/${id}`, teamData);
  return response.data;
};

const addTeamMember = async ({ teamId, userId }) => {
  const response = await apiClient.post(`/bcba/teams/${teamId}/members`, { userId });
  return response.data;
};

const removeTeamMember = async ({ teamId, userId }) => {
  const response = await apiClient.delete(`/bcba/teams/${teamId}/members/${userId}`);
  return response.data;
};

const deleteTeam = async (teamId) => {
  const response = await apiClient.delete(`/bcba/teams/${teamId}`);
  return response.data;
};

const TEAM_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Indigo', value: '#6366F1' }
];

export default function TeamsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showNewTeamForm, setShowNewTeamForm] = useState(false);
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    color: TEAM_COLORS[0].value,
    leadBcbaId: '',
    initialTherapists: []
  });
  const [editTeamData, setEditTeamData] = useState({});

  // Fetch teams
  const { data: teams, isLoading: isLoadingTeams } = useQuery({
    queryKey: ['bcba-teams'],
    queryFn: getTeams
  });

  // Fetch available therapists
  const { data: availableTherapists, isLoading: isLoadingTherapists } = useQuery({
    queryKey: ['available-therapists'],
    queryFn: getAvailableTherapists
  });

  // Fetch available BCBAs
  const { data: availableBCBAs, isLoading: isLoadingBCBAs } = useQuery({
    queryKey: ['available-bcbas'],
    queryFn: getAvailableBCBAs
  });

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: async (createdTeam) => {
      // Add initial therapists if any were selected
      if (newTeamData.initialTherapists.length > 0) {
        await Promise.all(
          newTeamData.initialTherapists.map(therapistId =>
            addTeamMember({ teamId: createdTeam.id, userId: therapistId })
          )
        );
      }
      queryClient.invalidateQueries(['bcba-teams']);
      setShowNewTeamForm(false);
      setNewTeamData({ name: '', color: TEAM_COLORS[0].value, leadBcbaId: '', initialTherapists: [] });
    }
  });

  const updateTeamMutation = useMutation({
    mutationFn: updateTeam,
    onSuccess: () => {
      queryClient.invalidateQueries(['bcba-teams']);
      setEditingTeam(null);
      setEditTeamData({});
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries(['bcba-teams']);
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries(['bcba-teams']);
    }
  });

  const deleteTeamMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries(['bcba-teams']);
    }
  });

  const handleCreateTeam = (e) => {
    e.preventDefault();
    if (!newTeamData.name.trim()) return;
    if (!newTeamData.leadBcbaId) return;
    
    createTeamMutation.mutate({
      name: newTeamData.name,
      color: newTeamData.color,
      leadBcbaId: newTeamData.leadBcbaId
    });
  };

  const handleUpdateTeam = (teamId) => {
    if (!editTeamData.name?.trim()) return;
    
    updateTeamMutation.mutate({
      id: teamId,
      ...editTeamData
    });
  };

  const handleAddMember = (teamId, therapistId) => {
    addMemberMutation.mutate({ teamId, userId: therapistId });
  };

  const handleRemoveMember = async (teamId, memberId) => {
    const confirmed = await modal.confirm(
      'Are you sure you want to remove this therapist from the team?',
      'Remove Team Member'
    );
    if (confirmed) {
      removeMemberMutation.mutate({ teamId, userId: memberId });
    }
  };

  const handleDeleteTeam = async (team) => {
    const memberCount = team.Members?.length || 0;
    const confirmMessage = memberCount > 0 
      ? `Are you sure you want to delete the team "${team.name}"? This will free up ${memberCount} therapist(s) to join other teams.`
      : `Are you sure you want to delete the team "${team.name}"?`;
    
    const confirmed = await modal.confirmDelete(team.name, confirmMessage);
    if (confirmed) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  const toggleTeamExpanded = (teamId) => {
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  const startEditingTeam = (team) => {
    setEditingTeam(team.id);
    setEditTeamData({
      name: team.name,
      color: team.color
    });
  };

  const cancelEditingTeam = () => {
    setEditingTeam(null);
    setEditTeamData({});
  };

  // Get therapists not in any team
  const getUnassignedTherapists = (currentTeamId = null) => {
    if (!teams || !availableTherapists) return [];
    
    const assignedTherapistIds = new Set();
    teams.forEach(team => {
      if (team.id !== currentTeamId) {
        team.Members?.forEach(member => assignedTherapistIds.add(member.id));
      }
    });
    
    return availableTherapists.filter(therapist => !assignedTherapistIds.has(therapist.id));
  };

  const isLoading = isLoadingTeams || isLoadingTherapists || isLoadingBCBAs;

  return (
    <div className="h-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Team Management
        </h1>
        
        <Button 
          onClick={() => setShowNewTeamForm(true)}
          disabled={showNewTeamForm}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* New Team Form */}
      {showNewTeamForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Team</h2>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Team Name *</label>
              <Input
                value={newTeamData.name}
                onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                placeholder="e.g., Team Alpha"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lead BCBA *</label>
              <select
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                value={newTeamData.leadBcbaId}
                onChange={(e) => setNewTeamData({ ...newTeamData, leadBcbaId: e.target.value })}
                required
              >
                <option value="">Select a BCBA</option>
                {availableBCBAs?.map(bcba => (
                  <option key={bcba.id} value={bcba.id}>
                    {bcba.firstName} {bcba.lastName} {bcba.id === user.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Initial Therapists (Optional)</label>
              <div className="border dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {availableTherapists?.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {getUnassignedTherapists().map(therapist => (
                      <label 
                        key={therapist.id} 
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-700"
                          checked={newTeamData.initialTherapists.includes(therapist.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewTeamData({
                                ...newTeamData,
                                initialTherapists: [...newTeamData.initialTherapists, therapist.id]
                              });
                            } else {
                              setNewTeamData({
                                ...newTeamData,
                                initialTherapists: newTeamData.initialTherapists.filter(id => id !== therapist.id)
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{therapist.firstName} {therapist.lastName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">No available therapists</p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select therapists to add to this team. You can add more later.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Team Color</label>
              <div className="flex gap-2 flex-wrap">
                {TEAM_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-10 h-10 rounded-lg border-2 transition-all",
                      newTeamData.color === color.value ? "border-gray-900 dark:border-white scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewTeamData({ ...newTeamData, color: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={createTeamMutation.isLoading || !newTeamData.name || !newTeamData.leadBcbaId}
              >
                {createTeamMutation.isLoading ? 'Creating...' : 'Create Team'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowNewTeamForm(false);
                  setNewTeamData({ name: '', color: TEAM_COLORS[0].value, leadBcbaId: '', initialTherapists: [] });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Teams List */}
      {isLoading && (
        <div className="flex h-60 items-center justify-center">
          <p>Loading teams...</p>
        </div>
      )}

      {!isLoading && (!teams || teams.length === 0) && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No teams created yet.</p>
          <p className="text-sm text-gray-400">Teams help organize therapists under BCBAs for better schedule management.</p>
        </div>
      )}

      {!isLoading && teams && teams.length > 0 && (
        <div className="space-y-4">
          {teams.map(team => {
            const isExpanded = expandedTeam === team.id;
            const isEditing = editingTeam === team.id;
            const unassignedTherapists = getUnassignedTherapists(team.id);
            
            return (
              <div key={team.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {/* Team Header */}
                <div 
                  className={cn(
                    "p-4 cursor-pointer transition-colors",
                    isExpanded ? "bg-gray-50 dark:bg-gray-700/50" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                  onClick={() => !isEditing && toggleTeamExpanded(team.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-4 h-12 rounded"
                        style={{ backgroundColor: team.color || '#4B5563' }}
                      />
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTeamData.name}
                              onChange={(e) => setEditTeamData({ ...editTeamData, name: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-48"
                            />
                            <div className="flex gap-1">
                              {TEAM_COLORS.map(color => (
                                <button
                                  key={color.value}
                                  type="button"
                                  className={cn(
                                    "w-6 h-6 rounded border-2 transition-all",
                                    editTeamData.color === color.value ? "border-gray-900 dark:border-white" : "border-transparent"
                                  )}
                                  style={{ backgroundColor: color.value }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditTeamData({ ...editTeamData, color: color.value });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-semibold text-lg">{team.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Lead: {team.LeadBCBA?.firstName} {team.LeadBCBA?.lastName} • {team.Members?.length || 0} therapists
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateTeam(team.id);
                            }}
                            disabled={updateTeamMutation.isLoading}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditingTeam();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTeam(team);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTeam(team);
                            }}
                            disabled={deleteTeamMutation.isLoading}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {isExpanded && !isEditing && (
                  <div className="border-t dark:border-gray-700">
                    <div className="p-4">
                      <h4 className="font-medium mb-3 flex items-center justify-between">
                        <span>Team Members</span>
                        {unassignedTherapists.length > 0 && (
                          <span className="text-sm text-gray-500">
                            {unassignedTherapists.length} therapists available
                          </span>
                        )}
                      </h4>
                      
                      {/* Current Members */}
                      <div className="space-y-2 mb-4">
                        {team.Members?.length > 0 ? (
                          team.Members.map(member => (
                            <div 
                              key={member.id} 
                              className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                            >
                              <div>
                                <p className="font-medium">{member.firstName} {member.lastName}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveMember(team.id, member.id)}
                                disabled={removeMemberMutation.isLoading}
                              >
                                <UserMinus className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">No therapists assigned yet</p>
                        )}
                      </div>
                      
                      {/* Add Member Section */}
                      {unassignedTherapists.length > 0 && (
                        <div className="border-t dark:border-gray-700 pt-4">
                          <h5 className="text-sm font-medium mb-2">Add Therapist</h5>
                          <div className="grid gap-2">
                            {unassignedTherapists.map(therapist => (
                              <div 
                                key={therapist.id} 
                                className="flex items-center justify-between p-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                              >
                                <div>
                                  <p className="font-medium">{therapist.firstName} {therapist.lastName}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{therapist.email}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddMember(team.id, therapist.id)}
                                  disabled={addMemberMutation.isLoading}
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                            ))}
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

      {/* Help Text */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium mb-2">About Teams</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Each team has one lead BCBA (additional BCBAs can collaborate)</li>
          <li>• Teams help organize therapists under specific BCBAs</li>
          <li>• Use team colors to visually distinguish teams in the schedule grid</li>
          <li>• Therapists can only belong to one team at a time</li>
          <li>• Teams are automatically created during data import based on patient assignments</li>
        </ul>
      </div>
    </div>
  );
}