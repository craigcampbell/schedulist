# Parent Portal

## Overview

A secure, simplified portal for parents and guardians of children receiving ABA
therapy. Parents can view their child's progress, upcoming sessions, communicate
with the care team, access important documents, and participate in their child's
treatment — all in parent-friendly language with plain-English explanations.

## Database Models

### ParentAccess (extends User)

A new role `parent` added to the existing Role model. Parent users are linked
to one or more patient records.

| Field | Type | Notes |
|-------|------|-------|
| (all standard User fields) | | firstName, lastName, email, password, active, organizationId |
| relationshipToPatient | Enum | `mother`, `father`, `legal-guardian`, `grandparent`, `other-family`, `foster-parent` |

No separate model needed — relationship stored as metadata on the User record
or on the PatientParentLink join table.

### PatientParentLink

Links parent users to patient records with configurable access levels.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| parentId | FK → User | (user with role 'parent') |
| accessLevel | Enum | `full` (view progress, schedule, messages), `schedule-only` (view schedule only), `restricted` (view only upcoming appointments) |
| isPrimaryContact | Boolean | Primary contact for emergency and billing |
| notificationPreferences | JSON | `{ email: true, sms: false, sessionSummaries: true, progressUpdates: true, scheduleChanges: true, messages: true }` |
| invitedById | FK → User | BCBA who invited the parent |
| invitedAt | DateTime | |
| acceptedAt | DateTime | (null until parent accepts invite) |
| createdAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Parent')
- belongsTo User (as 'InvitedBy')

### ProgressSummary

BCBA-reviewed, parent-friendly progress reports generated on a schedule.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| periodStart | Date | |
| periodEnd | Date | |
| generatedAt | DateTime | Auto-generated timestamp |
| reviewedById | FK → User | BCBA who reviewed and approved |
| approvedAt | DateTime | |
| status | Enum | `draft`, `pending-review`, `approved`, `sent`, `parent-viewed` |
| content | JSON | Structured summary: `{ overview, skillsAcquired, goalsProgress, attendance, recommendations, plainLanguageSummary }` |
| parentComments | Text | Parent feedback after viewing |
| parentViewedAt | DateTime | |
| sentVia | Enum | `portal`, `email`, `both` |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'ReviewedBy')

### CareTeamMessage

Async messaging between parents and the care team. Not a real-time chat —
structured, HIPAA-compliant messaging.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| senderId | FK → User | |
| senderRole | String | Role at time of sending (denormalized for display) |
| subject | String | Message subject |
| message | Text | Message body |
| readAt | DateTime | When recipient read it |
| parentVisible | Boolean | Always true for parent messages; may be false for internal team messages |
| threadId | UUID | Groups related messages (nullable for new threads) |
| attachments | JSON | Array of file references (optional) |
| createdAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'Sender')

### SharedDocument

Documents shared with parents — treatment plans, home strategies, progress reports, etc.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| patientId | FK → Patient | |
| title | String | |
| description | Text | Brief description for parent |
| documentType | Enum | `treatment-plan`, `progress-report`, `assessment`, `goal-sheet`, `home-strategies`, `general`, `insurance`, `rights-notice` |
| fileUrl | String | Secure file URL |
| fileName | String | Original filename |
| fileSize | Integer | Bytes |
| uploadedById | FK → User | |
| sharedWithParent | Boolean | |
| parentViewedAt | DateTime | |
| parentDownloadedAt | DateTime | |
| createdAt | DateTime | |

**Associations:**
- belongsTo Patient
- belongsTo User (as 'UploadedBy')

## API Endpoints

### Parent Authentication & Invitation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/parent/invite` | isBCBA | Invite a parent by email, linking to a patient |
| POST | `/api/parent/accept-invite/:token` | None | Parent accepts invite, sets password |
| GET | `/api/parent/patients` | isParent | List all children linked to this parent |
| GET | `/api/parent/patients/:patientId/profile` | isParent + hasChildAccess | Get child's basic info (non-encrypted fields) |

