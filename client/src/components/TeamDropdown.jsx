import React from 'react';
import { Users, ChevronDown } from 'lucide-react';

const TeamDropdown = ({ teams = [], selectedTeam, onChange, placeholder = "All Teams", className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      <select
        className="w-full pl-9 pr-8 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
        value={selectedTeam || ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {teams.map(team => (
          <option key={team.id} value={team.id}>
            {team.name} {team.LeadBCBA && `(${team.LeadBCBA.firstName} ${team.LeadBCBA.lastName})`}
          </option>
        ))}
      </select>
      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
};

export default TeamDropdown;