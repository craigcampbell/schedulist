# Supervision & Treatment Fidelity

## Overview

Enables BCBAs to track supervision of RBTs per BACB (Behavior Analyst
Certification Board) requirements, assess treatment fidelity during direct
observation, calculate inter-observer agreement (IOA), document competency
evaluations, manage field training tasks, and maintain supervision logs for
compliance and audit readiness.

## Database Models

### SupervisionSession

Documents each supervision contact between a BCBA and RBT.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| bcbaId | FK → User | Supervising BCBA |
| therapistId | FK → User | RBT being supervised |
| patientId | FK → Patient | (nullable — for group supervision without patient) |
| sessionDate | DateTime | Date and time of supervision |
| durationMinutes | Integer | Actual duration of supervision contact |
| supervisionType | Enum | `direct-observation`, `video-review`, `meeting`, `group`, `remote` |
| supervisionCategory | Enum | `individual` (max 1 supervisee per session), `group` (max 10 supervisees for BACB) |
| groupSize | Integer | Number of supervisees if group supervision |
| topics | JSON | Areas covered: `["skill-acquisition", "behavior-reduction", "ethics", "data-collection", "parent-training", "crisis-management", "professional-conduct"]` |
| notes | Text | Supervision notes and feedback summary |
| actionItems | JSON | Array of follow-up tasks: `[{ task, assignedTo, dueDate, status }]` |
| bcbaSignature | Boolean | BCBA digitally signed |
| therapistSignature | Boolean | RBT acknowledged |
| signatureDate | DateTime | |
| location | String | (nullable — school, clinic, home, community) |
| bacbDocumented | Boolean | Confirmed recorded for BACB compliance purposes |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo User (as 'BCBA')
- belongsTo User (as 'Therapist')
- belongsTo Patient
- hasMany TreatmentFidelityChecklist

### TreatmentFidelityChecklist

Scored fidelity assessment of RBT implementation during direct observation.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| supervisionId | FK → SupervisionSession | |
| programId | FK → Program | (nullable — may assess general competency, not program-specific) |
| checklistType | Enum | `dtt-fidelity`, `naturalistic-fidelity`, `behavior-plan-fidelity`, `preference-assessment-fidelity`, `general-competency` |
| items | JSON | Array of checklist items: `[{ name, description, score (0/1/2/N/A), notes }]` |
| totalScore | Float | Overall fidelity percentage (scored points / total possible points × 100) |
| possibleScore | Integer | Total maximum points (excluding N/A items) |
| scoredPoints | Integer | Points achieved |
| itemCount | Integer | Number of scorable items |
| passingThreshold | Float | Organization-configured threshold (default 90%) |
| passed | Boolean | Did RBT meet threshold |
| feedback | Text | Specific feedback with strengths and areas for improvement |
| recheckDate | Date | If not passed, date for re-evaluation |
| recheckRequired | Boolean | |
| completedAt | DateTime | |

**Associations:**
- belongsTo SupervisionSession
- belongsTo Program

### CompetencyAssessment

Comprehensive competency evaluation of RBT skills across domains.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| therapistId | FK → User | RBT being assessed |
| assessorId | FK → User | BCBA conducting assessment |
| assessmentDate | DateTime | |
| assessmentType | Enum | `initial` (new hire), `annual` (yearly), `remediation` (after performance concerns), `promotion` (career advancement) |
| domains | JSON | Scored categories: `[{ domain, score (1-5), notes, items }]` |
| domainCategories | JSON Array of String | e.g. `["DTT-implementation", "NET-implementation", "behavior-management", "data-collection", "professional-conduct", "parent-communication", "safety"]` |
| overallScore | Float | Weighted average across domains |
| passed | Boolean | |
| remediationPlan | JSON | `{ areas, goals, deadlines, resources, assignedMentor }` |
| nextAssessmentDate | Date | Scheduled next assessment |
| certificateUrl | String | (nullable) Generated competency certificate |
| notes | Text | Overall assessment notes |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo User (as 'Therapist')
- belongsTo User (as 'Assessor')

