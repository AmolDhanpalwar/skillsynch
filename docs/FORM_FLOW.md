# Skill Assessment Form — Flow and Lifecycle

---

## Review Cycle Context

Every skill form is scoped to a **review cycle**. Forms are only active and editable within the cycle they belong to. When a new cycle is activated, all existing forms are reset to `draft` — the previous cycle's approved data is preserved in immutable JSONB snapshots in `skill_form_versions`.

```
Review Cycle: ACTIVE
  └── skill_forms (status: draft → pending_review → approved)
        └── On approval: snapshot → skill_form_versions

Review Cycle: CLOSED
  └── skill_forms are reset to draft for the next cycle
  └── skill_form_versions holds the permanent historical record
```

Employees, managers, and admins can browse historical cycles via the `CycleSelectorDropdown` on the Dashboard, TMG Dashboard, and Skills Matrix pages. Historical views are read-only and load from `skill_form_versions`, not `skill_forms`.

---

## Form Lifecycle

A skill form moves through a fixed set of statuses within a single review cycle.

```
                    ┌─────────────────────────────────────────────────────┐
                    │         New Cycle Activated                          │
                    │  activate_cycle_reset_forms() resets ALL forms       │
                    │  to draft with new cycle_id                          │
                    └─────────────────────────┬───────────────────────────┘
                                              │
                                              ▼
                        ┌───────────┐
                        │           │
Employee creates / ───► │   DRAFT   │ ◄──── Manager returns (with notes)
edits form              │           │
                        └─────┬─────┘
                              │
                    Employee submits
                              │
                              ▼
                        ┌───────────┐
                        │ PENDING   │
                        │  REVIEW   │
                        └─────┬─────┘
                              │
                   Manager reviews
                              │
               ┌──────────────┼──────────────┐
               │              │              │
            Approve        Return        ────┘
               │
               ▼
         ┌───────────┐         ┌──────────────────────────────────────┐
         │ APPROVED  │────────►│  trg_skill_form_approval_snapshot     │
         └───────────┘         │  AUTO-creates snapshot in             │
          (read-only)          │  skill_form_versions (JSONB)          │
                               └──────────────────────────────────────┘
```

### Status Descriptions

| Status | Who sets it | Form is editable by | Notes |
|---|---|---|---|
| `draft` | Employee (auto on first save) or cycle reset | Employee | Auto-saved locally and to DB |
| `pending_review` | Employee (explicit submit) | Nobody | Manager notified |
| `returned` | Manager | Employee | Manager's notes shown to employee |
| `approved` | Manager | Nobody (read-only) | Employee notified; snapshot created automatically |

### Cycle-Aware Status Logic

A form's `approved` status is only meaningful when it belongs to the **active** cycle. If the form was approved in a previous closed cycle, the employee's current dashboard shows `draft` (not `approved`):

```typescript
const formBelongsToActiveCycle = !activeCycle || !formCycleId || formCycleId === activeCycle.id;
const isApproved = formStatus === 'approved' && formBelongsToActiveCycle;
const isLocked   = isApproved || (formStatus === 'pending_review' && formBelongsToActiveCycle);
```

---

## Multi-Step Form

The form is divided into five steps. The employee navigates forward with "Next" (which saves a draft) and backward with "Back" (no save). Progress is shown in the `StepIndicator` at the top.

```
Step 1: Profile
Step 2: Skills
Step 3: Additional Skills
Step 4: Certifications
Step 5: Plans & Submit
```

Step navigation is managed by `FormContext` (`currentStep` state). Step 1 form data is managed by React Hook Form; Steps 2–5 use local `useState` inside `SkillFormPage`.

---

## Step 1 — Profile

**Component:** `src/pages/form/Step1Profile.tsx`
**Validation:** Zod schema built by `makeStep1Schema(validGrades, validDesignations)`

### Fields

