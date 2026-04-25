# Program Management (BCBA)

## Overview

Enables Board Certified Behavior Analysts (BCBAs) to create, manage, and track
individualized behavior intervention programs and skill acquisition plans for
patients. This is the core clinical authoring tool for ABA therapy.

## Database Models

### Program

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| name | String | e.g. "Mand Training Level 2" |
| programType | Enum | `skill_acquisition`, `behavior_reduction`, `parent_training`, `social_skills`, `adaptive_living` |
| domain | Enum | `communication`, `social`, `motor`, `adaptive`, `cognitive`, `academic`, `behavioral` |
| assessmentSource | Enum | `vb-mapp`, `ablls-r`, `afls`, `peak`, `essentials-for-living`, `custom` |
| assessmentMilestone | String | e.g. "VB-MAPP Milestone 6-M" |
| status | Enum | `draft`, `active`, `maintenance`, `mastered`, `discontinued`, `on-hold` |
| description | Text | Clinical description of the program |
| antecedent | Text | SD / instruction delivered (discriminative stimulus) |
| generalizationStatus | Enum | `not-started`, `in-progress`, `across-people`, `across-settings`, `across-stimuli`, `generalized` |
| masteredAt | DateTime | When all targets reached mastery |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| createdById | FK → User | BCBA who created the program |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Creator', FK: createdById)
- hasMany ProgramTarget
- hasMany ProgramPhaseChange
- hasMany TrialData

### ProgramTarget (test criteria tiers)

Each target within a program defines a specific skill to teach with mastery criteria.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| programId | FK → Program | |
| targetName | String | e.g. "mands for 5 preferred edibles" |
| targetOrder | Integer | Sequence within program |
| promptLevel | Enum | `full-physical`, `partial-physical`, `model`, `gestural`, `positional`, `visual`, `verbal`, `independent` |
| masteryCriterion | JSON | `{ type: "percentage"|"consecutive"|"rate", value: 80, acrossDays: 3, acrossPeople: 2, acrossSettings: 2 }` |
| measurementType | Enum | `trial-by-trial`, `cold-probe`, `first-trial`, `naturalistic` |
| targetStimuli | JSON | Array of stimulus items being taught |
| discriminationTargets | JSON | Distractor / discrimination trial configuration |
| reinforcementSchedule | Enum | `continuous`, `FR2`, `FR3`, `FR5`, `VR2`, `VR3`, `variable` |
| currentPhase | String | Teaching phase (e.g. "massed trials", "mixed trials", "natural environment") |
| masteryStatus | Enum | `not-started`, `in-progress`, `mastered`, `in-maintenance`, `regressed` |
| masteredDate | DateTime | |
| generalizationTargets | JSON | Settings, people, materials for generalization |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo Program
- hasMany TrialData
- hasMany IOARecord (via JSON targetIds)

### ProgramPhaseChange

Tracks every modification to a program or target for clinical decision audit.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| programId | FK → Program | |
| targetId | FK → ProgramTarget | (nullable — null means program-level change) |
| fromPhase | String | |
| toPhase | String | |
| changedById | FK → User | |
| reason | Text | Clinical rationale for the change |
| changedAt | DateTime | |

**Associations:**
- belongsTo Program
- belongsTo ProgramTarget
- belongsTo User (as 'ChangedBy')

### BehaviorInterventionPlan (BIP)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| name | String | |
| status | Enum | `draft`, `active`, `under-review`, `discontinued` |
| targetBehaviors | JSON | Array of behavior definitions with operational definitions |
| antecedents | JSON | Documented common antecedents/triggers |
| functions | JSON | Hypothesized functions (attention, escape, tangible, sensory) |
| replacementBehaviors | JSON | Functionally-equivalent replacement behaviors to teach |
| proactiveStrategies | Text | Antecedent interventions and environmental modifications |
| reactiveStrategies | Text | Consequence strategies for when behavior occurs |
| crisisPlan | Text | Emergency/crisis procedures |
| dataCollectionMethod | JSON | Instructions for RBT on how to collect data |
| approvedAt | DateTime | |
| approvedById | FK → User | |
| reviewDate | DateTime | Scheduled review date |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| createdById | FK → User | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Creator')
- belongsTo User (as 'Approver')
- hasMany BehaviorEvent

## API Endpoints

### Programs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/programs/patient/:patientId` | isBCBA or isTherapist | List all programs for a patient |
| GET | `/api/programs/:id` | isBCBA or isTherapist | Get program with all targets and phase history |
| POST | `/api/programs` | isBCBA | Create a new program |
| PUT | `/api/programs/:id` | isBCBA | Update program details |
| DELETE | `/api/programs/:id` | isBCBA | Soft-delete program (sets status to discontinued) |
| POST | `/api/programs/:id/targets` | isBCBA | Add a new target to a program |
| PUT | `/api/programs/:id/targets/:targetId` | isBCBA | Update target details |
| DELETE | `/api/programs/:id/targets/:targetId` | isBCBA | Remove target from program |
| POST | `/api/programs/:id/targets/:targetId/master` | isBCBA | Mark target as mastered (triggers phase change) |
| POST | `/api/programs/:id/targets/:targetId/regress` | isBCBA | Mark target as regressed |
| GET | `/api/programs/:id/phase-history` | isBCBA | Get full phase change history |
| GET | `/api/programs/templates` | isBCBA | List organizational program templates |
| POST | `/api/programs/templates` | isBCBA | Create a program template |
| POST | `/api/programs/templates/:templateId/apply/:patientId` | isBCBA | Apply a template to a patient |

