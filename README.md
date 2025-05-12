# Schedulist - ABA Therapy Scheduling System

Schedulist is a comprehensive application designed for ABA therapy clinics to manage scheduling, patient notes, and patient management. It provides different access levels for Admins, BCBAs, and Therapists, with encrypted storage of sensitive patient information.

## Features

- **User Management**: Different roles (Admin, BCBA, Therapist) with appropriate permissions
- **Patient Management**: Add, edit, and manage patient information with encryption
- **Scheduling**: View and manage appointments by day, week, or month
- **Clinical Notes**: Secure note-taking for patient sessions
- **Location Management**: Configure multiple clinical locations
- **Security**: JWT authentication, password management, and encrypted patient data

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcrypt for password hashing, AES-256 for data encryption
- **Frontend**: React with React Router, React Query, React Hook Form, and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- PostgreSQL database

### Backend Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/schedulist.git
   cd schedulist
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a PostgreSQL database named `schedulist`

4. Configure the environment variables by copying `.env.example` to `.env` and updating the values:
   ```
   cp .env.example .env
   ```

5. Initialize the database with default roles and test data:
   For Local Dev I recommend use Docker with postgres latest image should be fine. 
   ```
   npm run db:seed
   ```
   This will create test users with the following credentials:
   - Admin: admin@test.com / Password123
   - BCBA: bcba@test.com / Password123
   - Therapist: therapist@test.com / Password123

6. Start the development server:
   ```
   npm run dev
   ```

### Frontend Installation

1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the React development server:
   ```
   npm run dev
   ```

4. Open your browser to `http://localhost:5173` to see the application

## Test Users

After seeding the database, the following test users are available:

- **Admin User**:
  - Email: admin@test.com
  - Password: Password123

- **BCBA User**:
  - Email: bcba@test.com
  - Password: Password123

- **Therapist User**:
  - Email: therapist@test.com
  - Password: Password123

These users have pre-populated data such as patients, appointments, and notes so you can test the application immediately.

## Frontend Features

The React frontend includes:

### Authentication
- Login with JWT
- Password reset flow
- Protected routes based on user roles

### Therapist View
- Daily/weekly schedule view
- Patient list with filtering
- Patient details with notes and appointments
- Ability to add session notes

### BCBA View
- Side-by-side therapist and patient schedule view
- Therapist management
- Patient assignment
- Dashboard with summary metrics

### Admin View
- User management (Admin, BCBA, Therapist)
- Location management
- Dashboard with system-wide metrics

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user (default role: therapist)
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Patient Endpoints

- `GET /api/patient` - Get all patients (filtered by user role)
- `GET /api/patient/:id` - Get patient by ID
- `POST /api/patient` - Create a new patient (BCBA/Admin only)
- `PUT /api/patient/:id` - Update a patient (BCBA/Admin only)
- `DELETE /api/patient/:id` - Delete/deactivate a patient (BCBA/Admin only)
- `GET /api/patient/:id/notes` - Get patient notes
- `POST /api/patient/:id/notes` - Create a note for a patient

### Schedule Endpoints

- `GET /api/schedule` - Get schedule (daily, weekly, monthly)
- `GET /api/schedule/patient/:patientId` - Get patient's schedule
- `POST /api/schedule` - Create a new appointment (BCBA/Admin only)
- `PUT /api/schedule/:id` - Update an appointment (BCBA/Admin only)
- `DELETE /api/schedule/:id` - Delete an appointment (BCBA/Admin only)

### BCBA Endpoints

- `GET /api/bcba/dashboard` - Get BCBA dashboard summary
- `GET /api/bcba/therapists` - Get therapists managed by this BCBA
- `POST /api/bcba/therapists` - Add a new therapist (BCBA only)
- `PUT /api/bcba/therapists/:id` - Update a therapist
- `POST /api/bcba/therapists/:id/patients` - Assign patients to a therapist

### Therapist Endpoints

- `GET /api/therapist/dashboard` - Get therapist dashboard summary
- `GET /api/therapist/patients` - Get patients assigned to this therapist
- `GET /api/therapist/schedule` - Get therapist's upcoming schedule
- `PUT /api/therapist/appointments/:id/status` - Update appointment status

### Admin Endpoints

- `GET /api/admin/dashboard` - Get admin dashboard summary
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `POST /api/admin/users` - Create a new user
- `PUT /api/admin/users/:id` - Update a user
- `DELETE /api/admin/users/:id` - Delete/deactivate a user
- `GET /api/admin/locations` - Get all locations
- `POST /api/admin/locations` - Create a new location
- `PUT /api/admin/locations/:id` - Update a location
- `DELETE /api/admin/locations/:id` - Delete a location

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **Data Encryption**: Patient PII and notes are encrypted at rest using AES-256
- **JWT Authentication**: Secure API access with JSON Web Tokens
- **Role-Based Access Control**: Different permissions for Admin, BCBA, and Therapist roles
- **HTTPS**: Production deployment should use HTTPS for all communications

## License
Copyright Craig Campbell