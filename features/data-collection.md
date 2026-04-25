# Data Collection (RBT)

## Overview

Enables Registered Behavior Technicians (RBTs) to collect session data during
direct ABA therapy sessions. This includes discrete trial training (DTT) data,
behavior event recording, task analysis tracking, and comprehensive session
documentation. Designed for rapid, minimally-disruptive data entry during
sessions.

## Database Models

### Session

Core session record that groups all data collected during a therapy session.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| therapistId | FK → User | RBT conducting the session |
| bcbaId | FK → User | Supervising BCBA (optional, for session context) |
| appointmentId | FK → Appointment | (nullable) Link to scheduled appointment |
| locationId | FK → Location | |
| sessionDate | DATEONLY | |
| startTime | TIME | |
| endTime | TIME | |
| durationMinutes | Integer | Actual session duration (calculated) |
| status | Enum | `in-progress`, `completed`, `cancelled`, `no-show` |
| sessionType | Enum | `direct`, `group`, `community`, `telehealth`, `parent-training` |
| billable | Boolean | |
| notes | Text | General session notes and observations |
| parentPresent | Boolean | |
| parentInvolved | Boolean | Did parent participate in session |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Therapist')
- belongsTo User (as 'BCBA')
- belongsTo Appointment
- belongsTo Location
- hasMany TrialData
- hasMany BehaviorEvent
- hasMany TaskAnalysisStep
- hasMany ReinforcementRecord
- hasOne IOARecord (if IOA was collected)

### TrialData (DTT recording)

Individual trial data for discrete trial training programs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| sessionId | FK → Session | |
| programId | FK → Program | |
| targetId | FK → ProgramTarget | |
| trialNumber | Integer | Trial number within session for this target |
| antecedent | Text | SD delivered (check: was SD delivered as written) |
| promptLevel | Enum | `full-physical`, `partial-physical`, `model`, `gestural`, `positional`, `visual`, `verbal`, `independent` |
| responseType | Enum | `correct`, `incorrect`, `prompted-correct`, `no-response`, `error`, `correction-trial` |
| latency | Float | Response latency in seconds |
| interTrialInterval | Float | Seconds between trials |
| stimulusItem | String | Which specific stimulus from target stimuli list |
| correctionProcedure | String | Error correction procedure used |
| reinforcement | String | Reinforcer delivered |
| recordedAt | DateTime | Exact timestamp of trial |
| notes | Text | |

**Associations:**
- belongsTo Session
- belongsTo Program
- belongsTo ProgramTarget

### BehaviorEvent (frequency / duration / latency / ABC)

Captures behavior occurrences during session for behavior reduction programs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| sessionId | FK → Session | |
| bipId | FK → BehaviorInterventionPlan | |
| behaviorName | String | Target behavior name |
| eventType | Enum | `frequency`, `duration`, `latency`, `intensity`, `abc-narrative` |
| antecedent | Text | What happened immediately before the behavior |
| behavior | Text | Observable description of what the client did |
| consequence | Text | What happened immediately after the behavior |
| frequency | Integer | Count of discrete occurrences |
| durationSeconds | Integer | Total duration of behavior (if applicable) |
| latencySeconds | Float | Time from SD/trigger to onset of behavior |
| intensity | Enum | `1` through `5` (Likert scale) |
| settingEvent | String | Broader context (e.g. "transition from playground", "skipped snack") |
| staffResponse | Text | How the RBT responded per BIP |
| recordedAt | DateTime | |
| notes | Text | |

**Associations:**
- belongsTo Session
- belongsTo BehaviorInterventionPlan

### TaskAnalysisStep (chaining data)

Records performance on individual steps of a task analysis (forward/backward/total-task chaining).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| programId | FK → Program | |
| sessionId | FK → Session | |
| stepNumber | Integer | Sequential step number |
| stepName | String | e.g. "grasp toothbrush", "apply toothpaste" |
| promptLevel | Enum | Same prompt hierarchy |
| responseType | Enum | `independent`, `prompted`, `error`, `not-observed` |
| chainingType | Enum | `forward`, `backward`, `total-task` |
| createdAt | DateTime | |

**Associations:**
- belongsTo Program
- belongsTo Session

### IOARecord (Inter-Observer Agreement)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| sessionId | FK → Session | |
| primaryObserverId | FK → User | Usually the RBT |
| secondaryObserverId | FK → User | BCBA or peer RBT |
| targetIds | JSON | Array of ProgramTarget UUIDs observed |
| primaryData | JSON | Primary observer's recorded trial data |
| secondaryData | JSON | Secondary observer's recorded trial data |
| agreementPercentage | Float | Calculated IOA percentage |
| agreementType | Enum | `trial-by-trial`, `total-count`, `interval`, `scored-interval` |
| disagreements | JSON | Array of trial numbers where observers disagreed |
| recordedAt | DateTime | |

