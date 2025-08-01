# Location-Specific Time Slots System

## Overview

The scheduling system now supports location-specific time slots, allowing administrators to configure different working hours for each location. This makes the system more flexible and realistic for multi-location organizations.

## Features

- **Location-specific working hours**: Each location can have different start and end times
- **Flexible slot durations**: Support for 15, 30, 45, and 60-minute time slots
- **Multiple format support**: Excel format (7:30 AM), Range format (7:30-8:00 AM), and Simple format (7:30-8:00)
- **Automatic fallback**: Uses default times if location data is missing
- **Backward compatibility**: Existing components continue to work without changes

## Database Schema

The `Location` model already includes the necessary fields:

```javascript
// schedulist/src/models/location.model.js
{
  workingHoursStart: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '08:00',  // Default 8 AM
  },
  workingHoursEnd: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '17:00',  // Default 5 PM
  }
}
```

## Utility Functions

### `getLocationTimeSlots(location, format)`

Generates time slots and ranges for a specific location.

**Parameters:**
- `location` (Object): Location object with `workingHoursStart` and `workingHoursEnd`
- `format` (String): 'excel', 'range', or 'simple'

**Returns:**
```javascript
{
  timeSlots: ['7:30 AM', '8:00 AM', ...],
  timeSlotRanges: {
    '7:30 AM': { start: 450, end: 480 },
    '8:00 AM': { start: 480, end: 510 },
    // ...
  }
}
```

### `generateTimeSlots(location, slotDuration, format)`

Generates time slots with custom duration.

**Parameters:**
- `location` (Object): Location object
- `slotDuration` (Number): Duration in minutes (default: 30)
- `format` (String): Output format

### `getMostCommonLocation(appointments)`

Finds the most common location from a list of appointments.

## Updated Components

### ExcelScheduleGrid

```javascript
import { getLocationTimeSlots, getMostCommonLocation } from '../../utils/location-time-slots';

export default function ExcelScheduleGrid({
  teams = [],
  appointments = [],
  patients = [],
  selectedDate,
  location = null, // New prop for location-specific time slots
  // ... other props
}) {
  // Get location-specific time slots
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
    const targetLocation = location || getMostCommonLocation(todaysAppointments);
    return getLocationTimeSlots(targetLocation, 'excel');
  }, [location, todaysAppointments]);

  // ... rest of component
}
```

### TeamScheduleView

```javascript
export default function TeamScheduleView({
  teams,
  appointments = [],
  selectedDate,
  location = null, // New prop
  // ... other props
}) {
  // Get location-specific time slots
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
    const targetLocation = location || getMostCommonLocation(todaysAppointments);
    return getLocationTimeSlots(targetLocation, 'range');
  }, [location, todaysAppointments]);

  // ... rest of component
}
```

### PatientScheduleGrid

```javascript
export default function PatientScheduleGrid({
  patients = [],
  appointments = [],
  location = null, // New prop
  // ... other props
}) {
  // Get location-specific time slots
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
    const targetLocation = location || getMostCommonLocation(todaysAppointments);
    return getLocationTimeSlots(targetLocation, 'simple');
  }, [location, todaysAppointments]);

  // ... rest of component
}
```

### EnhancedScheduleView

```javascript
export default function EnhancedScheduleView({
  teams,
  appointments = [],
  location = null, // New prop
  // ... other props
}) {
  // Get location-specific time slots
  const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
    const targetLocation = location || getMostCommonLocation(todaysAppointments);
    return getLocationTimeSlots(targetLocation, 'range');
  }, [location, todaysAppointments]);

  // ... rest of component
}
```

## Admin Configuration

Administrators can configure working hours through the existing Locations page:

1. Go to Admin → Locations
2. Create or edit a location
3. Set the working hours (start and end times)
4. Save the location

The system will automatically use these hours to generate appropriate time slots.

## Usage Examples

### Basic Usage

```javascript
import { getLocationTimeSlots } from '../../utils/location-time-slots';

const location = {
  workingHoursStart: '08:00',
  workingHoursEnd: '17:00'
};

const { timeSlots, timeSlotRanges } = getLocationTimeSlots(location, 'excel');
console.log(timeSlots);
// ['8:00 AM', '8:30 AM', '9:00 AM', ...]
```

### Custom Slot Duration

```javascript
import { generateTimeSlots } from '../../utils/location-time-slots';

const slots = generateTimeSlots(location, 45, 'excel');
console.log(slots);
// ['8:00 AM', '8:45 AM', '9:30 AM', ...]
```

### Fallback to Default

```javascript
const { timeSlots } = getLocationTimeSlots(null, 'excel');
// Uses default 7:30 AM to 5:30 PM slots
```

## Migration Guide

### For Existing Components

1. Import the utility functions:
```javascript
import { getLocationTimeSlots, getMostCommonLocation } from '../../utils/location-time-slots';
```

2. Add location prop to component:
```javascript
export default function MyComponent({
  // ... existing props
  location = null
}) {
```

3. Replace hardcoded time slots with dynamic ones:
```javascript
// Before
const TIME_SLOTS = ["7:30 AM", "8:00 AM", ...];

// After
const { timeSlots: TIME_SLOTS, timeSlotRanges: TIME_SLOT_RANGES } = useMemo(() => {
  const targetLocation = location || getMostCommonLocation(appointments);
  return getLocationTimeSlots(targetLocation, 'excel');
}, [location, appointments]);
```

4. Update time slot calculations to use the new ranges:
```javascript
// Before
const isAppointmentInTimeSlot = (appointment, timeSlot) => {
  // Hardcoded calculations
};

// After
const isAppointmentInTimeSlot = (appointment, timeSlot) => {
  const slotRange = TIME_SLOT_RANGES[timeSlot];
  if (!slotRange) return false;
  
  const appStart = new Date(appointment.startTime);
  const appEnd = new Date(appointment.endTime);
  
  const appStartMinutes = appStart.getHours() * 60 + appStart.getMinutes();
  const appEndMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
  
  return (
    (appStartMinutes >= slotRange.start && appStartMinutes < slotRange.end) ||
    (appEndMinutes > slotRange.start && appEndMinutes <= slotRange.end) ||
    (appStartMinutes <= slotRange.start && appEndMinutes >= slotRange.end)
  );
};
```

### For New Components

1. Always use the utility functions instead of hardcoding time slots
2. Accept a `location` prop for maximum flexibility
3. Use the appropriate format for your component's needs
4. Include fallback logic for when location data is missing

## Benefits

1. **Flexibility**: Each location can have different working hours
2. **Scalability**: Easy to add new locations with different schedules
3. **Maintainability**: No code changes needed to update working hours
4. **User Experience**: Users see accurate time slots for their location
5. **Backward Compatibility**: Existing functionality continues to work

## Testing

Use the `LocationTimeSlotDemo` component to test different configurations:

```javascript
import LocationTimeSlotDemo from '../components/schedule/LocationTimeSlotDemo';

// In your test page
<LocationTimeSlotDemo />
```

This demo shows how different locations generate different time slots and allows testing of custom configurations. 