| Field | Required | Validation |
|---|---|---|
| Employee Name | Yes | Non-empty |
| Employee Email | Yes | Valid email format |
| Employee Number | Yes | Non-empty |
| Current Project Name | Yes | Non-empty |
| Grade | Yes | Must be a value from `settings_grades` (active) |
| Designation | Yes | Must be a value from `settings_designations` for the selected grade |
| Total Years of Experience | Yes | Number, 0–50 |
| Relevant Years of Experience | Yes | Number, 0–50 |
| Haptiq Experience (Years) | Yes | Number, 0–50 |
| Manager Name | No | If present, manager email is required |
| Manager Email | Conditional | Required when manager name is filled; valid email format |

### Grade and Designation Validation

Grade and designation fields use a **select-only searchable dropdown** — the user can type to filter the list, but only clicking a listed option sets a valid value. Free-text that does not match any option is rejected at validation time.

The Zod schema receives the valid options list at runtime (after options load from Supabase). If a pre-filled grade is no longer valid, the schema rejects it with: `"M10" is not a valid grade — please select from the list`.

Designation options are filtered by the selected grade. Selecting a new grade clears the designation field.

### Pre-population

When a form record exists in the DB for the active cycle, fields are pre-populated from `skill_forms`. The manager is resolved from `skill_forms.manager_id` (preferred) or `users.manager_id` as a fallback.

If no form exists for the active cycle, fields default to the user's profile values from the `users` table.

---

## Step 2 — Skills

**Component:** `src/pages/form/Step2Skills.tsx` (employee) / `Step2SkillsManager.tsx` (manager review)

### Languages & Frameworks

Each section is a table with one row per skill:

| Column | Filled by | Notes |
|---|---|---|
| Skill name | Employee | Selected from master list; no duplicates within category |
| Employee rating | Employee | 0–4 star/level selector; labels from `settings_skill_ratings` |
| Manager rating | Manager | Read-only for employee; manager can add during review |
| Manager comment | Manager | Per-skill text note |

The first three rows in each section are pre-seeded:
- Languages: JavaScript, Python, Java
- Frameworks: React, Node.js, Spring Boot

Employees can add additional rows (up to the available options) and remove non-seed rows.

### Tools & Databases

Free-text tag pickers (multi-select). Options come from `settings_tools` and `settings_databases`. Tags are selected from the list; custom values are not allowed.

Employees enter tags; managers can add a single text comment block per section.

### Validation on Next

Step 2 exposes a `validate()` method via `useImperativeHandle`. When the employee clicks "Next", `SkillFormPage` calls `step2Ref.current.validate()`. Validation fails if any skill row has an empty name.

---

## Step 3 — Additional Skills

**Component:** `src/pages/form/Step3Additional.tsx` / `Step3AdditionalManager.tsx`

A table of environment/infrastructure/OS/management system skills. Same structure as languages/frameworks (name, employee rating, manager rating, manager comment).

Options come from `settings_environments`. The `is_haptiq_demand` flag on environment records highlights skills the company prioritises in reports.

The `validate()` method rejects rows with empty names.

---

## Step 4 — Certifications

**Component:** `src/pages/form/Step3Certifications.tsx` / `Step3CertificationsManager.tsx`

A numbered list of certification pickers. Options come from `settings_certifications`. The employee can:

- Pick from the master list (no free-text)
- Add additional rows
- Remove rows
- No duplicate certifications are allowed in the same form

The manager can add a single comment block for the certifications section.

---

## Step 5 — Plans & Submit

**Component:** `src/pages/form/Step4Plans.tsx` / `Step4PlansManager.tsx`

| Field | Filled by | Notes |
|---|---|---|
| 6-Month Upskilling Plan | Employee | Free text; what the employee plans to learn |
| Manager's Expectation Plan | Manager | Filled during review; read-only for employee |

The "Submit for Manager Review" button opens a confirmation modal. After confirmation:

1. `persistForm('pending_review')` upserts `skill_forms` with `status = 'pending_review'` and sets `submitted_at`
2. The manager is resolved from the saved form's `manager_id`
3. A notification is inserted for the manager: `form_submitted`
4. The employee is redirected to the dashboard with a success toast

