import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  User, 
  Phone, 
  Shield,
  Plus
} from 'lucide-react';
import { getPatientById, getPatientNotes, createPatientNote } from '../../api/patients';
import { getPatientSchedule } from '../../api/schedule';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

// Validation schema for notes
const noteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
  noteType: z.enum(['session', 'progress', 'assessment', 'general']),
  sessionDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), {
    message: 'Please enter a valid date',
  }),
});

export default function TherapistPatientDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes', 'schedule', 'details'
  
  // Form setup
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      content: '',
      noteType: 'session',
      sessionDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });
  
  // Fetch patient data
  const { data: patient, isLoading: isLoadingPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatientById(id),
  });
  
  // Fetch patient notes
  const { data: notes, isLoading: isLoadingNotes } = useQuery({
    queryKey: ['patientNotes', id],
    queryFn: () => getPatientNotes(id, 50),
    enabled: activeTab === 'notes',
  });
  
  // Fetch patient schedule
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['patientSchedule', id],
    queryFn: () => getPatientSchedule(id, 10, false), // Upcoming appointments
    enabled: activeTab === 'schedule',
  });
  
  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: (noteData) => createPatientNote(id, noteData),
    onSuccess: () => {
      queryClient.invalidateQueries(['patientNotes', id]);
      setShowNoteForm(false);
      reset();
    },
  });
  
  // Submit handler for adding a note
  const onSubmitNote = (data) => {
    addNoteMutation.mutate(data);
  };
  
  // Loading state
  if (isLoadingPatient) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading patient data...</p>
      </div>
    );
  }
  
  // If patient not found
  if (!patient) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-red-500 mb-4">Patient not found</p>
        <Button onClick={() => navigate('/therapist/patients')}>
          Back to Patients
        </Button>
      </div>
    );
  }
  
  return (
    <div className="h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/therapist/patients')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {patient.firstName} {patient.lastName}
          </h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            patient.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
          </span>
        </div>
      </div>
      
      {/* Patient Summary Card */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</p>
              <p className="font-medium">{format(new Date(patient.dateOfBirth), 'PP')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Insurance</p>
              <p className="font-medium">{patient.insuranceProvider}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
              <p className="font-medium">{patient.phone || 'Not provided'}</p>
            </div>
          </div>
        </div>
        
        {patient.requiredWeeklyHours && (
          <div className="mt-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <p className="text-sm">
              <span className="font-medium">Required Weekly Hours:</span> {patient.requiredWeeklyHours}
            </p>
          </div>
        )}
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-6">
          <button
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'notes'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('notes')}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Notes
          </button>
          
          <button
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'schedule'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Schedule
          </button>
          
          <button
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('details')}
          >
            <User className="h-4 w-4 inline mr-2" />
            Details
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Patient Notes</h2>
              <Button onClick={() => setShowNoteForm(!showNoteForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
            
            {/* Note Form */}
            {showNoteForm && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium mb-4">New Note</h3>
                <form onSubmit={handleSubmit(onSubmitNote)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select 
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                      {...register('noteType')}
                    >
                      <option value="session">Session Note</option>
                      <option value="progress">Progress Note</option>
                      <option value="assessment">Assessment</option>
                      <option value="general">General</option>
                    </select>
                    {errors.noteType && (
                      <p className="mt-1 text-sm text-red-600">{errors.noteType.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <Input
                      type="date"
                      {...register('sessionDate')}
                    />
                    {errors.sessionDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.sessionDate.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 min-h-[120px]"
                      {...register('content')}
                    />
                    {errors.content && (
                      <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowNoteForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={addNoteMutation.isPending}
                    >
                      {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Notes List */}
            {isLoadingNotes ? (
              <p className="text-center py-4">Loading notes...</p>
            ) : (
              <>
                {(!notes || notes.length === 0) ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No notes found for this patient</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map(note => (
                      <div 
                        key={note.id}
                        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 mb-2">
                              {note.noteType.charAt(0).toUpperCase() + note.noteType.slice(1)}
                            </span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(note.sessionDate), 'PP')} by {note.author}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {format(new Date(note.createdAt), 'PP')}
                          </p>
                        </div>
                        <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Upcoming Appointments</h2>
            
            {isLoadingAppointments ? (
              <p className="text-center py-4">Loading appointments...</p>
            ) : (
              <>
                {(!appointments || appointments.length === 0) ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No upcoming appointments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments.map(appointment => (
                      <div 
                        key={appointment.id}
                        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">
                              {format(parseISO(appointment.startTime), 'EEEE, MMMM d, yyyy')}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {format(parseISO(appointment.startTime), 'h:mm a')} - {format(parseISO(appointment.endTime), 'h:mm a')}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              With: {appointment.therapist?.name || 'Not assigned'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Location: {appointment.location?.name || 'Not specified'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            appointment.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : appointment.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </div>
                        
                        {appointment.notes && (
                          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                            <p className="font-medium">Notes:</p>
                            <p className="text-gray-600 dark:text-gray-400">{appointment.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Patient Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Patient Details</h2>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">First Name</p>
                  <p className="font-medium">{patient.firstName}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last Name</p>
                  <p className="font-medium">{patient.lastName}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</p>
                  <p className="font-medium">{format(new Date(patient.dateOfBirth), 'PP')}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-medium">{patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Insurance Provider</p>
                  <p className="font-medium">{patient.insuranceProvider}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Insurance ID</p>
                  <p className="font-medium">{patient.insuranceId || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium">{patient.phone || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Required Weekly Hours</p>
                  <p className="font-medium">{patient.requiredWeeklyHours || 'Not specified'}</p>
                </div>
              </div>
              
              {patient.address && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                  <p className="font-medium">{patient.address}</p>
                </div>
              )}
              
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Assigned BCBAs/Therapists</p>
                {patient.assignees && patient.assignees.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {patient.assignees.map(assignee => (
                      <li key={assignee.id} className="font-medium">
                        {assignee.firstName} {assignee.lastName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-medium">No assignees</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}