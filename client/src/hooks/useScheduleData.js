import { useMemo } from 'react';
import { startOfDay, isSameDay, parseISO } from 'date-fns';

export function useScheduleData(scheduleData, selectedDate, selectedTherapist, selectedPatient) {
  return useMemo(() => {
    if (!scheduleData) return { filteredData: null, therapistGroups: {}, patientGroups: {} };

    const selectedDateStart = startOfDay(selectedDate);
    
    // Filter appointments by selected date
    const dayAppointments = scheduleData.appointments?.filter(appointment => {
      const appointmentDate = parseISO(appointment.startTime);
      return isSameDay(appointmentDate, selectedDateStart);
    }) || [];

    // Apply therapist filter
    let filteredAppointments = dayAppointments;
    if (selectedTherapist) {
      filteredAppointments = filteredAppointments.filter(
        appointment => appointment.therapistId === selectedTherapist
      );
    }

    // Apply patient filter
    if (selectedPatient) {
      filteredAppointments = filteredAppointments.filter(
        appointment => appointment.patientId === selectedPatient
      );
    }

    // Group appointments by therapist
    const therapistGroups = filteredAppointments.reduce((groups, appointment) => {
      const therapistId = appointment.therapistId || 'unknown';
      if (!groups[therapistId]) {
        groups[therapistId] = {
          therapist: appointment.therapist || { id: therapistId, name: 'Unknown Therapist' },
          appointments: []
        };
      }
      groups[therapistId].appointments.push(appointment);
      return groups;
    }, {});

    // Group appointments by patient
    const patientGroups = filteredAppointments.reduce((groups, appointment) => {
      const patientId = appointment.patientId || 'unknown';
      if (!groups[patientId]) {
        groups[patientId] = {
          patient: appointment.patient || { id: patientId, firstName: 'Unknown', lastName: 'Patient' },
          appointments: []
        };
      }
      groups[patientId].appointments.push(appointment);
      return groups;
    }, {});

    return {
      filteredData: {
        ...scheduleData,
        appointments: filteredAppointments
      },
      therapistGroups,
      patientGroups
    };
  }, [scheduleData, selectedDate, selectedTherapist, selectedPatient]);
}

export function useTeamScheduleData(teamScheduleData, selectedTeam, selectedTherapist, selectedPatient) {
  return useMemo(() => {
    if (!teamScheduleData) return null;

    let filteredData = { ...teamScheduleData };

    // Filter by team if selected
    if (selectedTeam) {
      filteredData.teams = filteredData.teams?.filter(team => team.id === selectedTeam) || [];
      filteredData.appointments = filteredData.appointments?.filter(app => {
        // Include appointments for therapists in the selected team
        const therapistInTeam = filteredData.teams.some(team => 
          team.Members?.some(member => member.id === app.therapistId)
        );
        return therapistInTeam;
      }) || [];
    }

    // Apply therapist filter
    if (selectedTherapist) {
      filteredData.appointments = filteredData.appointments?.filter(
        app => app.therapistId === selectedTherapist
      ) || [];
    }

    // Apply patient filter
    if (selectedPatient) {
      filteredData.appointments = filteredData.appointments?.filter(
        app => app.patientId === selectedPatient
      ) || [];
    }

    return filteredData;
  }, [teamScheduleData, selectedTeam, selectedTherapist, selectedPatient]);
}