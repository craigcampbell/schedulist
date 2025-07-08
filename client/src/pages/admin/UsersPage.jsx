import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Mail, RefreshCw, Check, X } from 'lucide-react';
import UserList from '../../components/UserList';
import UserForm from '../../components/UserForm';
import InviteUserModal from '../../components/InviteUserModal';
import { Button } from '../../components/ui/button';
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  inviteUser 
} from '../../api/admin';

const AdminUsersPage = () => {
  const [showUserForm, setShowUserForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const queryClient = useQueryClient();

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowUserForm(false);
      setEditingUser(null);
    },
    onError: (error) => {
      console.error('Error creating user:', error);
      alert(error.response?.data?.message || 'Failed to create user');
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowUserForm(false);
      setEditingUser(null);
    },
    onError: (error) => {
      console.error('Error updating user:', error);
      alert(error.response?.data?.message || 'Failed to update user');
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id) => deleteUser(id, true), // deactivateOnly = true
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowInviteModal(false);
      alert('Invitation sent successfully!');
    },
    onError: (error) => {
      console.error('Error inviting user:', error);
      alert(error.response?.data?.message || 'Failed to send invitation');
    }
  });

  const handleUserSubmit = (userData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = (user) => {
    setDeleteConfirm(user);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteUserMutation.mutate(deleteConfirm.id);
    }
  };

  const handleInviteUser = (inviteData) => {
    inviteUserMutation.mutate(inviteData);
  };

  const actionButtons = [
    {
      icon: <Edit className="h-4 w-4" />,
      label: 'Edit',
      onClick: handleEditUser,
      variant: 'ghost'
    },
    {
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Delete',
      onClick: handleDeleteUser,
      variant: 'ghost',
      className: 'text-red-600 hover:text-red-700'
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-500 mt-1">Manage users, roles, and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowInviteModal(true)}
            variant="outline"
          >
            <Mail className="h-4 w-4 mr-2" />
            Invite User
          </Button>
          <Button 
            onClick={() => {
              setEditingUser(null);
              setShowUserForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* User Form */}
      {showUserForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h2>
          <UserForm
            user={editingUser}
            onSubmit={handleUserSubmit}
            onCancel={() => {
              setShowUserForm(false);
              setEditingUser(null);
            }}
            isSubmitting={createUserMutation.isPending || updateUserMutation.isPending}
          />
        </div>
      )}

      {/* User List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <UserList
          userType="all"
          showFilters={true}
          showActions={true}
          actionButtons={actionButtons}
          emptyMessage="No users found. Click 'Add User' to create a new user."
        />
      </div>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUser}
        isSubmitting={inviteUserMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to deactivate user{' '}
              <strong>{deleteConfirm.firstName} {deleteConfirm.lastName}</strong>?
              This action can be reversed by reactivating the user.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deactivate User
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;