import React from 'react';

const AdminUsersPage = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500">No users found.</p>
      </div>
    </div>
  );
};

export default AdminUsersPage;