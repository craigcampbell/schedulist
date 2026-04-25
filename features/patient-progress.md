# Patient Progress Tracking

## Overview

Comprehensive progress monitoring and visualization system for tracking skill
acquisition, behavior reduction, and overall treatment plan effectiveness across
time. Serves BCBAs (detailed clinical analysis), RBTs (session-level view), and
parents (simplified view via parent portal). This is the analytics layer that
transforms raw data collection into actionable clinical insights.

## Database Models

### SkillAcquisitionProgress

Pre-calculated aggregate data for efficient graphing and trend analysis.
Computed periodically or on-demand from TrialData.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| programId | FK → Program | |
| targetId | FK → ProgramTarget | |
| periodType | Enum | `daily`, `weekly`, `monthly`, `quarterly` |
| periodStart | Date | |
| periodEnd | Date | |
| totalTrials | Integer | |
| correctTrials | Integer | Independent correct responses |
| promptedTrials | Integer | Correct with prompt |
| incorrectTrials | Integer | |
| noResponseTrials | Integer | |
| independentPercentage | Float | correctTrials / totalTrials × 100 |
| promptedPercentage | Float | promptedTrials / totalTrials × 100 |
| averageLatency | Float | Mean response latency in seconds |
| trendDirection | Enum | `improving`, `stable`, `declining`, `variable` |
| trendSlope | Float | Statistical slope of the data path (linear regression) |
| variabilityIndex | Float | Measure of data variability (range / mean) |
| phaseChangeCount | Integer | Number of phase changes within this period |
| trialsPerSession | Float | Average trials per session |
| dataPointsCount | Integer | Number of sessions with data |
| calculatedAt | DateTime | When this aggregate was computed |

**Associations:**
- belongsTo Patient
- belongsTo Program
- belongsTo ProgramTarget

**Indexes:** Patient + Program + Target + PeriodType + PeriodStart (for efficient graphing queries)

### BehaviorProgress

Pre-calculated aggregates from BehaviorEvent data for behavior reduction
tracking and trend analysis.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| bipId | FK → BehaviorInterventionPlan | |
| behaviorName | String | (denormalized for query performance) |
| periodType | Enum | `daily`, `weekly`, `monthly` |
| periodStart | Date | |
| periodEnd | Date | |
| totalFrequency | Integer | |
| totalSessionsInPeriod | Integer | |
| averagePerHour | Float | Frequency / total session hours |
| averagePerSession | Float | Frequency / total sessions |
| totalDurationSeconds | Integer | (for duration-based behaviors) |
| averageDuration | Float | Mean duration per occurrence |
| trendDirection | Enum | `improving`, `stable`, `worsening`, `variable` |
| baselineAverage | Float | Pre-intervention average rate |
| reductionPercentage | Float | Percent change from baseline (positive = improvement) |
| interventionEffectSize | Float | Cohen's d effect size |
| dataPointsCount | Integer | |
| calculatedAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo BehaviorInterventionPlan

### GoalProgress

Treatment plan goals — the top-level outcomes that programs and BIPs work toward.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| goalName | String | e.g. "Increase spontaneous mands to 20 per day across 3 settings" |
| goalArea | Enum | `communication`, `social`, `adaptive`, `behavior`, `academic`, `motor`, `play`, `self-help` |
| objectiveCount | Integer | Number of short-term objectives defined |
| objectivesCompleted | Integer | Number of objectives met |
| programsLinked | JSON | Array of Program UUIDs contributing to this goal |
| bipLinked | JSON | Array of BIP UUIDs (for behavior goals) |
| baseline | JSON | `{ description: "...", measurements: { ... } }` |
| currentStatus | JSON | `{ description: "...", measurements: { ... } }` |
| target | JSON | `{ description: "...", measurements: { ... } }` |
| status | Enum | `not-started`, `in-progress`, `partially-met`, `met`, `discontinued`, `modified` |
| targetDate | Date | Projected target completion date |
| metDate | Date | Actual date goal was met |
| createdById | FK → User | BCBA |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Creator')

