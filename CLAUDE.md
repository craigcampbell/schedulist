# Schedulist Project Guidelines

This document contains important information about the project structure, conventions, and patterns used in the Schedulist application.

## Project Overview

Schedulist is a comprehensive SaaS platform for managing ABA (Applied Behavior Analysis) therapy services. It provides scheduling, patient management, team coordination, and compliance tracking for behavioral therapy organizations.

### Key Features
- **Multi-tenant Architecture**: Each organization gets their own subdomain
- **Role-based Access Control**: Admin, BCBA, and Therapist roles with specific permissions
- **Encrypted Patient Data**: HIPAA-compliant encryption for sensitive information
- **Flexible Scheduling**: Location-specific working hours and time slots
- **Team Management**: BCBAs lead teams of therapists assigned to patients
- **Appointment Tracking**: Various service types with automatic conflict detection
- **Audit Trail**: Comprehensive logging for compliance requirements

## Project Structure

- `/client` - React frontend application
- `/schedulist` - Node.js/Express backend API
- Database: PostgreSQL with Sequelize ORM

## Key Technologies

### Frontend
- React with Vite
- React Query for data fetching
- React Router for navigation
- Tailwind CSS for styling
- Lucide React for icons
- Context API for global state

### Backend
- Express.js
- Sequelize ORM
- JWT authentication
- Role-based access control (RBAC)

## Important Patterns and Conventions

### Modal System

The application uses a custom modal system instead of native browser dialogs. This provides a consistent, themed user experience.

#### Setup
The modal system is provided through a context that wraps the entire application. It's already configured in `main.jsx`.

#### Usage

```jsx
import { useModal } from '../../context/modal-context';

function MyComponent() {
  const modal = useModal();
  
  // Simple alert
  await modal.alert('Operation completed!');
  
  // Alert with type (info, warning, error, success)
  await modal.alert('An error occurred', 'Error', 'error');
  
  // Confirmation dialog
  const confirmed = await modal.confirm('Are you sure?');
  if (confirmed) {
    // User clicked confirm
  }
  
  // Delete confirmation (special case with destructive styling)
  const confirmed = await modal.confirmDelete('Team Alpha');
  
  // Custom modal with multiple buttons
  await modal.showModal({
    title: 'Custom Action',
    message: 'Choose an option:',
    type: 'info',
    buttons: [
      { label: 'Cancel', variant: 'outline' },
      { label: 'Save', variant: 'default' },
      { label: 'Delete', variant: 'destructive' }
    ]
  });
}
```

**Important**: Always use the modal system instead of `window.alert()` or `window.confirm()` for consistency.

### Authentication & Authorization

- JWT tokens stored in localStorage
- Role-based routes: admin, bcba, therapist
- Auth context provides user info and role checking helpers

### API Client

The frontend uses a configured Axios instance (`/client/src/api/client.js`) that:
- Automatically adds auth tokens
- Handles token expiration
- Logs requests/responses in development

### Team Management

Teams represent BCBA-therapist relationships:
- Each team has one lead BCBA
- Teams can have multiple therapist members
- Therapists can only belong to one team at a time
- Teams are automatically created during data seeding based on patient assignments

### Database Relationships

Key relationships to understand:
- Organizations have many Users, Locations, and Patients
- BCBAs are assigned to Patients
- Therapists are assigned to Patients through BCBAs
- Teams group Therapists under a lead BCBA
- Appointments can be direct (with patient) or indirect (without patient)

### Core Database Models

1. **User**: Stores all system users with role assignments
   - Fields: firstName, lastName, email, password (hashed), roleId, organizationId
   - Relations: belongsTo Organization, belongsTo Role, hasMany Appointments

2. **Patient**: Encrypted patient records
   - Encrypted fields: firstName, lastName, dateOfBirth, phone, address, insurance info
   - Clinical fields: requiredWeeklyHours, approvedHours, approvedHoursStartDate/EndDate
   - Relations: belongsTo Organization, hasOne primaryBCBA, hasMany Appointments

3. **Team**: Groups therapists under a BCBA lead
   - Fields: name, leadBcbaId, color
   - Relations: belongsTo User (as LeadBCBA), hasMany TeamMembers

4. **Appointment**: Scheduling records
   - Fields: startTime, endTime, status, serviceType, therapistId, bcbaId, patientId, locationId
   - Service types: direct, indirect, supervision, lunch, circle, cleaning
   - Relations: belongsTo User (therapist/bcba), belongsTo Patient, belongsTo Location

