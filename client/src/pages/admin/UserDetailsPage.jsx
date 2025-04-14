import React from 'react';
import { useParams } from 'react-router-dom';

const AdminUserDetailsPage = () => {
  const { id } = useParams();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">User Details</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500">User ID: {id}</p>
        <p className="text-gray-500">User details would be displayed here.</p>
      </div>
    </div>
  );
};

export default AdminUserDetailsPage;