### Schedule Access

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/parent/patients/:patientId/schedule` | isParent + hasChildAccess | Upcoming sessions for child |
| GET | `/api/parent/patients/:patientId/schedule/:date` | isParent + hasChildAccess | Specific day's sessions |
| GET | `/api/parent/patients/:patientId/attendance` | isParent + hasChildAccess | Attendance history (sessions attended/missed) |

### Progress Access

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/parent/patients/:patientId/progress` | isParent + hasChildAccess | Simplified progress dashboard data |
| GET | `/api/parent/patients/:patientId/summaries` | isParent + hasChildAccess | List progress summary reports |
| GET | `/api/parent/patients/:patientId/summaries/:id` | isParent + hasChildAccess | View a specific summary |
| POST | `/api/parent/patients/:patientId/summaries/:id/comment` | isParent + hasChildAccess | Add parent comment to summary |
| POST | `/api/parent/patients/:patientId/summaries/:id/viewed` | isParent + hasChildAccess | Mark summary as viewed by parent |

### Messaging

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/messages/patient/:patientId` | isParent, isBCBA, isTherapist | Get message thread for patient |
| POST | `/api/messages` | isParent, isBCBA, isTherapist | Send a message |
| PUT | `/api/messages/:id/read` | isParent, isBCBA, isTherapist | Mark message as read |
| GET | `/api/messages/patient/:patientId/unread-count` | isParent, isBCBA, isTherapist | Unread count for badge display |

### Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents/patient/:patientId` | isParent + hasChildAccess, isBCBA, isTherapist | List shared documents |
| GET | `/api/documents/:id/download` | isParent + hasChildAccess, isBCBA, isTherapist | Download document |
| PUT | `/api/documents/:id/viewed` | isParent + hasChildAccess | Mark document as viewed |

