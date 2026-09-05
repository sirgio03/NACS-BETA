# Architecture Decision Records (ADRs) - NACS Platform

This document logs all key architectural, security, and design decisions for the **National Association of Campus Societies (NACS)** web platform.

---

## ADR 001: Standalone Angular Architecture & Signal-Driven State Management

### Context
NACS requires an institutional, accessible, highly responsive web application connecting student clubs across Algerian universities. State complexity involves authentication state, active club metadata, directory filters, and moderation queues.

### Decision
- Adopt **Angular standalone components** (`standalone: true`), using official Angular CLI defaults.
- Use **Angular Signals and Services** for reactive state management. NgRx was rejected as unnecessary cognitive overhead for this scale and team size.
- Use official `@angular/fire` for all Firebase integration instead of invoking the raw Firebase JS SDK directly.

### Consequences
- Modular, lightweight component tree with faster compilation.
- Clean separation of concerns with predictable reactivity.

---

## ADR 002: Dual-Environment Separation with Zero-Secret Policy

### Context
Development, testing, and production cannot share database collections or auth credentials. Additionally, credentials must never be committed to source control.

### Decision
- Establish two distinct Firebase projects: `nacs-platform-staging` and `nacs-platform-prod`.
- Configure `.firebaserc` with `staging` and `prod` targets.
- Environment variables are injected into `environment.staging.ts` and `environment.prod.ts` via CI/CD pipelines and local scripts (`scripts/set-env.ts`).
- Commit `.env.example` documenting every required variable without sensitive values.
- Strictly ignore `.env`, `.env.local`, and real service account JSON keys in `.gitignore`.

---

## ADR 003: Server-Side Mutation Boundary & Default-Deny Firestore Security Rules

### Context
Public visitors, student leads, and board members interact with the platform. Client-side Firestore writes are susceptible to malicious tampering (e.g. self-assigning admin privileges, directly publishing unapproved events or projects).

### Decision
- Set up a **strict default-deny** policy in `firestore.rules` (`match /{document=**} { allow read, write: if false; }`).
- **RULE**: Nothing user-submitted (`events`, `projects`, `applications`) is visible publicly until `status == 'approved'`.
- All writes beyond user profile edits (`displayName`, etc.) are denied on the client (`allow write: if false;`).
- All business-logic writes (submitting applications, creating events, submitting showcase projects, reviewing approvals, assigning club lead roles) must go through **Cloud Functions for Firebase** using the Firebase Admin SDK.

---

## ADR 004: Callable Application Submission with Firebase App Check

### Context
The club membership application form is publicly accessible without prior account creation, leaving it vulnerable to automated form-spamming bots and resource exhaustion.

### Decision
- Application submissions must route through an HTTPS Callable Cloud Function (`submitApplication`).
- Protect the submission endpoint with **Firebase App Check** (`enforceAppCheck: true`) using reCAPTCHA Enterprise.
- Integrate `provideAppCheck` in AngularFire. Debug tokens are strictly restricted to local and staging environments, completely omitted in production.

---

## ADR 005: Atomic Application Approvals via Firestore Transactions

### Context
Approving a club application requires modifying the application status, provisioning a verified club document in `clubs`, and updating the applicant's role to `club_lead` in `users`. Partial execution or race conditions between multiple board members could lead to orphaned clubs or duplicate creations.

### Decision
- Implement `approveApplication` as a callable Cloud Function executing a Firestore transaction (`db.runTransaction()`).
- **Read-then-write invariant**: The application status is fetched and validated *inside* the transaction body (`transaction.get(appRef)`). If `status !== 'pending'`, the transaction throws `failed-precondition`, preventing double approvals.
- All three writes occur atomically within the transaction.

---

## ADR 006: Self-Hosted Font Bundling & Institutional Design Tokens

### Context
NACS is a formal national organization. Brand guidelines require "Space Grotesk" for display and "Inter" for body typography, alongside `#0d0dff` (deep blue) and `#ffd400` (yellow). External runtime calls to `fonts.googleapis.com` introduce third-party privacy dependencies, latency, and failure points.

