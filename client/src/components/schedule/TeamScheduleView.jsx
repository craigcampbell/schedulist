import React, { useState } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { cn } from "../../lib/utils";
import { Clock, MapPin, User, Calendar, Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  groupConsecutiveAppointments,
  getSpannedTimeSlots,
  getGroupPositionInSlot,
} from "../../utils/appointment-grouping";
import ResizableAppointment from "./ResizableAppointment";

const SERVICE_TYPE_COLORS = {
  direct: "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200",
  indirect: "bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200",
  supervision:
    "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200",
  noOw: "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200",
  lunch: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200",
  circle:
    "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200",
  cleaning:
    "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200",
  parentTraining:
    "bg-teal-100 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200",
  jojo: "bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  zeki: "bg-amber-200 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  jonDu: "bg-blue-200 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  masa: "bg-cyan-200 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
  brTa: "bg-lime-200 dark:bg-lime-900/30 text-lime-800 dark:text-lime-200",
  krRi: "bg-purple-200 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  leYu: "bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  liWu: "bg-pink-200 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
};

const TIME_SLOTS = [
  "7:30-8:00 AM",
  "8:00-8:30 AM",
  "8:30-9:00 AM",
  "9:00-9:30 AM",
  "9:30-10:00 AM",
  "10:00-10:30 AM",
  "10:30-11:00 AM",
  "11:00-11:30 AM",
  "11:30-12:00 PM",
  "12:00-12:30 PM",
  "12:30-1:00 PM",
  "1:00-1:30 PM",
  "1:30-2:00 PM",
  "2:00-2:30 PM",
  "2:30-3:00 PM",
  "3:00-3:30 PM",
  "3:30-4:00 PM",
  "4:00-4:30 PM",
  "4:30-5:00 PM",
  "5:00-5:30 PM",
];

// Calculate how many slots an appointment group spans
const calculateGroupSpan = (group) => {
  const start = new Date(group.startTime);
  const end = new Date(group.endTime);
  const durationMinutes = (end - start) / (1000 * 60);
  return Math.ceil(durationMinutes / 30);
};

// Get the starting slot index for an appointment group
const getGroupStartSlotIndex = (group) => {
  const start = new Date(group.startTime);
  const startHour = start.getHours() + start.getMinutes() / 60;

  return TIME_SLOTS.findIndex((slot) => {
    const [slotStart] = TIME_SLOT_MAP[slot] || [];
    return slotStart && startHour >= slotStart && startHour < slotStart + 0.5;
  });
};

const TIME_SLOT_MAP = {
  "7:30-8:00 AM": [7.5, 8.0],
  "8:00-8:30 AM": [8.0, 8.5],
  "8:30-9:00 AM": [8.5, 9.0],
  "9:00-9:30 AM": [9.0, 9.5],
  "9:30-10:00 AM": [9.5, 10.0],
  "10:00-10:30 AM": [10.0, 10.5],
  "10:30-11:00 AM": [10.5, 11.0],
  "11:00-11:30 AM": [11.0, 11.5],
  "11:30-12:00 PM": [11.5, 12.0],
  "12:00-12:30 PM": [12.0, 12.5],
  "12:30-1:00 PM": [12.5, 13.0],
  "1:00-1:30 PM": [13.0, 13.5],
  "1:30-2:00 PM": [13.5, 14.0],
  "2:00-2:30 PM": [14.0, 14.5],
  "2:30-3:00 PM": [14.5, 15.0],
  "3:00-3:30 PM": [15.0, 15.5],
  "3:30-4:00 PM": [15.5, 16.0],
  "4:00-4:30 PM": [16.0, 16.5],
  "4:30-5:00 PM": [16.5, 17.0],
  "5:00-5:30 PM": [17.0, 17.5],
};