### Care Team

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/parent/patients/:patientId/care-team` | isParent + hasChildAccess | Who is on child's care team (names, roles, photos) |

## Frontend Pages

### `/pages/parent/DashboardPage.jsx`

Landing page after parent login. Shows at-a-glance information:

- Child's name prominently displayed (or child selector if multiple children)
- Quick-glance cards:
  - **Next Session**: Date, time, therapist name, location, session type
  - **Programs Mastered This Month**: Count with simple celebration language
  - **New Skills**: Brief list of recently mastered targets in plain English
  - **Messages**: Unread count with preview of latest
- Weekly schedule overview (next 7 days)
- Recent progress update teaser
- "Message Care Team" quick action button

### `/pages/parent/ProgressPage.jsx`

Parent-friendly progress visualization:

- Simplified skill acquisition summary:
  - "Skills your child is working on" (in-progress targets in plain language)
  - "Skills your child has mastered" (mastered targets with dates)
  - Visual progress bars (mastered / in-progress / not-started)
- Session attendance: sessions attended this month vs. scheduled
- Goal progress overview with plain-language descriptions
- Monthly/quarterly progress summaries (BCBA-approved reports)
- Period comparison: "This month vs. last month"
- "What this means" expandable sections with plain-English interpretations
- No clinical jargon — all terms explained

### `/pages/parent/SchedulePage.jsx`

Read-only view of child's schedule:

- Calendar view and list view toggle
- Each session shows:
  - Date and time block
  - Therapist name (and photo if uploaded)
  - Location name and address
  - Session type label with plain-English description
  - Color-coded (matches appointment colors from existing system)
- Filter by week/month
- Download/print schedule option
- Quick message to therapist about a specific session

### `/pages/parent/MessagesPage.jsx`

Care team communication:

- Message threads organized by subject
- Compose new message:
  - Subject line
  - Message body
  - Recipient (auto-populated to care team; parent doesn't pick individuals)
- Message history with timestamps
- Read/unread indicators
- "Care team will typically respond within 1 business day" expectation setting
- Notification preferences link

### `/pages/parent/DocumentsPage.jsx`

Shared documents from the care team:

- Document list with type icons and descriptions
- Filter by document type (treatment plan, home strategies, general)
- View/download documents
- "New document" badge for unviewed items
- Home strategy sheets in printable format
- Insurance and rights notice documents

### `/pages/parent/ProfilePage.jsx`

Parent account management:

- Update name, email, phone
- Change password
- Notification preferences (email, SMS toggle per notification type)
- Linked children overview

### Components

- `ParentProgressCard.jsx` — Simplified skill acquisition progress card
- `NextSessionWidget.jsx` — Upcoming session quick view
- `CareTeamContactCard.jsx` — Care team member display with role explanation
- `SimpleSkillGraph.jsx` — Parent-friendly bar/line chart (no clinical notation)
- `ProgressSummaryViewer.jsx` — Printable progress report with plain-English sections
- `HomeStrategyCard.jsx` — Parent training tips and home carryover strategies
- `MessageComposer.jsx` — Async message form with subject line
- `MessageThread.jsx` — Threaded message display
- `SessionCalendar.jsx` — Read-only session calendar for parent view
- `ChildSelector.jsx` — Dropdown/switch for parents with multiple children
- `DocumentCard.jsx` — Document display with type icon and download button

## Workflows

### Parent Onboarding

1. BCBA or Admin creates parent account:
   - Navigates to patient → "Invite Parent"
   - Enters parent email, name, relationship, access level
   - System sends invitation email with secure token
2. Parent receives email → clicks link → lands on set-password page
3. Parent sets password → logs in → sees guided tour overlay
4. Tour highlights:
   - "See your child's schedule" (Schedule tab)
   - "Track your child's progress" (Progress tab)
   - "Message the care team" (Messages tab)
   - "View shared documents" (Documents tab)
5. Parent can immediately see child's upcoming sessions and care team

### Progress Report Flow

1. BCBA generates progress summary (monthly or quarterly):
   - Opens patient → "Generate Progress Summary"
   - Selects date range → system compiles data
   - Auto-populated sections: skills worked on, skills mastered, attendance, behavior trends
2. BCBA reviews, adds plain-language explanations:
   - Removes or translates clinical jargon
   - Adds "What this means for your child" sections
   - Provides home carryover suggestions
3. BCBA approves → status changes to "approved"
4. Parent receives notification (email/SMS per preferences)
5. Parent logs in → sees new summary in Progress tab
6. Parent views report, can add comment/question
7. BCBA notified of parent feedback
8. Summary stored for historical record

### Parent-Care Team Messaging

1. Parent has question about child's behavior at home
2. Opens Messages → "New Message" → types subject and details
3. Message sent → all care team members (BCBA and assigned therapists) can see it
4. BCBA or therapist replies
5. Parent sees reply with read receipt
6. Threaded conversation continues with full history
7. All messages visible in patient's communication record (for continuity)
8. Internal team-only messages (not parent-visible) are flagged separately

### Parent Access Management

1. BCBA can adjust parent access level:
   - Full: view progress, schedule, messages, documents
   - Schedule-only: view schedule only (for co-parents with limited involvement)
   - Restricted: view upcoming appointments only
2. BCBA can add multiple parents to a patient (e.g. both parents, guardian)
3. BCBA can remove parent access at any time
4. Parent can update their own notification preferences
5. Multiple children linked to same parent account (e.g. siblings in same org)

## Business Rules

- Parent role is a first-class role (added to existing Role model: `parent`)
- Parents can only see patients they are linked to via PatientParentLink
- Parents cannot see other patients, clinical notes, raw trial data, or BIP details
- Parents can only see BCBA-reviewed summary data (not raw data collection)
- Parent access is read-only for schedule, progress, documents
- Parent can send messages and view responses (write access to messages only)
- BCBA must review and approve all progress summaries before parent can view them
- Session notes visible to parents only if BCBA marks them as "parent-visible"
- All parent portal activity is audit-logged
- Parent messages are not encrypted (but follow HIPAA compliance through secure transmission)
- Document downloads are logged for audit trail
- Parents cannot modify any clinical data, patient information, or schedule
- Parents can have different access levels per child (for families with multiple children)

## Integration with Existing Models

- **User** — Parents are Users with role `parent`; existing auth system handles login
- **Patient** — PatientParentLink connects parents to patients; existing Patient model unchanged
- **Appointment** — Schedule views use existing Appointment model filtered for parent access
- **Organization** — Parent access is within organization scope (multi-tenant)
- **Auth Middleware** — New `isParent` and `hasChildAccess` middleware for route protection
- **Audit** — All parent logins, document views, message sends are audit-logged
- **Modal System** — Use existing modal context for confirmations (e.g. "Send this message?")
- **React Query** — Follow existing patterns for data fetching and cache invalidation