### SupervisionLog (BACB-compliant monthly record)

Auto-generated monthly summary of supervision activities for BACB compliance.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| bcbaId | FK → User | |
| therapistId | FK → User | |
| month | Integer | 1-12 |
| year | Integer | |
| totalIndividualMinutes | Integer | Sum of individual supervision for this RBT this month |
| totalGroupMinutes | Integer | Sum of group supervision (discounted per BACB rules) |
| adjustedGroupMinutes | Integer | Group minutes adjusted (total / group size, but group maxes at 10) |
| totalSupervisionMinutes | Integer | Individual + adjusted group |
| rbtBillableHours | Float | Total hours the RBT billed this month |
| supervisionPercentage | Float | Supervision minutes / (billable hours × 60) × 100 |
| bacbMinimumMet | Boolean | Is supervision ≥ 5% of billable hours |
| totalSupervisees | Integer | Number of unique supervisees this BCBA supervised this month |
| notes | Text | |
| generatedAt | DateTime | When auto-generated |
| confirmedAt | DateTime | When BCBA reviewed and confirmed |
| confirmedById | FK → User | |

**Associations:**
- belongsTo User (as 'BCBA')
- belongsTo User (as 'Therapist')

### FieldTrainingTask

Structured training assignments for RBT competency development.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| therapistId | FK → User | RBT trainee |
| supervisorId | FK → User | BCBA supervisor |
| taskName | String | e.g. "Complete 5 preference assessments with 90% fidelity" |
| taskCategory | Enum | `assessment`, `dtt-implementation`, `net-implementation`, `behavior-management`, `data-collection`, `parent-training`, `ethics`, `documentation`, `safety` |
| description | Text | Detailed task instructions |
| assignedDate | Date | |
| dueDate | Date | |
| completedDate | Date | When RBT submitted as complete |
| status | Enum | `assigned`, `in-progress`, `submitted`, `approved`, `resubmit` |
| submissionNotes | Text | RBT's evidence and notes |
| supervisorFeedback | Text | BCBA feedback on submission |
| competencyCheckRequired | Boolean | Does this task require a fidelity check or competency assessment |
| linkedCompetencyId | FK → CompetencyAssessment | (nullable) |
| linkedSupervisionId | FK → SupervisionSession | (nullable) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo User (as 'Therapist')
- belongsTo User (as 'Supervisor')
- belongsTo CompetencyAssessment
- belongsTo SupervisionSession

## API Endpoints

### Supervision Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/supervision/sessions` | isBCBA | Log a supervision session |
| GET | `/api/supervision/sessions/bcba/:bcbaId` | isBCBA | List supervision sessions conducted by BCBA |
| GET | `/api/supervision/sessions/therapist/:therapistId` | isBCBA, isTherapist | List supervision sessions for an RBT |
| GET | `/api/supervision/sessions/:id` | isBCBA, isTherapist | Get supervision session detail |
| PUT | `/api/supervision/sessions/:id` | isBCBA | Update supervision session |
| POST | `/api/supervision/sessions/:id/sign` | isBCBA, isTherapist | Add digital signature |
| GET | `/api/supervision/upcoming` | isBCBA | Upcoming supervision needs (RBTs due for supervision) |
| GET | `/api/supervision/compliance` | isBCBA | Supervision compliance dashboard data |