export default function TeamScheduleView({
  teams,
  appointments = [],
  selectedDate,
  showLocationView = false,
  userRole = null, // Add userRole prop to determine name display format
  onAppointmentClick = () => {},
  onCellClick = () => {},
  onAppointmentUpdate = () => {},
}) {
  const [expandedTeams, setExpandedTeams] = useState({});
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Format dates and times
  const formatDayOfWeek = (date) => {
    return format(new Date(date), "EEEE");
  };

  const formatDayOfMonth = (date) => {
    return format(new Date(date), "M/d");
  };

  const formatTime = (dateTimeString) => {
    try {
      return format(new Date(dateTimeString), "h:mm a");
    } catch (error) {
      return "Invalid time";
    }
  };

  // Format patient name based on user role
  const formatPatientName = (patient) => {
    if (!patient) return "Unknown";

    // For all roles in schedule view, show abbreviated names (first 2 + last 2 chars)
    const firstTwo = patient.firstName?.substring(0, 2) || "--";
    const lastTwo = patient.lastName?.substring(0, 2) || "--";
    return `${firstTwo}${lastTwo}`;
  };

  // Format full patient name for hover/tooltip
  const formatFullPatientName = (patient) => {
    if (!patient) return "Unknown";
    return `${patient.firstName || "Unknown"} ${patient.lastName || ""}`;
  };

  // Group appointments by therapist and group consecutive ones
  const getTherapistAppointments = (therapistId) => {
    // Filter appointments for this therapist on the selected date
    const therapistApps = appointments.filter(
      (app) =>
        app.therapistId === therapistId &&
        isSameDay(new Date(app.startTime), new Date(selectedDate)),
    );

    // Sort by start time
    const sortedApps = therapistApps.sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime),
    );

    // Group consecutive appointments
    return groupConsecutiveAppointments(sortedApps);
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = () => {
    return appointments.filter((app) =>
      isSameDay(new Date(app.startTime), new Date(selectedDate)),
    );
  };

  // Group appointments by therapist without team information
  const getTherapistGroups = () => {
    const therapistGroups = {};
    const dateAppointments = getAppointmentsForDate();

    dateAppointments.forEach((app) => {
      if (!app.therapistId || !app.therapist) return;

      if (!therapistGroups[app.therapistId]) {
        therapistGroups[app.therapistId] = {
          id: app.therapistId,
          name:
            app.therapist.name ||
            `${app.therapist.firstName || ""} ${app.therapist.lastName || ""}`,
          firstName: app.therapist.firstName,
          lastName: app.therapist.lastName,
          appointments: [],
        };
      }

      therapistGroups[app.therapistId].appointments.push(app);
    });

    // Sort and group appointments for each therapist
    Object.values(therapistGroups).forEach((therapist) => {
      therapist.appointments.sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime),
      );
      therapist.appointmentGroups = groupConsecutiveAppointments(
        therapist.appointments,
      );
    });

    return Object.values(therapistGroups);
  };

  // Check if an appointment is in a time slot
  const isAppointmentInTimeSlot = (appointment, timeSlot) => {
    const [slotStart, slotEnd] = TIME_SLOT_MAP[timeSlot] || [];
    if (!slotStart || !slotEnd) return false;

    const appStart = new Date(appointment.startTime);
    const appEnd = new Date(appointment.endTime);

    const appStartHour = appStart.getHours() + appStart.getMinutes() / 60;
    const appEndHour = appEnd.getHours() + appEnd.getMinutes() / 60;

    // Check if appointment overlaps with this time slot
    return (
      (appStartHour >= slotStart && appStartHour < slotEnd) || // Starts in this slot
      (appEndHour > slotStart && appEndHour <= slotEnd) || // Ends in this slot
      (appStartHour <= slotStart && appEndHour >= slotEnd) // Spans across this slot
    );
  };

  // Get service code for display
  const getAppointmentServiceType = (appointment) => {
    if (!appointment) return null;

    // Extract the first word from the appointment title/serviceType if exists
    const serviceType =
      appointment.serviceType ||
      (appointment.title || "").split(" ")[0].toLowerCase();

    if (serviceType) {
      // Map common words to service types
      const serviceMap = {
        direct: "direct",
        supervision: "supervision",
        indirect: "indirect",
        lunch: "lunch",
        circle: "circle",
        "no-ow": "noOw",
        noow: "noOw",
        cleaning: "cleaning",
      };

      return serviceMap[serviceType.toLowerCase()] || "direct";
    }

    return "direct"; // Default
  };

  // Get the appointment group that occupies a specific slot
  const getGroupForSlot = (therapistGroups, slotIndex) => {
    for (const group of therapistGroups) {
      const startIndex = getGroupStartSlotIndex(group);
      const span = calculateGroupSpan(group);

      if (slotIndex >= startIndex && slotIndex < startIndex + span) {
        return {
          group,
          isStart: slotIndex === startIndex,
          relativeIndex: slotIndex - startIndex,
          totalSpan: span,
        };
      }
    }
    return null;
  };

  // Toggle team expanded/collapsed
  const toggleTeam = (teamId) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // Handle appointment click
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    onAppointmentClick(appointment);
  };

  const closeAppointmentDetails = () => {
    setSelectedAppointment(null);
  };

  // Check if a time slot is available for a therapist
  const checkAvailability = (
    newStartTime,
    newEndTime,
    therapistId,
    excludeGroupId = null,
  ) => {
    const start = new Date(newStartTime);
    const end = new Date(newEndTime);

    // Get all appointments for this therapist on the selected date
    const therapistAppointments = appointments.filter(
      (app) =>
        app.therapistId === therapistId &&
        isSameDay(new Date(app.startTime), new Date(selectedDate)),
    );

    // Check for conflicts
    for (const app of therapistAppointments) {
      // Skip appointments that are part of the group being resized
      const appointmentGroups = getTherapistAppointments(therapistId);
      const isPartOfExcludedGroup = appointmentGroups.some(
        (group) =>
          group.id === excludeGroupId &&
          group.appointments.some((a) => a.id === app.id),
      );

      if (isPartOfExcludedGroup) continue;

      const appStart = new Date(app.startTime);
      const appEnd = new Date(app.endTime);

      // Check for overlap
      if (
        (start >= appStart && start < appEnd) || // New start is during existing
        (end > appStart && end <= appEnd) || // New end is during existing
        (start <= appStart && end >= appEnd) // New appointment encompasses existing
      ) {
        return false; // Conflict found
      }
    }

    return true; // No conflicts
  };

  // Handle appointment resize
  const handleAppointmentResize = (groupId, newStartTime, newEndTime) => {
    // Find the group that was resized
    const allGroups = teams.flatMap(
      (team) =>
        team.Members?.flatMap((member) =>
          getTherapistAppointments(member.id),
        ) || [],
    );

    const resizedGroup = allGroups.find((group) => group.id === groupId);
    if (!resizedGroup) return;

    // Calculate the time difference to apply to all appointments in the group
    const originalStart = new Date(resizedGroup.startTime);
    const originalEnd = new Date(resizedGroup.endTime);
    const newStart = new Date(newStartTime);
    const newEnd = new Date(newEndTime);

    const startDiff = newStart - originalStart;
    const endDiff = newEnd - originalEnd;

    // Update all appointments in the group
    resizedGroup.appointments.forEach((appointment) => {
      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);

      const updatedAppointment = {
        ...appointment,
        startTime: new Date(
          appointmentStart.getTime() + startDiff,
        ).toISOString(),
        endTime: new Date(appointmentEnd.getTime() + endDiff).toISOString(),
      };

      onAppointmentUpdate(updatedAppointment);
    });
  };

  // Handle drag end for appointments
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    // Parse the droppable IDs to get therapist and time slot info
    const sourceParts = source.droppableId.split("-");
    const destParts = destination.droppableId.split("-");
    const sourceTherapistId = sourceParts[2];
    const sourceSlotIndex = sourceParts[3];
    const destTherapistId = destParts[2];
    const destSlotIndex = destParts[3];

    // Get the appointment group that was dragged
    const draggedGroup = getTherapistAppointments(sourceTherapistId).find(
      (group) => group.id === draggableId,
    );

    if (!draggedGroup) return;

    // Calculate new start time based on destination slot
    const targetSlot = TIME_SLOTS[parseInt(destSlotIndex)];
    const [targetTime] = targetSlot.split("-");
    const [targetHour, targetMinute] = targetTime.split(":").map((str) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });

    // Handle AM/PM
    let adjustedHour = targetHour;
    if (targetSlot.includes("PM") && targetHour !== 12) {
      adjustedHour += 12;
    } else if (targetSlot.includes("AM") && targetHour === 12) {
      adjustedHour = 0;
    }

    // Calculate duration of the appointment group
    const originalStart = new Date(draggedGroup.startTime);
    const originalEnd = new Date(draggedGroup.endTime);
    const durationMs = originalEnd - originalStart;

    // Create new start and end times
    const newStart = new Date(selectedDate);
    newStart.setHours(adjustedHour, targetMinute || 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Update all appointments in the group
    draggedGroup.appointments.forEach((appointment, index) => {
      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);
      const appointmentDuration = appointmentEnd - appointmentStart;
      const offsetFromGroupStart = appointmentStart - originalStart;

      const updatedAppointment = {
        ...appointment,
        therapistId: destTherapistId,
        startTime: new Date(
          newStart.getTime() + offsetFromGroupStart,
        ).toISOString(),
        endTime: new Date(
          newStart.getTime() + offsetFromGroupStart + appointmentDuration,
        ).toISOString(),
      };

      onAppointmentUpdate(updatedAppointment);
    });
  };

  // If showing location view (no teams) but have appointments
  if (showLocationView && appointments.length > 0) {
    const therapistGroups = getTherapistGroups();

    if (therapistGroups.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No Appointments</p>
          <p>There are no appointments scheduled for this date.</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b dark:border-gray-700">
            <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
              Location Schedule {format(new Date(selectedDate), "MMMM d, yyyy")}
            </h3>
          </div>

          <div className="p-4">
            <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
              {therapistGroups.map((therapist) => (
                <div key={therapist.id} className="p-3">
                  <h4 className="font-medium mb-2">{therapist.name}</h4>
                  <div className="pl-4 divide-y divide-gray-100 dark:divide-gray-800">
                    {therapist.appointmentGroups.map((group) => (
                      <div
                        key={group.id}
                        className="py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() =>
                          handleAppointmentClick(group.appointments[0])
                        }
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              <span
                                title={formatFullPatientName(group.patient)}
                                className="cursor-help"
                              >
                                {formatPatientName(group.patient)}
                              </span>
                              {group.appointments.length > 1 && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                  {group.appointments.length} sessions
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatTime(group.startTime)} -{" "}
                              {formatTime(group.endTime)}
                              {group.totalDuration && (
                                <span className="ml-2">
                                  ({group.totalDuration} mins)
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              SERVICE_TYPE_COLORS[
                                getAppointmentServiceType(group) || "direct"
                              ],
                            )}
                          >
                            {group.serviceType ||
                              getAppointmentServiceType(group) ||
                              "Session"}
                          </div>
                        </div>

                        {group.location && (
                          <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{group.location.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No teams available and not showing location view
  if (teams.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Teams Available</p>
        <p>There are no teams configured yet. Create teams to use this view.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {teams.map((team) => {
          const isExpanded = expandedTeams[team.id] !== false; // Default to expanded

          return (
            <div
              key={team.id}
              className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm"
            >
              {/* Team Header */}
              <div
                className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b dark:border-gray-700 flex justify-between items-center cursor-pointer"
                onClick={() => toggleTeam(team.id)}
              >
                <div>
                  <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
                    TEAM {team.LeadBCBA?.firstName || team.name || team.id}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Lead:{" "}
                    {team.LeadBCBA
                      ? `${team.LeadBCBA.firstName} ${team.LeadBCBA.lastName}`
                      : "Unassigned"}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  {isExpanded ? "Collapse" : "Expand"}
                </Button>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header rows with day, date, and therapist names */}
                    <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                      <div className="p-2 font-medium border-r border-b dark:border-gray-700 text-center">
                        {formatDayOfWeek(selectedDate)}
                      </div>

                      {/* BCBA header row */}
                      <div
                        className={`col-span-${team.Members?.length || 1} p-2 font-medium border-r border-b dark:border-gray-700 text-right pr-5`}
                      >
                        {team.LeadBCBA?.firstName || ""} (BCBA)
                      </div>
                    </div>

                    <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                      <div className="p-2 font-medium border-r dark:border-gray-700 text-center">
                        {formatDayOfMonth(selectedDate)}
                      </div>

                      {team.Members?.map((member) => (
                        <div
                          key={member.id}
                          className="p-2 font-medium border-r dark:border-gray-700 text-center"
                        >
                          {member.firstName}
                        </div>
                      ))}
                    </div>

                    {/* Time slots */}
                    {TIME_SLOTS.map((timeSlot, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[100px_repeat(auto-fill,minmax(100px,1fr))] border-b dark:border-gray-700"
                      >
                        {/* Time column */}
                        <div className="h-[40px] flex items-center justify-center text-sm border-r dark:border-gray-700 font-medium">
                          {timeSlot}
                        </div>

                        {/* Therapist columns */}
                        {team.Members?.map((member) => {
                          const therapistGroups = getTherapistAppointments(
                            member.id,
                          );
                          const groupInfo = getGroupForSlot(therapistGroups, i);
                          const dropId = `drop-${team.id}-${member.id}-${i}`;

                          return (
                            <Droppable
                              key={dropId}
                              droppableId={dropId}
                              type="appointment"
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    "border-r dark:border-gray-700 h-[40px] relative",
                                    snapshot.isDraggingOver &&
                                      "bg-blue-50 dark:bg-blue-900/20",
                                  )}
                                >
                                  {/* Render empty cell if no appointment */}
                                  {!groupInfo && (
                                    <div
                                      className="h-full hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                                      onClick={() =>
                                        onCellClick({
                                          therapistId: member.id,
                                          timeSlot: TIME_SLOTS[i],
                                          selectedDate,
                                          teamId: team.id,
                                          leadBcbaId: team.LeadBCBA?.id,
                                        })
                                      }
                                    >
                                      <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
                                        <Plus className="h-3 w-3 text-gray-400" />
                                      </div>
                                    </div>
                                  )}

                                  {/* Only render the appointment block at its starting slot */}
                                  {groupInfo && groupInfo.isStart && (
                                    <Draggable
                                      draggableId={groupInfo.group.id}
                                      index={i}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          style={{
                                            ...provided.draggableProps.style,
                                            position: "relative",
                                            zIndex: snapshot.isDragging
                                              ? 999
                                              : 1,
                                          }}
                                        >
                                          <ResizableAppointment
                                            group={groupInfo.group}
                                            serviceType={getAppointmentServiceType(
                                              groupInfo.group,
                                            )}
                                            serviceTypeColors={
                                              SERVICE_TYPE_COLORS
                                            }
                                            formatPatientName={
                                              formatPatientName
                                            }
                                            formatFullPatientName={
                                              formatFullPatientName
                                            }
                                            formatTime={formatTime}
                                            onResize={handleAppointmentResize}
                                            onAppointmentClick={
                                              onAppointmentClick
                                            }
                                            checkAvailability={
                                              checkAvailability
                                            }
                                            slotHeight={40}
                                          >
                                            <div className="font-medium">
                                              <span>
                                                {formatPatientName(
                                                  groupInfo.group.patient,
                                                )}
                                              </span>
                                            </div>
                                            {groupInfo.totalSpan > 2 && (
                                              <div className="text-xs opacity-75 mt-1">
                                                {formatTime(
                                                  groupInfo.group.startTime,
                                                )}{" "}
                                                -{" "}
                                                {formatTime(
                                                  groupInfo.group.endTime,
                                                )}
                                              </div>
                                            )}
                                            {groupInfo.group.appointments
                                              .length > 1 && (
                                              <div className="text-xs opacity-60">
                                                {
                                                  groupInfo.group.appointments
                                                    .length
                                                }{" "}
                                                sessions
                                              </div>
                                            )}
                                          </ResizableAppointment>
                                        </div>
                                      )}
                                    </Draggable>
                                  )}

                                  {/* Placeholder for non-starting slots of multi-slot appointments */}
                                  {groupInfo && !groupInfo.isStart && (
                                    <div className="h-full" />
                                  )}

                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* List of today's appointments for this team */}
                  <div className="p-4 border-t dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">
                      Appointments for{" "}
                      {format(new Date(selectedDate), "MMMM d, yyyy")}
                    </h4>

                    <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {(() => {
                        // Collect all appointment groups for the team
                        const allGroups =
                          team.Members?.flatMap((member) => {
                            const therapistGroups = getTherapistAppointments(
                              member.id,
                            );
                            return therapistGroups.map((group) => ({
                              ...group,
                              therapistName: `${member.firstName} ${member.lastName}`,
                            }));
                          }) || [];

                        // Sort groups by start time
                        const sortedGroups = allGroups.sort((a, b) => {
                          return new Date(a.startTime) - new Date(b.startTime);
                        });

                        // Render sorted groups
                        return sortedGroups.length > 0 ? (
                          sortedGroups.map((group) => (
                            <div
                              key={group.id}
                              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                              onClick={() =>
                                handleAppointmentClick(group.appointments[0])
                              }
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">
                                    <span
                                      title={formatFullPatientName(
                                        group.patient,
                                      )}
                                      className="cursor-help"
                                    >
                                      {formatPatientName(group.patient)}
                                    </span>
                                    {group.appointments.length > 1 && (
                                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                        {group.appointments.length} sessions
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    with {group.therapistName}
                                  </div>
                                </div>
                                <div
                                  className={cn(
                                    "text-xs px-2 py-1 rounded-full",
                                    SERVICE_TYPE_COLORS[
                                      getAppointmentServiceType(group) ||
                                        "direct"
                                    ],
                                  )}
                                >
                                  {group.serviceType ||
                                    getAppointmentServiceType(group) ||
                                    "Session"}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>
                                  {formatTime(group.startTime)} -{" "}
                                  {formatTime(group.endTime)}
                                </span>
                                {group.totalDuration && (
                                  <span className="ml-2">
                                    ({group.totalDuration} mins)
                                  </span>
                                )}
                              </div>

                              {group.location && (
                                <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  <span>{group.location.name}</span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            No appointments scheduled for this team today
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Appointment Details Modal */}
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Appointment Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeAppointmentDetails}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Patient
                  </h3>
                  <p className="text-lg">
                    {formatFullPatientName(selectedAppointment.patient)}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Time
                  </h3>
                  <p>
                    {format(new Date(selectedAppointment.startTime), "PPPP")}
                  </p>
                  <p>
                    {formatTime(selectedAppointment.startTime)} -{" "}
                    {formatTime(selectedAppointment.endTime)}
                  </p>
                </div>

                {selectedAppointment.location && (
                  <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300">
                      Location
                    </h3>
                    <p>{selectedAppointment.location.name}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Service Type
                  </h3>
                  <div
                    className={cn(
                      "inline-block px-2 py-1 rounded-full text-sm",
                      SERVICE_TYPE_COLORS[
                        getAppointmentServiceType(selectedAppointment) ||
                          "direct"
                      ],
                    )}
                  >
                    {selectedAppointment.serviceType ||
                      getAppointmentServiceType(selectedAppointment) ||
                      "Direct Service"}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </h3>
                  <div className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-sm">
                    {selectedAppointment.status || "Scheduled"}
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300">
                      Notes
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedAppointment.notes}
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button onClick={closeAppointmentDetails}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}