### ProgressAlert

Automatically generated alerts that notify BCBAs when data patterns require
clinical attention.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| alertType | Enum | `mastery-imminent`, `regression-detected`, `plateau`, `goal-overdue`, `attendance-concern`, `behavior-increase`, `generalization-needed`, `data-collection-gap`, `prompt-dependency`, `low-ioa` |
| programId | FK → Program | (nullable) |
| targetId | FK → ProgramTarget | (nullable) |
| goalId | FK → GoalProgress | (nullable) |
| triggeredAt | DateTime | When alert conditions were detected |
| alertData | JSON | Supporting data that triggered the alert |
| message | Text | Human-readable alert message |
| severity | Enum | `info`, `warning`, `critical` |
| acknowledgedById | FK → User | BCBA who reviewed |
| acknowledgedAt | DateTime | |
| resolvedAt | DateTime | When underlying condition was addressed |

**Associations:**
- belongsTo Patient
- belongsTo Program
- belongsTo ProgramTarget
- belongsTo GoalProgress
- belongsTo User (as 'AcknowledgedBy')

## API Endpoints

### Progress Dashboards

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/progress/patient/:patientId/dashboard` | isBCBA, isTherapist | Full progress dashboard data for patient |
| GET | `/api/progress/patient/:patientId/skills` | isBCBA, isTherapist | Skill acquisition aggregate data |
| GET | `/api/progress/patient/:patientId/skills/graph/:programId` | isBCBA, isTherapist | Graph data for a specific program |
| GET | `/api/progress/patient/:patientId/behaviors` | isBCBA, isTherapist | Behavior reduction aggregate data |
| GET | `/api/progress/patient/:patientId/behaviors/graph/:bipId` | isBCBA, isTherapist | Graph data for a specific BIP |
| GET | `/api/progress/patient/:patientId/goals` | isBCBA, isTherapist | All goals with current status |

### Aggregated Data & Trends

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/progress/patient/:patientId/trends` | isBCBA | Statistical trend analysis across all programs |
| GET | `/api/progress/patient/:patientId/compare` | isBCBA | Period-over-period comparison (this month vs last) |
| GET | `/api/progress/patient/:patientId/mastery-rate` | isBCBA | Mastery rate (targets mastered per week/month) |
| GET | `/api/progress/patient/:patientId/program-summary` | isBCBA | Summary of all active programs with recent data |
| GET | `/api/progress/bcba/caseload-summary` | isBCBA | Aggregate across all patients on BCBA's caseload |

### Goals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/goals/patient/:patientId` | isBCBA, isTherapist | List goals for patient |
| GET | `/api/goals/:id` | isBCBA, isTherapist | Goal detail with linked programs |
| POST | `/api/goals` | isBCBA | Create treatment plan goal |
| PUT | `/api/goals/:id` | isBCBA | Update goal |
| POST | `/api/goals/:id/met` | isBCBA | Mark goal as met |
| POST | `/api/goals/:id/modify` | isBCBA | Record goal modification |
| POST | `/api/goals/:id/discontinue` | isBCBA | Discontinue goal |