### BACB Hours & Compliance

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/supervision/hours/therapist/:therapistId` | isBCBA | Total supervision hours breakdown for RBT |
| GET | `/api/supervision/hours/bcba/:bcbaId/summary` | isBCBA | Supervision summary for BCBA |
| GET | `/api/supervision/bacb-report/:bcbaId/:year/:month` | isBCBA | BACB-format monthly supervision log |
| POST | `/api/supervision/bacb-report/:bcbaId/:year/:month/confirm` | isBCBA | Confirm monthly report |
| GET | `/api/supervision/bacb-report/:bcbaId/export` | isBCBA | Export all BACB reports for audit |

### Treatment Fidelity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/fidelity/checklists` | isBCBA | Submit a fidelity checklist |
| GET | `/api/fidelity/checklists/:id` | isBCBA, isTherapist | Get checklist detail |
| GET | `/api/fidelity/therapist/:therapistId` | isBCBA | All fidelity scores for an RBT |
| GET | `/api/fidelity/program/:programId` | isBCBA | Fidelity scores for a specific program implementation |
| GET | `/api/fidelity/therapist/:therapistId/trend` | isBCBA | Fidelity trend over time (graph data) |
| PUT | `/api/fidelity/checklists/:id` | isBCBA | Update checklist (e.g. add feedback) |

### Competency Assessments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/competency/assessments` | isBCBA | Create competency assessment |
| GET | `/api/competency/assessments/:id` | isBCBA, isTherapist | Get assessment detail |
| GET | `/api/competency/therapist/:therapistId` | isBCBA | All competency assessments for RBT |
| PUT | `/api/competency/assessments/:id` | isBCBA | Update assessment |
| GET | `/api/competency/therapist/:therapistId/status` | isBCBA, isTherapist | Current competency status and next due date |

### Field Training Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/field-training/tasks` | isBCBA | Assign a training task |
| GET | `/api/field-training/therapist/:therapistId` | isBCBA, isTherapist | List tasks for an RBT |
| GET | `/api/field-training/tasks/:id` | isBCBA, isTherapist | Task detail |
| PUT | `/api/field-training/tasks/:id` | isBCBA, isTherapist | Update task (status, notes) |
| POST | `/api/field-training/tasks/:id/submit` | isTherapist | Submit task for review |
| POST | `/api/field-training/tasks/:id/review` | isBCBA | BCBA reviews and approves/returns |
| GET | `/api/field-training/bcba/:bcbaId/pending` | isBCBA | Tasks pending BCBA review |

## Frontend Pages

### `/pages/bcba/SupervisionDashboard.jsx`

BCBA's command center for supervision management:

- **Compliance Overview**:
  - Supervision percentage per RBT (visual progress bars)
  - Color-coded: green (≥5%), yellow (3-5%, approaching deadline), red (<3%, non-compliant)
  - Total supervision hours this month / required
  - Days remaining in month
- **Supervisee List**:
  - Each RBT with: supervision %, last supervision date, days since last supervision
  - Sortable by any column
  - Quick-action: "Schedule Supervision" button per RBT
- **Upcoming Supervision Needs**:
  - RBTs who are due (no supervision in 7+ days)
  - RBTs with upcoming competency assessment due dates
  - RBTs with pending field training tasks
- **Recent Activity**: Last 10 supervision sessions

### `/pages/bcba/SupervisionSessionPage.jsx`

Log individual or group supervision sessions:

- Select RBT (single or multiple for group)
- Select patient context (optional)
- Date/time picker
- Duration tracker or manual entry
- Supervision type selector
- Topics covered checklist
- Notes and feedback text area
- Action items builder (add tasks with assignee and due date)
- Link to fidelity checklist (opens embedded form)
- Digital signature pad for both BCBA and RBT

### `/pages/bcba/FidelityChecklistPage.jsx`

Treatment fidelity assessment:

- Checklist type selector (DTT, NET, BIP, preference assessment, general)
- Template library with standard BACB-recommended items:
  - DTT: "Secures attention before SD", "Delivers clear SD", "Uses appropriate prompt within hierarchy", "Delivers reinforcement within 1-2s", "Records data immediately", etc.
  - NET: "Follows child's motivation (MO)", "Embeds teaching in natural activities", "Provides natural reinforcement", "Uses natural environment SDs", etc.
  - BIP: "Implements antecedent strategies before behavior", "Responds to behavior per BIP", "Uses calm neutral tone", "Provides reinforcement for replacement behavior", etc.
