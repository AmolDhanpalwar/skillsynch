# Roles and Permissions

SkillSync has five user roles. Role is stored in `users.role` and drives both client-side route guards and server-side RLS policies.

---

## Role Definitions

### `employee`

A regular team member who fills out the skill assessment form.

- Has exactly one skill form per review cycle
- Can save drafts and submit for review
- Can view and re-edit their form only when in `draft` or `returned` state within the active cycle
- Cannot view other employees' forms
- Receives notifications when their form is approved or returned
- Can view their own historical assessments (read-only) via the cycle selector on the dashboard

### `manager`

A team lead or direct-line manager who reviews their direct reports' forms.

- Reviews forms where `skill_forms.manager_id = their user id`
- Can assign skill ratings (manager_rating) and add comments per skill item
- Can approve or return forms (with a reason)
- Can view direct reports' profiles in the user list
- Cannot submit or edit their own employee-level form (unless they also have an employee form assigned)
- Receives `form_submitted` notifications when any of their direct reports submits

### `tmg` (Technical Manager Group)

Senior technical leaders with cross-team visibility.

- Can view **all** skill forms across all employees and all cycles
- Can edit any form (reassign managers, update grade/designation)
- Access to Skills Matrix, TMG Dashboard, Cycles, and Status pages
- Can manage master settings: skills, certifications, grades, designations, rating scales
- Can change which manager is assigned to any employee's form
- Can create and activate review cycles
- Can view historical cycle data via the cycle selector

### `management`

Business or function heads with read-only analytics access.

- Can view all skill forms (read-only) for any cycle
- Access to Reports, Skills Matrix, TMG Dashboard, and Status pages
- Cannot modify any forms or settings
- Cannot manage users
- Cannot create or manage review cycles

### `admin`

Full system access.

- All TMG capabilities, plus:
- Can create, deactivate, and manage all user accounts
- Can reset user passwords
- Can assign or change any user's role
- Has access to the Admin page
- Can configure Google SSO (enable/disable, set Client ID) via the SSO Configuration panel
- Can assign roles to any user by email lookup via the Role Assignment panel (particularly useful for promoting users to `tmg` or `management`)

---

## Permission Matrix

| Capability | employee | manager | tmg | management | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| View own dashboard | Y | Y | Y | Y | Y |
| Complete skill form | Y | — | — | — | — |
| Save form as draft | Y | — | — | — | — |
| Submit form for review | Y | — | — | — | — |
| Re-submit returned form | Y | — | — | — | — |
| View own form (any status) | Y | — | — | — | — |
| View historical own assessments | Y | — | — | — | — |
| View team members' forms | — | Y | Y | Y | Y |
| Add manager ratings & comments | — | Y | Y | — | Y |
| Approve form | — | Y | Y | — | Y |
| Return form for revision | — | Y | Y | — | Y |
| View TMG Dashboard | — | — | Y | Y | Y |
| View Skills Matrix | — | — | Y | Y | Y |
| View Status page | — | — | Y | Y | Y |
| View Reports & Analytics | — | — | — | Y | Y |
| View historical cycle data (any employee) | — | — | Y | Y | Y |
| Export data to Excel / PDF | — | — | Y | Y | Y |
| Create & manage review cycles | — | — | Y | — | Y |
| Activate review cycle (resets all forms) | — | — | Y | — | Y |
| Manage skill settings (languages, etc.) | — | — | Y | — | Y |
| Manage grades & designations | — | — | Y | — | Y |
| Change employee's manager assignment | — | — | Y | — | Y |
| Create user accounts | — | — | — | — | Y |
| Reset user passwords | — | — | — | — | Y |
| Deactivate users | — | — | — | — | Y |
| Change user roles | — | — | — | — | Y |
| Configure Google SSO (enable/disable, set Client ID) | — | — | — | — | Y |
| Assign roles by email lookup | — | — | — | — | Y |

---

## Route Guards

Routes are protected by `<PrivateRoute allowedRoles={[...]} />`. If the authenticated user's role is not in the `allowedRoles` array they are redirected to their role-specific home.

```tsx
// Example — TMG Dashboard is accessible to tmg, management, and admin
<Route
  path="/tmg-dashboard"
  element={
    <PrivateRoute allowedRoles={['tmg', 'management', 'admin']}>
      <TmgDashboardPage />
    </PrivateRoute>
  }
/>
```

