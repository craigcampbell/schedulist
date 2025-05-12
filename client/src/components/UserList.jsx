import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../api/admin';
import { getTherapists, getAvailableTherapists, getAvailableBCBAs } from '../api/bcba';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Check, X, Edit, Star, Users } from 'lucide-react';
import { Button } from './ui/button';

const UserList = ({ 
  userType = 'all', // all, bcba, therapist
  fetchFunction, // custom fetch function (overrides default)
  showFilters = true,
  onUserClick, // callback when a user is clicked
  selectedUsers = [], // for multi-select functionality
  onUserSelect, // callback when a user is selected (checkbox)
  showActions = true,
  actionButtons = [], // custom action buttons to show for each row
  emptyMessage = "No users found"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(userType !== 'all' ? userType : 'all');
  const [activeFilter, setActiveFilter] = useState('all');

  // Choose the appropriate fetch function based on user type
  const getFetchFunction = () => {
    if (fetchFunction) return fetchFunction;
    
    switch (userType) {
      case 'therapist':
        return getTherapists;
      case 'bcba':
        return getAvailableBCBAs;
      case 'all':
      default:
        return () => getUsers(roleFilter, activeFilter);
    }
  };

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', userType, roleFilter, activeFilter, !!fetchFunction],
    queryFn: getFetchFunction(),
  });

  // Reset role filter if userType changes
  useEffect(() => {
    if (userType !== 'all') {
      setRoleFilter(userType);
    }
  }, [userType]);

  const filteredUsers = users.filter(user => {
    if (!user) return false;
    
    // Handle different user data structures
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = user.name || `${firstName} ${lastName}`;
    const email = user.email || '';
    
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const isSelected = (userId) => {
    return selectedUsers.includes(userId);
  };

  const handleUserSelect = (userId) => {
    if (onUserSelect) {
      onUserSelect(userId);
    }
  };

  if (isLoading) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading users...</div>;

  return (
    <div className="space-y-4">    
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {userType === 'all' && (
            <select
              className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="bcba">BCBA</option>
              <option value="therapist">Therapist</option>
            </select>
          )}
          
          <select
            className="p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      )}
      
      <div className="overflow-x-auto">
        {filteredUsers.length > 0 ? (
          <table className="min-w-full bg-white dark:bg-gray-800 shadow-sm rounded-lg">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {onUserSelect && (
                  <th className="px-4 py-3 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                {userType === 'all' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                {showActions && (actionButtons.length > 0 || onUserClick) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map(user => {
                if (!user) return null;
                const firstName = user.firstName || '';
                const lastName = user.lastName || '';
                const fullName = user.name || `${firstName} ${lastName}`;
                
                return (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${onUserClick ? 'cursor-pointer' : ''}`}
                    onClick={onUserClick ? () => onUserClick(user) : undefined}
                  >
                    {onUserSelect && (
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected(user.id)}
                          onChange={() => handleUserSelect(user.id)}
                          className="h-4 w-4 rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()} // Prevent row click handler
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{fullName}</div>
                      {user.phone && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </td>
                    {userType === 'all' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.roles ? (
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <span 
                                key={role} 
                                className={`px-2 py-1 rounded-full text-xs
                                  ${role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : ''}
                                  ${role === 'bcba' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : ''}
                                  ${role === 'therapist' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}
                                `}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          userType
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.active !== undefined ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs">
                          Unknown
                        </span>
                      )}
                    </td>
                    {showActions && (actionButtons.length > 0 || onUserClick) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {actionButtons.map((button, index) => (
                            <Button
                              key={index}
                              variant={button.variant || "ghost"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (button.onClick) button.onClick(user);
                              }}
                              className={button.className}
                            >
                              {button.icon}
                              {button.label && <span className="ml-1">{button.label}</span>}
                            </Button>
                          ))}
                          {onUserClick && actionButtons.length === 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUserClick(user);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <Users className="mx-auto h-12 w-12 opacity-20 mb-4" />
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;