- Each item scored: 2 (fully correct), 1 (partially correct), 0 (incorrect), N/A
- Auto-calculated percentage with pass/fail against threshold
- Feedback fields: strengths, areas for improvement, specific examples
- If failed: re-check scheduling with recommended training tasks
- Print/export checklist with signatures

### `/pages/bcba/CompetencyAssessmentPage.jsx`

Comprehensive RBT competency evaluation:

- Assessment type and RBT selection
- Domain-by-domain assessment with expandable sections
- Each domain: scored items with behavioral descriptions
- Auto-calculated domain scores and overall
- Radar chart visualization of domain scores
- Pass/fail determination
- Remediation plan builder:
  - Identify specific skill gaps
  - Assign field training tasks
  - Set deadline for re-assessment
- Competency certificate generation (PDF)
- Historical comparison (show improvement from last assessment)

### `/pages/bcba/FieldTrainingPage.jsx`

Manage RBT training and development:

- Assign tasks to individual RBTs
- Task template library (common ABA training tasks)
- Track progress: assigned → in-progress → submitted → approved
- Review submissions with embedded feedback
- Link tasks to competency assessments
- Bulk assign tasks (e.g. all new RBTs get standard onboarding tasks)

### `/pages/therapist/MySupervisionPage.jsx`

RBT's view of their own supervision and development:

- Supervision history log (all sessions received)
- Hours breakdown: individual, group, total, percentage
- BACB compliance progress (am I meeting 5% this month)
- Upcoming scheduled supervisions
- Feedback history from BCBA
- Field training tasks:
  - Assigned tasks with due dates and status
  - Submit evidence for completed tasks
  - View BCBA feedback
- Competency assessment results:
  - Domain scores
  - Areas for improvement
  - Next assessment date
- Professional development timeline

### Components

- `SupervisionHourTracker.jsx` — Visual progress bar for BACB 5% minimum
- `SupervisionComplianceGauge.jsx` — Gauge showing supervision percentage for each RBT
- `FidelityChecklistForm.jsx` — Scored checklist with behavioral anchors and auto-calculation
- `CompetencyRadarChart.jsx` — Radar/spider chart of competency domain scores
- `SupervisionCalendar.jsx` — Calendar view of supervision sessions and upcoming needs
- `BACBReportGenerator.jsx` — Generate BACB-compliant monthly supervision log
- `FieldTrainingProgress.jsx` — Kanban-style task progress board
- `TaskTemplateLibrary.jsx` — Browse and select training task templates
- `DigitalSignaturePad.jsx` — Signature capture component for BCBA and RBT sign-off
- `ActionItemsList.jsx` — List of follow-up action items with status tracking
- `SupervisionNotifications.jsx` — In-app reminders for upcoming/due supervisions

## Workflows

### Monthly Supervision Compliance

1. BCBA opens SupervisionDashboard at start of month
2. Dashboard shows all RBT supervisees with:
   - Current month's supervision minutes / required minutes
   - Each RBT's billable hours (pulled from Session data)
   - Supervision percentage = supervision minutes / (billable hours × 60 min)
   - Color-coded status: green (≥5%), yellow (2-5%), red (<2%)
3. BCBA schedules supervisions for the month based on:
   - BACB minimum (5% of hours)
   - Organizational policy (may require more)
   - RBTs with low percentages get priority
   - RBTs overdue for supervision (>2 weeks) flagged
4. Throughout month, BCBA logs each supervision session
5. System calculates running totals, updates compliance gauges
6. End of month: system auto-generates BACB supervision log
7. BCBA reviews, confirms, exports for records (PDF)

### Treatment Fidelity Check

1. BCBA schedules or conducts ad-hoc direct observation of RBT running session
2. During or after observation, opens FidelityChecklistPage:
   - Selects checklist type (DTT fidelity)
   - Program-specific items load
3. BCBA scores each item based on observation:
   - "Secures attention before SD" — 2 (consistently)
   - "Delivers clear SD" — 2
   - "Uses appropriate prompt within hierarchy" — 1 (sometimes jumps to full physical)
   - "Delivers reinforcement within 1-2 seconds" — 2
   - "Records data immediately after trial" — 0 (forgets to record until end of program)