**Associations:**
- belongsTo Session
- belongsTo User (as 'PrimaryObserver')
- belongsTo User (as 'SecondaryObserver')

### ReinforcementRecord

Tracks what reinforcers were used and their effectiveness during session.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| sessionId | FK → Session | |
| programId | FK → Program | (nullable — may be outside specific program) |
| reinforcerType | Enum | `edible`, `tangible`, `activity`, `social`, `sensory`, `token` |
| reinforcerName | String | e.g. "goldfish crackers", "bubbles", "tickles" |
| schedule | Enum | `continuous`, `FR2`, `FR3`, `FR5`, `VR2`, `VR3`, `VR4`, `VR5`, `variable` |
| effectiveness | Enum | `1` through `5` (1 = ignored, 5 = highly motivating) |
| satiationFlag | Boolean | Child showing signs of satiation |

**Associations:**
- belongsTo Session
- belongsTo Program

## API Endpoints

### Session Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/start` | isTherapist | Start a new session for a patient |
| PUT | `/api/sessions/:id/end` | isTherapist | End session with completion summary |
| GET | `/api/sessions/patient/:patientId` | isBCBA or isTherapist | List sessions for a patient (paginated) |
| GET | `/api/sessions/:id` | isBCBA or isTherapist | Full session detail with all data types |
| PUT | `/api/sessions/:id` | isTherapist | Update session fields (only if in-progress) |
| GET | `/api/sessions/today/therapist/:therapistId` | isTherapist | Today's sessions for an RBT |
| GET | `/api/sessions/date-range` | isBCBA or isTherapist | Sessions within a date range |

### Trial Data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/:sessionId/trials` | isTherapist | Record trial(s) — accepts single or batch array |
| POST | `/api/sessions/:sessionId/trials/batch` | isTherapist | Bulk trial recording (optimized) |
| GET | `/api/sessions/:sessionId/trials` | isBCBA or isTherapist | Get all trials for a session |
| GET | `/api/programs/:programId/trials` | isBCBA or isTherapist | Get trials for a specific program (filterable by date) |
| GET | `/api/targets/:targetId/trials` | isBCBA or isTherapist | Get trials for a specific target |
| DELETE | `/api/trials/:id` | isTherapist | Delete a trial (only within active session window) |

### Behavior Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/:sessionId/behaviors` | isTherapist | Record a behavior event |
| POST | `/api/sessions/:sessionId/behaviors/batch` | isTherapist | Record multiple behavior events |
| GET | `/api/sessions/:sessionId/behaviors` | isBCBA or isTherapist | Get all behavior events for a session |
| GET | `/api/bip/:bipId/behaviors` | isBCBA | Get all behavior data for a BIP across sessions |
| GET | `/api/patients/:patientId/behaviors/summary` | isBCBA or isTherapist | Summary statistics for patient behaviors |

### Task Analysis

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/:sessionId/task-analysis` | isTherapist | Record task analysis steps (batch) |
| GET | `/api/sessions/:sessionId/task-analysis` | isBCBA or isTherapist | Get task analysis data for session |
| GET | `/api/programs/:programId/task-analysis` | isBCBA or isTherapist | Get all task analysis data for program |

### Reinforcement

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/:sessionId/reinforcement` | isTherapist | Log reinforcer use |
| GET | `/api/sessions/:sessionId/reinforcement` | isBCBA or isTherapist | Get reinforcement log for session |
| GET | `/api/patients/:patientId/reinforcer-preferences` | isBCBA or isTherapist | Effective reinforcers summary for patient |

