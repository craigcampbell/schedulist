import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  Settings, 
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import PatientScheduleView from '../../components/schedule/PatientScheduleView';
import { patientSchedulingAPI } from '../../api/patientScheduling';

const PatientSchedulePage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleOverview, setScheduleOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Fetch patient and schedule overview
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch patient schedule overview for the week
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const overview = await patientSchedulingAPI.getPatientScheduleOverview(
          patientId,
          weekStart,
          weekEnd
        );
        
        setPatient(overview.patient);
        setScheduleOverview(overview);
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      fetchData();
    }
  }, [patientId, selectedDate]);

  // Handle auto-assignment for the selected date
  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      await patientSchedulingAPI.autoAssignTherapists(
        patientId,
        selectedDate,
        selectedDate,
        { 
          forceReassign: false,
          prioritizePreferred: true 
        }
      );
      
      // Refresh the schedule overview
      const overview = await patientSchedulingAPI.getPatientScheduleOverview(
        patientId,
        selectedDate,
        selectedDate
      );
      setScheduleOverview(overview);
    } catch (error) {
      console.error('Error auto-assigning therapists:', error);
    } finally {
      setAutoAssigning(false);
    }
  };

  // Handle auto-resolve gaps
  const handleAutoResolveGaps = async () => {
    try {
      await patientSchedulingAPI.autoResolveGaps(patientId, selectedDate, {
        maxGapsToResolve: 5
      });
      
      // Refresh the schedule overview
      const overview = await patientSchedulingAPI.getPatientScheduleOverview(
        patientId,
        selectedDate,
        selectedDate
      );
      setScheduleOverview(overview);
    } catch (error) {
      console.error('Error auto-resolving gaps:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading patient schedule...</span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're looking for doesn't exist or you don't have access.</p>
        <button
          onClick={() => navigate('/bcba/patients')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Back to Patients
        </button>
      </div>
    );
  }

  const coverageStats = scheduleOverview?.coverage || {};
  const scheduleStats = scheduleOverview?.schedule || {};

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/bcba/patients')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {patient.firstName} {patient.lastName} - Schedule
              </h1>
              <p className="text-sm text-gray-600">
                Required weekly hours: {patient.requiredWeeklyHours}h | 
                Location: {patient.defaultLocation?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Schedule Actions */}
            <button
              onClick={handleAutoResolveGaps}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Auto-Resolve Gaps
            </button>

            <button
              onClick={handleAutoAssign}
              disabled={autoAssigning}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center disabled:opacity-50"
            >
              {autoAssigning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Auto-Assign
            </button>

            <button
              onClick={() => navigate(`/bcba/patients/${patientId}/schedule/settings`)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-900">Total Blocks</p>
                <p className="text-lg font-semibold text-blue-600">
                  {scheduleStats.totalBlocks || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-900">Assigned</p>
                <p className="text-lg font-semibold text-green-600">
                  {scheduleStats.assignedBlocks || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-900">Gaps</p>
                <p className="text-lg font-semibold text-red-600">
                  {scheduleStats.unassignedBlocks || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-purple-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-purple-900">Coverage</p>
                <p className="text-lg font-semibold text-purple-600">
                  {Math.round((scheduleStats.coveragePercentage || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule View */}
      <div className="flex-1 overflow-hidden">
        <PatientScheduleView
          patientId={patientId}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          userRole="bcba"
        />
      </div>
    </div>
  );
};

export default PatientSchedulePage;