5. **Location**: Physical therapy locations
   - Fields: name, address, workingHoursStart, workingHoursEnd, slotDuration
   - Relations: belongsTo Organization, hasMany Appointments

6. **Organization**: Multi-tenant organizations
   - Fields: name, slug (for subdomain), subscriptionStatus, trialEndDate
   - Relations: hasMany Users, hasMany Patients, hasMany Locations

### Appointment Types

Service types and their patient requirements:
- `direct` - Requires patient
- `indirect` - No patient (admin work)
- `supervision` - No patient
- `lunch` - No patient
- `circle` - Requires patient
- `cleaning` - No patient

### Development Ports

- Frontend: http://localhost:5173
- Backend: http://localhost:5050
- Note: Port 5000 may conflict with Apple AirPlay

### Testing Commands

When making changes, always run:
```bash
npm run lint
npm run typecheck
```

### Seed Data

The application includes comprehensive seed data generation:
```bash
npm run db:seed
```

This creates:
- Organizations with realistic names
- Users with different roles
- Patients with schedules
- Teams based on BCBA-patient assignments
- Appointments following business rules

### Git Commit Convention

Commits should be descriptive and include the component/area affected:
- `fix: Date object rendering error in TeamScheduleView`
- `feat: Add team management for admin users`
- `refactor: Replace native dialogs with modal system`

## Common Issues & Solutions

### Port Conflicts
If you get EADDRINUSE errors, check if Apple AirPlay is using port 5000:
```bash
lsof -i :5000
```

### Database Associations
Team associations must be properly initialized. Check `/schedulist/src/models/index.js` for association setup.

### Authentication Errors
If you get 401/403 errors, check:
1. Token is present in localStorage
2. User has required role for the route
3. Token hasn't expired

## Business Rules & Constraints

### User Roles & Permissions

1. **Admin**
   - Full system access
   - Can manage all users, teams, locations, and settings
   - Can view and modify all schedules
   - Exempt from subscription requirements

2. **BCBA (Board Certified Behavior Analyst)**
   - Can manage their assigned patients
   - Can manage therapists assigned to their patients
   - Can create and lead teams
   - Can view and modify schedules for their patients/therapists

3. **Therapist**
   - Can view their own schedule
   - Can view their assigned patients
   - Can only belong to one team at a time
   - Limited modification capabilities

### Scheduling Rules

1. **Appointment Overlaps**: The system prevents double-booking
2. **Service Type Requirements**: Some appointment types require a patient, others don't
3. **Time Slots**: Appointments are scheduled in specific time blocks
4. **Location-based**: Appointments are tied to specific locations

### Data Encryption

Patient data includes encrypted fields:
- Sensitive information is encrypted at rest
- Decryption happens at the application layer
- Never log or expose decrypted patient data

## Code Style Guidelines

### React Components

1. Use functional components with hooks
2. Extract reusable logic into custom hooks
3. Keep components focused and single-purpose
4. Use proper prop validation

### State Management

1. **Local State**: useState for component-specific state
2. **Global State**: Context API for auth, theme, modals
3. **Server State**: React Query for API data
4. **Form State**: Controlled components with proper validation

### Error Handling

1. API errors should show user-friendly messages via modals
2. Use try-catch blocks for async operations
3. Log errors in development, sanitize in production
4. Always handle loading and error states in UI

### File Organization

```
/client/src/
  /api/          - API client functions
  /components/   - Reusable UI components
  /context/      - React contexts
  /layouts/      - Page layouts
  /pages/        - Route pages organized by role
  /lib/          - Utility functions
  /hooks/        - Custom React hooks
```

## Performance Considerations

1. **Query Invalidation**: Be specific about what to invalidate
2. **Pagination**: Use for large lists (patients, appointments)
3. **Lazy Loading**: Consider for role-specific components
4. **Memoization**: Use React.memo for expensive renders

## Security Best Practices

1. **Never trust client input**: Validate on backend
2. **Role checks**: Always verify permissions on backend
3. **Sensitive data**: Never store in localStorage/sessionStorage
4. **API tokens**: Use httpOnly cookies in production
5. **SQL Injection**: Use parameterized queries (Sequelize handles this)

## Debugging Tips

### Frontend Debugging
```javascript
// API Client logs all requests/responses
// Check browser console for detailed logs

// React Query DevTools available in development
// Shows cache state and active queries
```

### Backend Debugging
```javascript
// Check server console for SQL queries
// Sequelize logs all database operations

// Use debug mode for detailed errors:
DEBUG=* npm run dev
```

### Common Debugging Scenarios

1. **"No data showing"**
   - Check React Query cache keys
   - Verify API endpoint is correct
   - Check role permissions