### Alerts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/progress/alerts` | isBCBA | All active alerts for BCBA's patients |
| GET | `/api/progress/alerts/patient/:patientId` | isBCBA | Alerts for specific patient |
| POST | `/api/progress/alerts/:id/acknowledge` | isBCBA | Acknowledge alert |
| POST | `/api/progress/alerts/:id/resolve` | isBCBA | Mark alert as resolved |
| GET | `/api/progress/alerts/unacknowledged-count` | isBCBA | Count for notification badge |

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/progress/patient/:patientId/reports/generate` | isBCBA | Generate comprehensive progress report |
| GET | `/api/progress/reports/:id` | isBCBA, isTherapist, isParent | View generated report |
| GET | `/api/progress/reports/patient/:patientId` | isBCBA, isTherapist, isParent | List reports for patient |
| POST | `/api/progress/reports/:id/export-pdf` | isBCBA | Export report as PDF |

## Frontend Pages

### `/pages/bcba/PatientProgressPage.jsx`

The main clinical progress dashboard for a single patient:

- Patient selector with search
- Tab navigation: **Skills** | **Behaviors** | **Goals** | **Reports**
- **Skills tab**:
  - Active programs list with mini sparkline per target
  - Click program → full graph with phase change lines
  - Cumulative mastery chart (targets mastered over time)
  - Trial accuracy trend with statistical analysis
  - Date range filter and comparison mode
- **Behaviors tab**:
  - Behavior frequency/duration graphs over time
  - Baseline comparison with reduction percentage
  - Phase change lines (when interventions were modified)
  - ABC pattern analysis summary
- **Goals tab**:
  - Goal progress cards with Gantt-style timeline
  - Objectives completed / total
  - Linked programs status summary
- **Reports tab**:
  - Generate report flow
  - Historical report list
  - Export/download options

### `/pages/bcba/ProgressAnalyticsPage.jsx`

Aggregate view across the BCBA's entire caseload:

- Caseload summary cards:
  - Total active patients
  - Total active programs
  - Average mastery rate (targets per month)
  - Patients with overdue reports
  - Patients with regression patterns
- Patient comparison table (sortable columns):
  - Active programs, mastery rate, attendance %, behavior trend
- Identify patients needing attention (low mastery rate, high behaviors, low attendance)
- Supervision planning prioritization based on data

### `/pages/therapist/PatientProgressPage.jsx`

Simplified read-only view for the RBT:

- Current active programs for assigned patients
- Recent trial data trends (last 2 weeks)
- Behavior data for sessions they've run
- "What to focus on" indicators:
  - Targets approaching mastery (encourage more opportunities)
  - Targets with low recent accuracy (may need procedure adjustment)
  - New phase changes from BCBA
- Cannot modify programs or goals (BCBA-only)

### Components

- `SkillAcquisitionGraph.jsx` — Linear graph with data path, trend line, aim line, phase change lines
- `BehaviorGraph.jsx` — Frequency/duration graphs with baseline comparison and trend
- `GoalGanttChart.jsx` — Goal timeline visualization with progress bars
- `CumulativeMasteryChart.jsx` — Cumulative targets mastered over time
- `ComparePeriodsPanel.jsx` — Side-by-side period comparison with delta indicators
- `AlertPanel.jsx` — List of automated clinical alerts with severity badges
- `TrendIndicator.jsx` — Directional arrow with significance (improving ↑, stable →, declining ↓)
- `PhaseChangeLine.jsx` — Vertical line overlay on graphs marking phase changes
- `ProgressReportBuilder.jsx` — Multi-step report generation interface
- `CaseloadDashboard.jsx` — Aggregate caseload view with sorting and filtering
- `MasteryRateCard.jsx` — Visual card showing mastery rate trend
- `DataCompletenessIndicator.jsx` — Shows if enough data exists for valid analysis

## Workflows

### Regular Progress Monitoring

1. BCBA schedules weekly progress review for each patient
2. Opens patient progress dashboard:
   - Reviews all active programs with recent data
   - Checks behavior trends against baseline
   - Reviews goal progress toward target dates
3. System automatically highlights:
   - **Mastery imminent**: Target at 90%+ for 3+ sessions → suggest generalization
   - **Regression detected**: Data shows declining trend over 5+ sessions → investigate
   - **Plateau**: Flat trend for 10+ sessions → consider procedure modification
   - **Goal overdue**: Goal approaching target date with insufficient progress
   - **Data gap**: No data collected for a program in 5+ sessions
   - **Prompt dependency**: >80% of trials prompted → consider prompt fading
4. BCBA makes clinical decisions:
   - Promote mastered targets to maintenance
   - Modify teaching procedure for plateau/regressed targets
   - Add generalization targets
   - Schedule IOA observation
   - Update goal status
5. All changes recorded → phase changes logged → RBTs receive updated programs

### Clinical Report Generation

1. BCBA selects patient → Reports tab → "Generate Report"
2. Chooses report parameters:
   - Date range (monthly, quarterly, custom)
   - Report type (clinical, insurance, IEP, parent summary)
   - Sections to include
3. System auto-compiles from progress aggregates:
   - Programs mastered this period with mastery dates
   - Active programs with current status and trend
   - Behavior data with trend analysis and baseline comparison
   - Goal progress summary
   - Attendance summary
   - Clinical recommendations section
4. BCBA reviews each section:
   - Edits auto-generated narrative
   - Adds clinical interpretation
   - Provides plain-language summary for parents
   - Sets home carryover recommendations
5. BCBA approves → report generated and stored
6. Report available for:
   - Download as PDF
   - View in parent portal
   - Archive for compliance
   - Print for insurance submission

### Alert-Driven Clinical Action

1. System runs nightly progress analysis:
   - Scans all active patients for alert conditions
   - Generates ProgressAlert records for detected conditions
2. BCBA logs in → sees notification badge with alert count
3. Opens AlertPanel → reviews alerts sorted by severity
4. Per alert, BCBA can:
   - View supporting data (embedded graph, relevant trial data)
   - Acknowledge (mark as being reviewed)
   - Navigate to the relevant program/BIP/goal
   - Take clinical action (modify program, schedule supervision, etc.)
   - Resolve (mark as addressed)
5. Alert history maintained for compliance and quality assurance
6. Alert trends tracked: are certain patients generating more alerts → may indicate need for program overhaul

### Program Decision Support

Based on data patterns, the system provides decision support (not automated decisions — requires BCBA clinical judgment):

| Pattern | Suggestion |
|---------|-----------|
| 3+ sessions at 90%+ accuracy, 2+ people | "Consider mastering this target and moving to generalization" |
| 10+ sessions with flat accuracy (no improvement) | "Consider modifying teaching procedure or prompt level" |
| Accuracy declining over 5+ sessions | "Investigate regression — check for skill loss, setting change, or medical factors" |
| >80% prompted trials (not independent) | "Consider prompt fading procedure or increasing reinforcement for independent responses" |
| No data for 7+ days | "Schedule a session to run this program or consider if target is still appropriate" |
| Behavior rate increasing over baseline | "Review BIP implementation fidelity and consider plan modification" |

## Business Rules

- Progress aggregates are re-computed nightly (or on-demand when fresh data is needed)
- BCBAs can view all progress data for their assigned patients
- RBTs can view progress data only for patients they are assigned to
- Goals must be created by BCBAs only
- Goals require baseline data before they can be set to "in-progress"
- Alerts are auto-generated but never auto-resolve clinical issues
- Report generation requires BCBA review before publication to parent portal
- All phase changes, goal modifications, and program changes are audit-logged
- Trend analysis requires minimum data points (e.g. 5+ sessions) for valid calculations
- Behavior baseline must be established before reduction percentage can be calculated
- Mastery rate is organization-scoped for reporting purposes

## Integration with Existing Models

- **Patient** — All progress data is patient-scoped
- **Program / ProgramTarget** — Skill aggregates are computed from TrialData tied to targets
- **BehaviorInterventionPlan** — Behavior aggregates are computed from BehaviorEvent tied to BIPs
- **Session** — All data aggregated by session dates
- **User** — BCBA creates goals and reviews reports; RBT views progress
- **Audit** — All report generation, goal status changes, and alert acknowledgments are logged
- **Parent Portal** — ProgressSummary model bridges clinical data to parent-friendly view
