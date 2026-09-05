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