2. **"Changes not updating"**
   - Ensure query invalidation after mutations
   - Check if component is re-rendering
   - Verify optimistic updates

3. **"Authentication issues"**
   - Check token in localStorage
   - Verify token hasn't expired
   - Check role-based route guards

## Testing Approach

While formal tests aren't implemented yet, when testing:

1. **Manual Testing Flow**:
   - Test as each role type
   - Test edge cases (empty states, errors)
   - Test on different screen sizes
   - Test dark/light theme

2. **API Testing**:
   - Use Postman or similar
   - Test with valid/invalid tokens
   - Test role-based access
   - Test data validation

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5050  # Not needed if using proxy
```

### Backend (.env)
```
NODE_ENV=development
PORT=5050
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/schedulist
```

## Migration & Deployment Notes

1. **Database Migrations**: Run in order, never skip
2. **Seed Data**: Only for development/testing
3. **Production Build**: 
   ```bash
   cd client && npm run build
   cd ../schedulist && npm start
   ```

## Known Issues & Workarounds

1. **Port 5000 Conflict**: Apple AirPlay uses this port
   - Solution: Use port 5050 or kill AirPlay process

2. **Team Association Errors**: Duplicate association definitions
   - Solution: Define associations in model files, not index.js

3. **Date/Time Handling**: Timezone considerations
   - Always store in UTC, display in user's timezone

## Common API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/profile` - Get current user profile
- `POST /auth/logout` - Logout user
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

### Admin Endpoints
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/teams` - List all teams
- `POST /api/admin/teams` - Create new team
- `GET /api/admin/locations` - List all locations
- `POST /api/admin/locations` - Create new location

### BCBA Endpoints
- `GET /api/bcba/patients` - List BCBA's patients
- `GET /api/bcba/therapists` - List therapists under BCBA
- `POST /api/bcba/appointments` - Create appointment
- `PUT /api/bcba/appointments/:id` - Update appointment

### Schedule Endpoints
- `GET /api/schedule/appointments` - Get appointments (filtered by date/user)
- `POST /api/schedule/appointments` - Create appointment
- `PUT /api/schedule/appointments/:id` - Update appointment
- `DELETE /api/schedule/appointments/:id` - Delete appointment
- `GET /api/schedule/conflicts` - Check for scheduling conflicts

## Common Development Workflows

### Adding a New Feature
1. Check CLAUDE.md for project conventions
2. Use TodoWrite tool to plan implementation steps
3. Search codebase for similar patterns using Grep/Glob
4. Implement feature following existing patterns
5. Use modal system for user feedback
6. Run lint and typecheck before committing

### Debugging Tips
1. Check browser console for API request/response logs
2. Verify JWT token in localStorage
3. Check user role permissions for endpoints
4. Use React Query DevTools to inspect cache
5. Check server logs for SQL queries and errors

### Working with Schedules
1. Always consider timezone handling (store UTC, display local)
2. Use location-specific time slots from utils
3. Check for appointment conflicts before saving
4. Handle different service types appropriately
5. Consider team assignments when scheduling

## Future Considerations

- The modal system can be extended to support custom input prompts
- Team colors could be expanded beyond the current palette
- Consider adding team-based scheduling views
- Implement WebSocket for real-time schedule updates
- Add audit logging for compliance
- Consider implementing soft deletes for data retention
- Add bulk scheduling operations
- Implement recurring appointment templates
- Add patient progress tracking
- Consider integration with insurance billing systems

## Quick Reference

### Common Commands
```bash
# Start development servers
npm run dev:full           # Starts both frontend and backend

# Database operations
npm run db:seed           # Seed database with test data
npm run db:seed:mjs       # Alternative seed script

# Code quality
npm run lint              # Run linter
npm run typecheck         # Run type checking

# Individual servers
npm run client            # Start frontend only
npm run server            # Start backend only
```

### Default Ports
- Frontend: http://localhost:5173
- Backend: http://localhost:5050

### Test Credentials (Development Only)
After running seed script, you can login with:
- Admin: Check seed output for generated emails
- Password: Usually 'password123' for seeded users

### Environment Variables
Required in `.env`:
```
NODE_ENV=development
PORT=5050
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/schedulist
```

## Recent Fixes

### PatientScheduleGrid - todaysAppointments undefined
- **Issue**: Component was referencing `todaysAppointments` without defining it
- **Fix**: Added `useMemo` to filter appointments for selected date
- **Date**: 2025-08-01
- **Files**: `/client/src/components/schedule/PatientScheduleGrid.jsx`