Unauthenticated users hitting any protected route are redirected to `/login`.

### Route Access by Role

| Route | employee | manager | tmg | management | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `/dashboard` | Y | Y | Y | Y | Y |
| `/form` | Y | — | — | — | — |
| `/form/review/:formId` | — | Y | Y | — | Y |
| `/inbox` | — | Y | Y | — | Y |
| `/inbox/review/:formId` | — | Y | Y | — | Y |
| `/tmg-dashboard` | — | — | Y | Y | Y |
| `/skills-matrix` | — | — | Y | Y | Y |
| `/cycles` | — | — | Y | — | Y |
| `/status` | — | — | Y | Y | Y |
| `/reports` | — | — | — | Y | Y |
| `/settings` | — | — | Y | — | Y |
| `/emp-settings` | — | — | Y | — | Y |
| `/admin` | — | — | — | — | Y |
| `/help/powerbi` | Y | Y | Y | Y | Y |

### Role Home Paths

After login, each role is sent to their primary landing page:

| Role | Home Path |
|---|---|
| `employee` | `/dashboard` |
| `manager` | `/inbox` |
| `tmg` | `/tmg-dashboard` |
| `management` | `/reports` |
| `admin` | `/admin` |

---

## Sidebar Navigation by Role

The sidebar renders only the links relevant to the authenticated user's role.

| Nav Item | employee | manager | tmg | management | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | Y | Y | Y | Y | Y |
| My Skill Form | Y | — | — | — | — |
| Inbox | — | Y | Y | — | Y |
| TMG Dashboard | — | — | Y | Y | Y |
| Form Status | — | — | Y | Y | Y |
| Skills Matrix | — | — | Y | Y | Y |
| Review Cycles | — | — | Y | — | Y |
| Reports | — | — | — | Y | Y |
| Skills Settings | — | — | Y | — | Y |
| Employee Settings | — | — | Y | — | Y |
| Admin | — | — | — | — | Y |
| Power BI Guide | Y | Y | Y | Y | Y |

---

## SSO Configuration Access

The `sso_config` table uses three RLS policies:

| Policy | Who | Permission |
|---|---|---|
| `admin_all_sso_config` | `admin` role (authenticated) | Full CRUD |
| `authenticated_read_sso_config` | Any authenticated user | SELECT only |
| `anon_read_sso_config` | Unauthenticated (anon key) | SELECT only |

The anon read policy is required so the login page can check `enabled` before the user has a session. It does **not** expose secrets — `client_id` is a public OAuth client identifier, not a secret.

---

## RLS Enforcement

Role checks in database policies use the `get_my_role()` helper function to avoid infinite recursion when querying the `users` table from within a policy:

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;
```

Example policy pattern:

```sql
-- TMG/admin can update any skill form
CREATE POLICY "TMG and admin can update any form"
  ON skill_forms FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('tmg', 'admin'))
  WITH CHECK (get_my_role() IN ('tmg', 'admin'));
```

See [DATABASE.md — Row Level Security](DATABASE.md#row-level-security) for the complete set of RLS policies.

---

## SECURITY DEFINER Functions

Some operations require bypassing RLS because they involve updating rows not owned by the calling user. These use SECURITY DEFINER PostgreSQL functions that run as the `postgres` superuser role:

| Function | Who can call | Why RLS bypass is needed |
|---|---|---|
| `activate_cycle_reset_forms(p_cycle_id)` | `authenticated` (tmg/admin in practice) | Must reset ALL employees' `skill_forms` to `draft`, including rows not owned by the caller |
| `create_approval_snapshot()` | Postgres trigger (internal only) | Must write to `skill_form_versions` which has no direct-write policy for the anon key |

**Principle of least privilege:** only `activate_cycle_reset_forms` is `GRANT EXECUTE TO authenticated`. The snapshot function is only callable via the trigger — it is not exposed as an RPC.

---

## Assigning Roles

Roles can only be assigned by an `admin` via the Admin page, which calls the `admin-create-user` Edge Function (service role) to create the auth account and profile simultaneously. Existing user roles can be updated directly by admin users through the Admin page UI.

There is no self-service role change — all role assignments require admin action.