---

## Draft Auto-Save

| Trigger | Behavior |
|---|---|
| Typing in Step 1 fields | Debounced 500 ms write to `localStorage` |
| Clicking "Save Draft" | Full `persistForm('draft')` to Supabase |
| Clicking "Next" | Calls `handleSaveDraft()` → `persistForm('draft')` before advancing |
| Page load | If a DB form exists for the active cycle, `localStorage` draft is discarded; DB is source of truth |

---

## Manager Review Flow

When a manager opens a form from their Inbox:

1. `ManagerReviewPage` fetches the full `skill_forms` record and all `skill_items`
2. All employee-filled fields are displayed read-only
3. Manager-editable fields (ratings, comments, expectation plan) are active
4. `manager_review_date` is set on the form record on first open
5. The manager can:
   - **Approve** — sets `status = 'approved'`, `approved_at = now()`, notifies employee; the `trg_skill_form_approval_snapshot` trigger automatically creates a snapshot in `skill_form_versions`
   - **Return** — sets `status = 'returned'`, saves a return reason in the form, notifies employee

Manager changes to skill items (ratings, comments) are saved when the manager clicks Approve or Return, not continuously.

---

## Approval Snapshot

When a manager approves a form, the Postgres trigger `trg_skill_form_approval_snapshot` fires automatically:

```
AFTER UPDATE on skill_forms WHERE status = 'approved'
  └── create_approval_snapshot() [SECURITY DEFINER]
        ├── Reads all skill_items for the form
        ├── Builds JSONB: { ...skill_forms columns, skill_items: [...] }
        └── INSERT INTO skill_form_versions (employee_id, cycle_id, snapshot_data, approved_at)
              ON CONFLICT (employee_id, cycle_id) DO UPDATE
```

The snapshot is the single permanent historical record for that employee in that cycle. Once the cycle is closed, this snapshot is used for all historical views.

---

## Viewing Historical Assessments

Employees, managers, and admins can view previous cycles using the `CycleSelectorDropdown`. When a closed cycle is selected:

1. The page switches to read-only mode
2. Data is loaded from `skill_form_versions.snapshot_data` for that cycle
3. A yellow banner indicates the user is viewing a historical (read-only) record
4. All edit buttons and submit actions are hidden

```
CycleSelectorDropdown
  ├── 'current' → loads from skill_forms (live, active cycle)
  └── <closed cycle UUID> → loads from skill_form_versions (snapshot, read-only)
```

---

## PDF Export

After a form is approved, a PDF download button is available on the employee's dashboard and on the manager review page. The PDF is generated client-side using jsPDF and includes:

- Employee profile information
- Skill ratings with employee and manager ratings side-by-side
- Delta indicators when a previous cycle's ratings are available (shows improvement or regression)
- Certifications
- Upskilling plan and manager expectation plan
- Haptiq branding (header logo, footer)

---

## Notifications

| Event | Who is notified | Notification type |
|---|---|---|
| Employee submits form | Manager | `form_submitted` |
| Manager approves form | Employee | `form_approved` |
| Manager returns form | Employee | `form_returned` |

Notifications appear in the bell icon in the header. `NotificationContext` subscribes to Supabase Realtime changes on the `notifications` table for the current user and falls back to polling every 60 seconds.

---

## Data Persistence: Save Order

On every `persistForm()` call:

```
1. Resolve manager_id from the manager email field
2. Upsert skill_forms (creates or updates; always sets cycle_id = activeCycle.id)
3. Update users table (denormalize grade, designation, manager_id back to the user profile)
4. Call refreshProfile() on AuthContext
5. Delete all existing skill_items for this form
6. Re-insert all skill_items (languages + frameworks + environments)
```

The full delete + re-insert on step 6 is intentional: it avoids tracking which rows were added/removed/modified and keeps the save logic simple and correct.
