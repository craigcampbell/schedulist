import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api/admin';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  Shield, 
  FileText, 
  Activity,
  Key,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';

const AuditTrail = () => {
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50
  });
  
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => getAuditLogs(filters),
    keepPreviousData: true
  });
  
  const audits = data?.audits || [];
  const pagination = data?.pagination || {};
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1 // Reset to first page on filter change
    }));
  };
  
  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };
  
  const toggleRowExpansion = (auditId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(auditId)) {
      newExpanded.delete(auditId);
    } else {
      newExpanded.add(auditId);
    }
    setExpandedRows(newExpanded);
  };
  
  const getActionIcon = (action) => {
    switch (action) {
      case 'create':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'update':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'delete':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'password_change':
        return <Key className="h-4 w-4 text-purple-500" />;
      case 'permission_change':
        return <Shield className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const formatFieldValue = (fieldName, value) => {
    if (!value) return '-';
    
    // Handle specific field types
    if (fieldName === 'active') {
      return value === 'true' ? 'Active' : 'Inactive';
    }
    
    if (fieldName === 'password') {
      return '***CHANGED***';
    }
    
    return value;
  };
  
  const getActionDescription = (audit) => {
    const { action, entityType, fieldName, oldValue, newValue } = audit;
    
    switch (action) {
      case 'create':
        return `Created new ${entityType}`;
      case 'delete':
        return `Deleted ${entityType}`;
      case 'password_change':
        return `Changed password`;
      case 'permission_change':
        return `Changed roles from "${oldValue}" to "${newValue}"`;
      case 'update':
        if (fieldName) {
          return `Updated ${fieldName} from "${formatFieldValue(fieldName, oldValue)}" to "${formatFieldValue(fieldName, newValue)}"`;
        }
        return `Updated ${entityType}`;
      default:
        return action;
    }
  };
  
  if (isLoading && audits.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <select
            name="entityType"
            value={filters.entityType}
            onChange={handleFilterChange}
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">All Entity Types</option>
            <option value="User">Users</option>
            <option value="Patient">Patients</option>
            <option value="Appointment">Appointments</option>
            <option value="Team">Teams</option>
          </select>
          
          <select
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="password_change">Password Change</option>
            <option value="permission_change">Permission Change</option>
          </select>
          
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            placeholder="Start Date"
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
          />
          
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            placeholder="End Date"
            className="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
          />
          
          <Button
            variant="outline"
            onClick={() => {
              setFilters({
                entityType: '',
                action: '',
                userId: '',
                startDate: '',
                endDate: '',
                page: 1,
                limit: 50
              });
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>
      
      {/* Audit Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {audits.map(audit => (
              <React.Fragment key={audit.id}>
                <tr 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => toggleRowExpansion(audit.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(audit.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {audit.ChangedBy?.firstName} {audit.ChangedBy?.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {audit.ChangedBy?.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getActionIcon(audit.action)}
                      <span className="text-sm capitalize">{audit.action.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {getActionDescription(audit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {audit.ipAddress || '-'}
                  </td>
                </tr>
                
                {expandedRows.has(audit.id) && (
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <td colSpan="5" className="px-6 py-4">
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium">Entity Type:</span> {audit.entityType}
                          </div>
                          <div>
                            <span className="font-medium">Entity ID:</span> {audit.entityId}
                          </div>
                        </div>
                        
                        {audit.fieldName && (
                          <div>
                            <span className="font-medium">Field:</span> {audit.fieldName}
                          </div>
                        )}
                        
                        {(audit.oldValue || audit.newValue) && (
                          <div className="grid grid-cols-2 gap-4">
                            {audit.oldValue && (
                              <div>
                                <span className="font-medium">Old Value:</span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                  {formatFieldValue(audit.fieldName, audit.oldValue)}
                                </span>
                              </div>
                            )}
                            {audit.newValue && (
                              <div>
                                <span className="font-medium">New Value:</span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                  {formatFieldValue(audit.fieldName, audit.newValue)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {audit.userAgent && (
                          <div>
                            <span className="font-medium">User Agent:</span>{' '}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {audit.userAgent}
                            </span>
                          </div>
                        )}
                        
                        {audit.metadata && Object.keys(audit.metadata).length > 0 && (
                          <div>
                            <span className="font-medium">Additional Info:</span>
                            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                              {JSON.stringify(audit.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        {audits.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No audit logs found matching the current filters.
          </div>
        )}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;