### Decision
- Bundle font files at build time via `@fontsource/space-grotesk` (weights 500, 700) and `@fontsource/inter` (weights 400, 500, 600).
- Expose all brand design tokens as CSS custom properties and SCSS variables in `src/styles/_variables.scss`.
- Enforce institutional feel: sharp corners (4-8px radius max), subtle 1-2px elevations, and generous whitespace.

---

## ADR 007: Strict Storage Security Rules (Raster-Only, No SVG, Size Ceilings)

### Context
Allowing arbitrary uploads to Firebase Storage introduces security vulnerabilities, including stored Cross-Site Scripting (XSS) via maliciously crafted SVG files and storage exhaustion via oversized files.

### Decision
- Whitelist only raster image MIME types: `image/jpeg`, `image/png`, `image/webp`.
- **Explicitly exclude `image/svg+xml`** to eliminate stored XSS vectors in user-uploaded media.
- Impose strict size limits: max 2MB for club logos (`clubs/{clubId}/...`), max 5MB for project assets (`projects/{projectId}/...`).
- Restrict write operations to authenticated verified club leads and administrators.

---

## ADR 008: Automated Disaster Recovery via Scheduled Firestore Exports

### Context
Guardrail requirement: automated daily backup of all Firestore collections to Google Cloud Storage before any real club data is entered.

### Decision
- Deploy a daily scheduled Cloud Function (`scheduledFirestoreBackup`) running at 03:00 AM (Africa/Algiers) to trigger a Firestore export operation targeting a dedicated Cloud Storage bucket (`FIRESTORE_BACKUP_STORAGE_BUCKET`).
- Document CLI-based automation in `scripts/setup-firestore-backup.sh` with a 30-day bucket lifecycle retention rule.

---

## ADR 009: Behavioral Security Rules Testing with Firebase Emulator

### Context
Static syntax validation of `firestore.rules` cannot guarantee that security policies are actually enforced at runtime.

### Decision
- Implement an automated security rules test suite in `tests/firestore-rules/` utilizing `@firebase/rules-unit-testing`.
- Run tests against the local Firebase Firestore Emulator as a required step in the CI pipeline (`npm run test:rules` / `npx firebase emulators:exec`).
- Tests cover unauthenticated, authenticated, creator, lead, and board/admin access patterns across all collections.

---

## ADR 010: Strict Allowlist Policy for `users/{uid}` Updates

### Context
Using a blocklist approach (e.g. denying edits to `role` and `clubId`) leaves user profiles vulnerable to unintended writes whenever new schema fields (e.g. `isSuperuser`, `reputation`, `internalNotes`) are introduced to the data model in the future.

### Decision
- Formulate the `users/{uid}` update rule as a strict **allowlist**:
  ```javascript
  let allowedFields = ['displayName', 'photoURL', 'phoneNumber', 'bio', 'updatedAt'];
  allow update: if isOwner(uid) && 
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(allowedFields);
  ```
- Any future schema fields are denied by default unless intentionally and explicitly added to `allowedFields`.
- Direct client document creation and deletion are unconditionally denied (`allow create, delete: if false;`).

---

## ADR 011: Server-Side Default Profile Provisioning on First Sign-In

### Context
When a new user signs in via Google Sign-In or email registration for the first time, client-side profile creation creates an attack vector where a manipulated client SDK payload could inject an elevated role (`board`, `admin`, `club_lead`).

### Decision
- Trigger a server-side Cloud Function (`onUserCreated`) automatically upon Firebase Authentication user creation.
- The function provisions `users/{uid}` with `role: 'visitor'` (baseline non-elevated role) and `clubId: null`.
- The client NEVER creates the initial `users/{uid}` document.
- Role elevation happens strictly server-side:
  - `club_lead`: Assigned inside the atomic `approveApplication` transaction.
  - `board` / `admin`: Assigned via the admin-only callable endpoint `assignUserRole`.

---

## ADR 012: Framing Route Guards as UX Convenience, Not Security Boundaries

### Context
Single-page application client-side route guards (e.g. `RoleGuard`, `AuthGuard`) can be bypassed by browser console manipulation or network tampering.

