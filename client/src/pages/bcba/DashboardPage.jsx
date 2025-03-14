import React from 'react';

const BCBADashboardPage = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">BCBA Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Upcoming Appointments</h2>
          <p>You have no upcoming appointments.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Notes</h2>
          <p>No recent notes.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Patients</h2>
          <p>No patients assigned.</p>
        </div>
      </div>
    </div>
  );
};

export default BCBADashboardPage;