4. System calculates: scored 7/10 possible = 70% fidelity
5. Threshold is 90%, so result is "Did Not Pass"
6. BCBA adds specific feedback:
   - "Great attention-getting and SD delivery"
   - "Practice using least-to-most prompting consistently"
   - "Record data immediately after each trial — this is critical for data integrity"
7. BCBA sets re-check date (2 weeks) and assigns field training tasks:
   - "Prompt hierarchy review with video examples"
   - "Self-monitor data recording for 3 sessions with check-in"
8. Fidelity record saved → RBT sees results in MySupervisionPage
9. Re-check scheduled → system reminds BCBA when due

### Annual Competency Assessment

1. System alerts BCBA that RBT's annual competency assessment is due (30 days before)
2. BCBA schedules assessment session
3. During assessment, BCBA observes RBT across multiple domains:
   - DTT implementation
   - NET/naturalistic teaching
   - Behavior management
   - Data collection
   - Professional and ethical conduct
4. BCBA scores each domain with structured items
5. System calculates:
   - Per-domain scores
   - Overall competency score
   - Comparison to previous assessment
6. Radar chart visualizes strengths (DTT, data collection) and gaps (parent communication)
7. If passed:
   - Certificate generated (PDF)
   - Next annual assessment date set
   - Documented for personnel file
8. If not passed (any domain below threshold):
   - Remediation plan created
   - Specific field training tasks assigned
   - Re-assessment scheduled (30-60 days)
   - BCBA increases supervision frequency during remediation

### Field Training Task Lifecycle

1. BCBA identifies skill gap (from fidelity check, competency assessment, or observation)
2. BCBA creates or selects field training task from template library:
   - "Complete 5 preference assessments using paired-stimulus method with 90% fidelity"
   - Assigns due date, links to relevant competency domain
3. RBT sees task in MySupervisionPage → "New Training Task Assigned"
4. RBT works on task during sessions → marks as "In Progress"
5. When ready, RBT clicks "Submit":
   - Uploads evidence (video clip, BCBA observation note, self-assessment)
   - Adds notes on completion
6. Task status changes to "Submitted" → BCBA gets notification
7. BCBA reviews submission:
   - Approves: adds feedback, marks as complete
   - Returns for revision: provides specific improvement notes
8. If competency check required, BCBA schedules fidelity observation
9. All tasks logged in RBT's professional development record

## Business Rules

- BCBAs can supervise RBTs within their own organization only
- Group supervision caps at 10 supervisees (BACB limit)
- Group supervision minutes adjusted: total minutes / group size, max group size 10
- Supervision percentage calculated monthly, not rolling
- BACB minimum is 5% of billable hours per RBT per month
- Organizations can set higher supervision minimums than BACB requirement
- Fidelity checklists use configurable passing thresholds (organization setting, default 90%)
- Competency assessments required: initial (within 30 days of hire), annual (every 12 months)
- Remediation assessments required when RBT fails fidelity check 3 times in any category
- All supervision sessions, fidelity checks, and competency assessments are audit-logged
- Digital signatures required for supervision sessions (regulatory compliance)
- BACB supervision logs must be confirmed by BCBA before month-end
- Field training tasks auto-escalate if past due date (notify BCBA)

## Integration with Existing Models

- **User** — BCBA (role: bcba) and RBT (role: therapist) are existing user roles
- **Patient** — Supervision can be linked to a specific patient context
- **Session** — RBT billable hours pulled from Session data for compliance calculations
- **Program** — Fidelity checklists can be program-specific
- **BehaviorInterventionPlan** — BIP fidelity checks reference existing BIPs
- **Audit** — All supervision, fidelity, competency, and training activities are logged
- **Organization** — Supervision thresholds configurable per organization
- **Appointment** — Supervision sessions can link to scheduled appointments
- **Team** — Supervision context can include team-level oversight