### Decision
- Formally define `RoleGuard` and `AuthGuard` as **client-side UX convenience tools only**.
- Guards serve to improve navigation by avoiding dead-end states, but they are never treated as security boundaries.
- The sole authoritative security boundaries remain:
  1. Firestore Security Rules (data layer)
  2. Cloud Functions role validations (compute/mutation layer)
- Guards merely *reflect* the permissions already enforced server-side.

---

## ADR 013: Verified-Only Public Club Read Constraint in Security Rules

### Context
Public visitors must not see unverified, pending, or rejected student societies. If this constraint were only applied in the client-side query, any direct Firestore SDK request or crafted query could leak confidential or unverified club records.

### Decision
- Restrict read access in `firestore.rules`:
  ```javascript
  match /clubs/{clubId} {
    allow read: if resource.data.verified == true || isBoardOrAdmin();
    allow write: if false;
  }
  ```
- Public and non-board visitors cannot read any club document where `verified == false`.
- The rule is behaviorally verified by emulator unit tests.

---

## ADR 014: Governance Audit Logging via `roleChangeLog`

### Context
Organizational governance and accountability require a tamper-proof audit log of every role assignment or transition (e.g. promoting a user to `club_lead`, `board`, or `admin`).

### Decision
- Establish a dedicated `roleChangeLog/{logId}` collection.
- All role transitions in `approveApplication` and `assignUserRole` atomically write an audit record containing:
  `{ affectedUid, previousRole, newRole, changedBy, clubId, reason, timestamp }`.
- `roleChangeLog` is read-restricted to board and admin officers (`isBoardOrAdmin()`), and completely rejects direct client writes.

---

## ADR 015: Cursor-Based Pagination Strategy for Large-Scale Collections

### Context
Offset-based pagination (`offset(N)`) in Firestore reads and bills for all skipped documents, degrading performance and increasing costs as collection size grows.

### Decision
- Standardize on cursor-based pagination using Firestore `startAfter(lastDocumentSnapshot)`.
- Client requests fetch `pageSize + 1` documents to determine if a subsequent page exists without needing an expensive `count()` aggregation.
- All paginated queries are backed by composite indexes in `firestore.indexes.json`.

---

## ADR 016: Application Rejection Governance & Mandatory Server-Side Reason

### Context
Rejecting a university student club membership application without documented justification damages institutional transparency, leaves applicants without actionable feedback, and risks subjective or arbitrary decision-making. Allowing rejection logic to execute client-side or without strict caller role validation introduces privilege escalation risks.

### Decision
- Implement `rejectApplication` as a callable Cloud Function that strictly validates the caller's role (`board` or `admin`) via a fresh read of `users/{callerUid}` server-side.
- Require a non-empty, non-whitespace `reason` parameter validated server-side, throwing an `invalid-argument` error if omitted.
- Atomically update the application document with `status: 'rejected'`, `rejectionReason: reason`, `reviewedBy: callerUid`, and `reviewedAt: FieldValue.serverTimestamp()`.

---

## ADR 017: Decision Audit Trail via `applicationDecisionLog`

### Context
Institutional governance demands a durable, tamper-proof record of every membership decision (approvals and rejections). Relying solely on the mutable `applications` collection risks loss of auditability if an application is updated or removed.

### Decision
- Establish a dedicated `applicationDecisionLog/{logId}` collection.
- Both `approveApplication` and `rejectApplication` Cloud Functions write an immutable audit document storing:
  `{ applicationId, decidedBy, decision: 'approved' | 'rejected', reason, clubName, university, timestamp }`.
- Restrict read access in `firestore.rules` strictly to board and admin officers (`isBoardOrAdmin()`).
- Unconditionally deny all direct client write operations (`allow write: if false;`).

---

## ADR 018: Elimination of Sensitive Identifiers from Stored Club Leadership

### Context
Public visitors browse the federation club directory. Storing user UIDs, contact emails, or phone numbers in the `clubs/{clubId}.leadership` array exposes student personal information to public scraping and creates redundant state synchronization requirements between `users` and `clubs`.

