import React from 'react';
import { useAuth } from '../../context/auth-context';

const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      
      {user ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <p>Name: {user.firstName} {user.lastName}</p>
            <p>Email: {user.email}</p>
            <p>Role: {user.roles.join(', ')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">Loading profile information...</p>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;