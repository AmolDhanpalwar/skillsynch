# Skill Assessment Form — Flow and Lifecycle

---

## Form Lifecycle

A skill form moves through a fixed set of statuses. The current status determines what actions are available to each actor.

```
                        ┌───────────┐
                        │           │
Employee creates / ───► │   DRAFT   │ ◄──── Manager returns (with notes)
edits form              │           │             │
                        └─────┬─────┘             │
                              │                   │
                    Employee submits               │
                              │                   │
                              ▼                   │
                        ┌───────────┐             │
                        │ PENDING   │             │
                        │  REVIEW   │             │
                        └─────┬─────┘             │
                              │                   │
                   Manager reviews                │
                              │                   │
               ┌──────────────┼──────────────┐    │
               │              │              │    │
            Approve        Return            └────┘
               │              │
               ▼
         ┌───────────┐
         │ APPROVED  │  (locked — read-only for all)
         └───────────┘
```

### Status Descriptions

| Status | Who sets it | Form is editable by | Notes |
|---|---|---|---|
| `draft` | Employee (auto on first save) | Employee | Auto-saved locally and to DB |
| `pending_review` | Employee (explicit submit) | Nobody | Manager notified |
| `returned` | Manager | Employee | Manager's notes shown to employee |
| `approved` | Manager | Nobody (read-only) | Employee notified; all fields locked |

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

Step navigation is managed by `FormContext` (`currentStep` state). The actual form data for Step 1 is managed by React Hook Form; Steps 2–5 use local `useState` inside `SkillFormPage`.

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

The Zod schema receives the valid options list at runtime (after options load from Supabase). If a pre-filled grade (e.g. from an old review cycle) is no longer valid, the schema rejects it with: `"M10" is not a valid grade — please select from the list`.

Designation options are filtered by the selected grade. Selecting a new grade clears the designation field.

### Pre-population

When a form record exists in the DB, fields are pre-populated from `skill_forms`. The manager is resolved from `skill_forms.manager_id` (preferred) or `users.manager_id` as a fallback.

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

Options come from `settings_environments`. The `is_haptiq_demand` flag on environment records is used in reporting to highlight skills the company prioritises.

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
| Page load | If a DB form exists, `localStorage` draft is discarded; DB is source of truth |

---

## Manager Review Flow

When a manager opens a form from their Inbox:

1. `ManagerReviewPage` fetches the full `skill_forms` record and all `skill_items`
2. All employee-filled fields are displayed read-only
3. Manager-editable fields (ratings, comments, expectation plan) are active
4. `manager_review_date` is set on the form record on first open
5. The manager can:
   - **Approve** — sets `status = 'approved'`, `approved_at = now()`, notifies employee
   - **Return** — sets `status = 'returned'`, saves a return reason in the form, notifies employee

Manager changes to skill items (ratings, comments) are saved when the manager clicks Approve or Return, not continuously.

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
2. Upsert skill_forms (creates or updates the single form record)
3. Update users table (denormalize grade, designation, manager_id back to the user profile)
4. Call refreshProfile() on AuthContext
5. Delete all existing skill_items for this form
6. Re-insert all skill_items (languages + frameworks + environments)
```

The full delete + re-insert on step 6 is intentional: it avoids tracking which rows were added/removed/modified and keeps the save logic simple and correct.