### Decision
- Restrict the `clubs/{clubId}.leadership` array strictly to non-sensitive public display objects: `[{ name: string, role: string }]`.
- Remove all `uid`, `email`, and `phone` attributes from the stored club leadership array.
- Maintain the authoritative association between a club lead and their club exclusively in the user document (`users/{uid}.clubId`).
- Permissions for club lead management actions are verified server-side using `users/{uid}.clubId` and `users/{uid}.role == 'club_lead'`.

---

## ADR 019: Application Proof-Document Storage Security & Restricted Read Access

### Context
During society federation application submission, student leads upload official institutional documents (e.g. university affiliation letters, club charters, faculty approvals). These documents contain sensitive administrative contact details and institutional seals that must not be publicly readable.

### Decision
- Enforce confidential access in `storage.rules` for all paths under `/applications/{applicationId}/{fileName}`:
  - **Read Access**: Strictly restricted to the authenticated applicant (matching `contactEmail` or `leadUid` on the application document, or matching `request.auth.uid == applicationId`) and board/admin officers (`isBoardOrAdmin()`).
  - **Write Access**: Restricted to authenticated users uploading approved document formats (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`).
  - **Zero SVG Tolerance**: SVGs are strictly excluded to prevent stored XSS attacks.
  - **Size Limit**: Maximum 10MB per proof document.

---

## ADR 020: Server-Side Club Ownership Verification for Mutation Operations

### Context
Allowing a client to supply an arbitrary `clubId` in mutation requests (`updateClubProfile`, `submitEvent`, `submitProject`) without server-side verification enables horizontal privilege escalation, where a club lead of Society A could overwrite Society B's profile or publish events on their behalf.

### Decision
- All club lead callable functions invoke `verifyClubLead(auth, expectedClubId)` before executing any business logic.
- The helper performs a fresh read of `users/{auth.uid}` from Firestore to confirm:
  1. `role === 'club_lead'`
  2. `clubId` is non-empty
  3. `users/{auth.uid}.clubId === expectedClubId`
- Any mismatch immediately throws `permission-denied`, unconditionally rejecting cross-club mutations.

---

## ADR 021: Explicit Allowlist for Club Profile Edits & Leadership Privacy

### Context
Using a blocklist approach for club profile updates risks exposing critical organizational attributes (`name`, `university`, `category`, `foundingDate`, `verified`) to unauthorized changes by club leads. Furthermore, student executive rosters could inadvertently leak student emails or user IDs.

### Decision
- Enforce an explicit key allowlist in `updateClubProfile`: `['clubId', 'description', 'logoUrl', 'socials', 'leadership']`.
- Any submission containing unapproved keys is rejected with an `invalid-argument` error.
- The `leadership` array strictly enforces `{ name: string, role: string }` pairs only. Injected `uid` or `email` keys are detected and rejected at the Cloud Function boundary.

---

## ADR 022: Automated 3-Day Event Conflict Detection & Queue-For-Moderation Policy

### Context
Simultaneous or closely scheduled events across Algerian student societies cause date cannibalization and low attendance. However, automatically rejecting conflicting event submissions frustrates club leads who may have fixed university bookings.

### Decision
- In `submitEvent`, run an automated conflict query against approved events within a $\pm 3$-day window of the submitted start date.
- If an approved event exists within the window, set `status: 'flagged_conflict'` (instead of `'pending'`) and store a descriptive `conflictContext` identifying the conflicting event's title and scheduled date.
- The event is queued for board attention and remains unlisted publicly until explicitly approved by the board, while the club lead sees clear explanatory feedback on their dashboard.

---

## ADR 023: Content Moderation Governance & Immutable Audit Logging (`moderationDecisionLog`)

### Context
Public visibility on the NACS platform for both events and student showcase projects requires strict federation oversight. Leaving approval or rejection logic to direct client writes creates critical security vulnerabilities. Moreover, governance accountability requires every moderation decision to be immutable and attributed.

### Decision
- Content moderation for events and projects is handled exclusively by callable Cloud Functions: `approveEvent`, `rejectEvent`, `approveProject`, and `rejectProject`.
- Every handler enforces server-side caller role validation (`verifyBoardOrAdmin`) reading `users/{callerUid}`.
- Rejection of any item strictly requires a non-empty, non-whitespace justification `reason` validated at the Cloud Function boundary.
- Every approval and rejection atomically writes an immutable audit record to `moderationDecisionLog/{logId}` capturing:
  `{ targetId, targetType: 'event' | 'project', decision: 'approved' | 'rejected', decidedBy, clubId, title, previousStatus, reason, conflictContext, timestamp }`.
- Direct client writes to `moderationDecisionLog` are denied (`allow write: if false;`); reads are restricted strictly to board/admin officers.

---

## ADR 024: Board Resolution Policy for Proximity Conflicts (`flagged_conflict` review)

### Context
Events flagged with `status == 'flagged_conflict'` by the automated 3-day proximity detector require human evaluation. Some events may occur on the same date but cater to completely different university audiences or geographic wilayas (e.g. Oran vs. Constantine), making prohibition counterproductive.

### Decision
- The NACS Board possesses full authority to approve a `flagged_conflict` event ("Approve Anyway").
- The board interface displays the detailed `conflictContext` identifying the conflicting event and scheduled dates.
- When approved, `approveEvent` transitions the event status directly to `'approved'` and records in `moderationDecisionLog` that the board consciously resolved the proximity conflict.
- If the board determines the conflict is unmanageable, they execute `rejectEvent` with a mandatory explanation advising the club lead on viable alternative scheduling windows.

---

## ADR 025: Native Public Calendar Architecture & Date-Bounded Range Queries

### Context
The initial platform plan considered an embedded Google Calendar iframe for displaying national events. However, following the implementation of structured club lead submission (Feature 5) and board moderation governance (Feature 6), all events reside natively in Firestore with lifecycle statuses (`pending`, `flagged_conflict`, `approved`, `rejected`). Duplicating approved events into an external Google Calendar would create dual sources of truth and operational synchronization debt. Furthermore, querying the entire collection on every page visit would scale read costs linearly with historical archives.

### Decision
- **Native UI over Iframe**: Build the public calendar natively in Angular reading directly from Firestore's `events` collection via public read rules (`status == 'approved'`).
- **Date-Bounded Range Queries**: Viewport queries are bounded strictly to the active viewing window (`date >= startIso && date <= endIso`) with a small padding buffer, backed by composite indexes (`status ASC, date ASC`, `status ASC, type ASC, date ASC`, `status ASC, wilaya ASC, date ASC`).
- **View Responsiveness**: Implement three coordinated viewports: Month grid (default), Week columns, and Agenda/List view (optimized for mobile screens).
- **Client-Side Filter Layering**: Filters for event category (7 types), Algerian wilaya (1 to 58), and search terms operate responsively across the fetched date window without requiring redundant server round-trips.

---

## ADR 026: Server-Side iCalendar (.ICS) Export & Conflict Privacy Quarantine

### Context
Attendees require the ability to export national events into calendar software (Google Calendar, Outlook, Apple Calendar). Generating `.ics` files client-side introduces timezone skew across different user device settings and risks formatting inconsistencies. Additionally, events approved despite a schedule proximity clash (`conflictContext != null`) require attendee awareness without leaking internal board moderation discussions, reviewer identities, or other clubs' unapproved submissions.

### Decision
- **Server-Side Generation**: Exporting iCalendar files is handled by Cloud Functions (`exportEventIcs` and `exportEventsIcs`), generating RFC 5545 compliant payloads with explicit `Africa/Algiers` (UTC+1, no DST) standard timezone components.
- **Approved-Only Security Barrier**: The export functions strictly verify `status === 'approved'`. Any attempt to export unapproved, pending, or rejected events via manipulated `eventId` parameters is rejected with `failed-precondition`, preventing unauthorized data exfiltration.
- **Conflict Privacy Quarantine**: Approved events marked with proximity flags display a discreet public warning badge (`⚠️ National Schedule Proximity`) with an attendee-facing tooltip (*"Overlaps with another national event"*). Under no circumstances are raw internal board deliberation notes or other clubs' submission metadata exposed.
- **Public Data Invariant in ICS**: The exported `.ics` file includes only public attributes (`SUMMARY`, `DESCRIPTION`, `LOCATION`, `DTSTART`, `DTEND`, `URL`). Personal student lead UIDs, emails, and reviewer attributes are completely excluded.