### IOA

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sessions/:id/ioa` | isBCBA | Submit IOA record |
| GET | `/api/sessions/:id/ioa` | isBCBA or isTherapist | Get IOA records for session |
| GET | `/api/therapists/:id/ioa-summary` | isBCBA | IOA summary across sessions for an RBT |
| GET | `/api/patients/:patientId/ioa` | isBCBA | IOA records for a patient |

## Frontend Pages

### `/pages/therapist/SessionPage.jsx`

- Dashboard showing today's scheduled patients
- "Start Session" button per patient
- Active session view:
  - Session timer with real-time duration
  - Active program list (loaded from BCBA's active programs)
  - Quick access to BIP reference panel
  - Data collection shortcuts
- "End Session" flow with summary review
- Session note entry with structured templates
- Parent signature/involvement logging

### `/pages/therapist/DataEntryPage.jsx`

The main data collection interface, optimized for use during active sessions:

- **Trial-by-Trial mode** (DTT):
  - Program/Target selector dropdowns
  - Large tap targets for: Correct (+), Incorrect (-), Prompted (P), No Response (NR)
  - Auto-advance to next trial
  - Configurable inter-trial interval timer
  - Visual trial counter and session progress
  - Quick prompt level adjustment

- **Frequency Counter mode**:
  - Configurable target behaviors from BIP
  - Large +/- tap counters per behavior
  - Total frequency per behavior displayed
  - Optional duration timer per behavior

- **Duration Recording mode**:
  - Start/stop timers per target behavior
  - Running total duration display
  - Can run multiple simultaneous timers

- **ABC Recorder mode**:
  - Quick narrative entry: antecedent → behavior → consequence
  - Template-based quick fill for common scenarios
  - Time-stamped entries

- **Task Analysis mode**:
  - Step-by-step chaining data
  - Tap independent/prompted/error per step
  - Visual step progress

- **Offline capability**: Queue data locally if connection lost, sync when restored

### `/pages/therapist/SessionSummaryPage.jsx`

- Post-session completion summary:
  - Session duration and attendance
  - Programs worked on with trial counts and accuracy
  - Behaviors recorded with frequency/duration totals
  - Reinforcement effectiveness summary
  - Parent involvement notes
- "Submit for BCBA Review" action
- Previous session comparisons

### `/pages/therapist/MyDataPage.jsx`

- Historical view of own data collection
- Filter by patient, date range, program
- Quick stats: total trials, accuracy rate, behavior frequency trends
- IOA records received from BCBA

### Components

- `DTTRecorder.jsx` — Rapid trial recording interface with large touch targets
- `BehaviorCounter.jsx` — Configurable frequency/duration counter for BIP behaviors
- `ABCRecorder.jsx` — Structured ABC narrative entry with templates
- `TaskAnalysisTracker.jsx` — Chaining data collector with visual step progress
- `SessionTimer.jsx` — Timer with start/end/pause/notes
- `BIPQuickReference.jsx` — Condensed BIP view for RBT reference during session
- `ProgramQuickView.jsx` — Current SD, target, prompt level at a glance
- `OfflineDataQueue.jsx` — Queue management for disconnected data entry
- `ReinforcementLogger.jsx` — Track reinforcer type, name, schedule, effectiveness
- `SessionNotesEditor.jsx` — Structured session note templates
- `DataSyncIndicator.jsx` — Shows sync status for offline-queued data

## Workflows

### Typical RBT Session Flow

1. RBT opens SessionPage → sees today's scheduled patients with appointment details
2. Arrives for session → taps patient → taps "Start Session"
3. Session record created, timer starts, active programs load from BCBA's plan
4. RBT references BIP quick view for behavior targets and strategies
5. RBT runs programs throughout session, recording data:
   - DTT: taps correct/incorrect/prompted per trial (1-2 seconds per entry)
   - Behaviors: uses frequency counter or ABC form as events occur
   - Task analysis: records step performance during ADL programs
   - Reinforcement: logs what reinforcers were effective
6. Data syncs to server continuously (with offline queue fallback)
7. Session ends → RBT taps "End Session"
8. Summary screen shows: programs run, trials recorded, behaviors logged
9. RBT adds general session notes, logs parent involvement
10. Submits → data available to BCBA for review immediately

### IOA Collection

1. BCBA schedules IOA observation (or conducts during supervision)
2. Both primary observer (RBT) and secondary observer (BCBA) independently record trial data
3. System captures both data sets for the same session/targets
4. System calculates IOA:
   - Trial-by-trial: agreements / (agreements + disagreements) × 100
   - Total count: smaller count / larger count × 100
   - Interval: agreement intervals / total intervals × 100
   - Scored interval: only intervals where behavior occurred
5. Disagreements flagged with specific trial numbers for discussion
6. IOA record stored and available for BACB documentation

### Offline Data Collection

1. RBT in community setting with poor connectivity
2. Data entry proceeds normally on device
3. Data queued in local storage with timestamps
4. When connectivity restored, DataSyncIndicator shows pending count
5. System syncs queued data in chronological order
6. Server validates each entry against session status
7. Conflicts resolved (latest timestamp wins, with notification)
8. SyncIndicator shows green when fully synced

## Business Rules

- Only RBTs (therapists) can create sessions and record trial/behavior data
- BCBAs can view all data but cannot create trial/behavior records
- Session must be "in-progress" to record data
- Trials cannot be deleted after session is "completed" (BCBA must approve edits)
- IOA records require two distinct observer IDs
- Reinforcement records auto-aggregate for patient preference assessment
- Session notes are encrypted at rest (same pattern as Patient notes)
- All data timestamps recorded in UTC, displayed in user's timezone