### BIPs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bip/patient/:patientId` | isBCBA or isTherapist | Get all BIPs for a patient |
| GET | `/api/bip/:id` | isBCBA or isTherapist | Get BIP with full detail |
| POST | `/api/bip` | isBCBA | Create a new BIP |
| PUT | `/api/bip/:id` | isBCBA | Update BIP |
| POST | `/api/bip/:id/approve` | isBCBA | Approve BIP for implementation |
| POST | `/api/bip/:id/discontinue` | isBCBA | Discontinue BIP |
| GET | `/api/bip/:id/behavior-data` | isBCBA | Get behavior data associated with BIP |

## Frontend Pages

### `/pages/bcba/ProgramBuilderPage.jsx`

- Program list with filters by status, domain, assessment source
- Program creation wizard with assessment milestone browser (VB-MAPP, ABLLS-R grids)
- Target builder with mastery criteria configuration
- Phase change history timeline
- Program template library
- "Apply to patient" for templates
- Bulk target import/export

### `/pages/bcba/BIPBuilderPage.jsx`

- BIP creation multi-step wizard
- Behavior definition builder with operational definition guidance
- Function matrix based on ABC analysis
- Evidence-based strategy library
- Approval workflow with version history
- Crisis plan builder

### `/pages/bcba/ProgramTemplatesPage.jsx`

- Organization-wide program template library
- Template CRUD with versioning
- Import/export between organizations
- Preview before applying to patient

### Components

- `ProgramTargetForm.jsx` — Target creation with mastery criteria setup
- `MasteryCriteriaConfig.jsx` — Visual criteria builder (percentage, consecutive days, across people/settings)
- `AssessmentMilestonePicker.jsx` — Browse and search assessments by domain, level, milestone
- `BehaviorDefinitionBuilder.jsx` — Wizard for creating operational behavior definitions
- `ProgramPhaseTimeline.jsx` — Visual timeline of all phase changes for a program
- `ProgramStatusBadge.jsx` — Color-coded status indicator (active, mastered, discontinued)
- `StrategyLibrary.jsx` — Searchable library of evidence-based antecedent and consequence strategies
- `BIPApprovalFlow.jsx` — Approval status tracker with signatures

## Workflows

### Create Skill Acquisition Program

1. BCBA selects patient → navigates to Programs tab → clicks "New Program"
2. Chooses assessment source (VB-MAPP, ABLLS-R, etc.) → browses milestone grid
3. Selects relevant milestone → auto-populates program context
4. Defines program details:
   - Name, description
   - SD (instruction delivered)
   - Materials needed
   - Setting for teaching
   - Domain (communication, social, adaptive, etc.)
5. Adds targets:
   - Target name and order
   - Starting prompt level
   - Mastery criterion: measurement type, percentage threshold, consecutive days, people/settings
   - Reinforcement schedule
   - Target stimuli list
6. Sets generalization targets (people, settings, materials)
7. Sets status to "active" → RBTs see program in their session data collection interface
8. All changes recorded in phase change history and audit log

### Create Behavior Intervention Plan

1. BCBA opens patient → BIPs tab → "New BIP"
2. Defines target behavior(s):
   - Behavior name
   - Operational definition (observable, measurable)
   - Examples and non-examples
3. Documents antecedent triggers from FBA data
4. Identifies hypothesized function (attention, escape, tangible, sensory)
5. Selects replacement behavior(s) — functionally equivalent, easier to perform
6. Writes proactive strategies (environmental modifications, visual supports, priming)
7. Writes reactive strategies (what to do when behavior occurs, what NOT to do)
8. Sets crisis plan if behavior poses safety risk
9. Specifies data collection method for RBTs
10. Reviews and approves → RBTs see BIP in their session reference panel
11. BIP scheduled for review date → system alerts when review is due

### Modify Program Based on Data

1. BCBA reviews patient progress dashboard → identifies program with plateau
2. Opens program → views phase history and recent trial data
3. Makes clinical decision:
   - Modify prompt level (increase or decrease hierarchy)
   - Change reinforcement schedule
   - Add discrimination targets
   - Switch measurement type
   - Move to natural environment if mastered in structured setting
4. Records phase change with clinical rationale
5. New phase activates → RBT sees updated procedures at next session

## Integration with Existing Models

- **Patient** — programs and BIPs are child records of patient; encrypted patient data remains secure
- **User** — BCBA creates and manages; RBT reads for session guidance; admin can view
- **Note** — session notes reference program/BIP IDs for context
- **Audit** — all create, update, delete, approve, phase change operations are logged
- **Appointment** — sessions link to programs via TrialData

## Business Rules

- Only BCBAs (and admins) can create/modify/delete programs and BIPs
- Therapists can read active programs and BIPs for their assigned patients only
- A program with all targets mastered auto-transitions to "mastered" status
- Mastered targets move to maintenance after 2 weeks of generalization data
- BIPs require approval before they appear in RBT session view
- Phase changes require clinical rationale (cannot be blank)
- Program templates are organization-scoped (not shared across orgs unless explicitly exported)
- BIPs must be reviewed at least every 6 months (system enforces via reviewDate)
