# Test Plan

## Overview

The test suite uses **Vitest** with **@testing-library/react** for component and hook tests. All tests live under `src/test/`. There are currently **230+ tests across 14 test files**.

Run the full suite:

```bash
npm test           # watch mode
npx vitest run     # single run, CI
```

---

## Test Files

| File | Coverage Area | Tests |
|------|--------------|-------|
| `schema.test.ts` | Zod schemas, form constants, factories | 59 |
| `ToastContext.test.tsx` | Toast rendering, auto-dismiss, limits | 14 |
| `AuthContext.test.tsx` | Auth state, sign-in/out, Google SSO, error guard | 18 |
| `CycleContext.test.tsx` | Cycle context state, active cycle, Realtime | ~15 |
| `FormContext.test.tsx` | Form context state, setters, error guard | 12 |
| `useSkillRatings.test.ts` | Skill ratings hook (DB fetch, fallback) | 13 |
| `exportServiceHelpers.test.ts` | Pure export utility functions | 27 |
| `Step4Plans.test.tsx` | Step 4 component (render, lock, onChange) | 14 |
| `StatusBadge.test.tsx` | StatusBadge component across all statuses | 8 |
| `StepIndicator.test.tsx` | StepIndicator progress rendering | 10 |
| `PrivateRoute.test.tsx` | Route guarding by role and auth state | 12 |
| `experienceFields.test.tsx` | Experience field components | ~31 |
| `utils.test.ts` | Utility helpers (role labels, initials) | ~20 |

---

## Coverage Areas

### Zod Schema Validation (`schema.test.ts`)

**`expField` validation** — tests the shared experience number field used for `total_exp`, `relevant_exp`, and `haptiq_exp`:

| Scenario | Expected |
|----------|----------|
| Integer string `"10"` | Pass |
| Decimal `"1.5"` | Pass |
| Boundary `"0"` and `"50"` | Pass |
| Numeric type `10` | Pass (coerced from number) |
| Empty string `""` | Fail — "This field is required" |
| Non-numeric `"abc"` | Fail — "Enter a valid number" |
| Value `> 50` | Fail — "Must be 50 or less" |
| Value `< 0` | Fail — "Must be 0 or more" |
| `NaN` | Fail — Zod union rejects at type level |
| `null` | Fail — Zod union rejects at type level |
| Whitespace `"   "` | Pass — `Number("   ") === 0` is in range |

**`step1Schema` required fields** — all mandatory profile fields reject empty values.

**Manager cross-field validation:**
- Both empty → pass
- Both provided with valid email → pass
- Name set, email empty → fail with "Manager email is required when manager name is provided"
- Email set but invalid → fail with "Enter a valid email"
- Email alone (valid) → pass

**`makeStep1Schema` dynamic validation** — when `validGrades` and `validDesignations` arrays are provided, rejects values not in those lists. Empty arrays skip validation (used before DB options load).

**Factories and constants** — `makeSkillRow`, `makeDefaultStep3/4/StepAdditional`, `FORM_STEPS`, `STATUS_CONFIG`, `DRAFT_KEY`, `SEED_LANGUAGES`, `SEED_FRAMEWORKS`.

---

### Toast Context (`ToastContext.test.tsx`)

Separated into **real-timer** and **fake-timer** groups to avoid `userEvent`/`vi.useFakeTimers()` deadlocks.

| Group | Tests |
|-------|-------|
| Rendering — no toast on mount | Real timers |
| All 4 types + custom show correctly | Real timers |
| Multiple toasts visible simultaneously | Real timers |
| Auto-dismiss after 3500ms + 300ms | Fake timers, `act()` |
| Dismiss button clears toast early | Fake timers, `act()` |
| Max 5 toast limit (slice -4 + 1) | Real timers |
| Error when used outside provider | Real timers |
| `aria-live="polite"` region present | Real timers |

**Key pattern for fake-timer tests:** use `await act(async () => { button.click(); })` rather than `await userEvent.click()`, then advance timers inside separate `await act(async () => { vi.advanceTimersByTime(n); })` calls.

---

### Auth Context (`AuthContext.test.tsx`)

Supabase is fully mocked using `vi.hoisted()` to ensure mock variables are initialized before `vi.mock()` factory runs.

| Scenario | Tests |
|----------|-------|
| No session — loading resolves to false, user is null | 3 |
| With session — profile loaded, role correct | 3 |
| `signIn` — correct credentials passed, success/error returned | 3 |
| `signOut` — calls supabase.auth.signOut | 1 |
| `signInWithGoogle` — calls supabase.auth.signInWithOAuth with `provider: 'google'` | 1 |
| `signInWithGoogle` — returns `{ error: null }` on success | 1 |
| `signInWithGoogle` — returns `{ error }` on failure | 1 |
| Error guard — throws outside AuthProvider | 1 |

The mock chain: `getSession → { data: { session } }`, `from().select().eq().maybeSingle() → { data: profile }`.
`signInWithOAuth` is mocked via `mockSignInWithOAuth` in `vi.hoisted()`.

---

### Cycle Context (`CycleContext.test.tsx`)

Supabase is fully mocked. Tests verify the cycle data fetching and selection logic.

| Scenario | Tests |
|----------|-------|
| No cycles in DB — `activeCycle` is null, `cycles` is empty | 2 |
| Active cycle present — `activeCycle` set correctly | 2 |
| Multiple cycles — `activeCycle` identifies the one with `status = 'active'` | 2 |
| `cycles` array contains all cycles including closed ones | 2 |
| `loading` starts true, resolves to false after fetch | 2 |
| Error guard — `useCycle()` throws outside `CycleProvider` | 1 |
| Realtime subscription set up on `review_cycles` channel | 2 |

**Key invariant tested:** `activeCycle` is always the cycle with `status = 'active'`, regardless of position in the array.

---

### Form Context (`FormContext.test.tsx`)

Tests `useFormContext` state management for multi-step form:

- Initial values for all step data
- `setStep1`, `setStep2`, `setStep3`, `setStep4`, `setStepAdditional` update state correctly
- `setCurrentStep` updates active step
- `setFormId` and `setStatus` update form metadata
- Error guard — throws outside FormProvider

---

### Skill Ratings Hook (`useSkillRatings.test.ts`)

Uses `vi.hoisted()` for the Supabase mock chain (`from().select().eq().order()`).

| Scenario | Tests |
|----------|-------|
| `loading: true` initially | 1 |
| Fallback ratings returned before DB responds | 1 |
| `loading: false` after fetch | 1 |
| DB ratings replace fallback | 1 |
| Correct table, filter, and sort queried | 3 |
| Empty DB → fallback retained | 2 |
| `null` DB response → fallback retained | 1 |
| Custom DB ratings used when provided | 1 |

---

### Export Helpers (`exportServiceHelpers.test.ts`)

Pure function tests (no mocks needed):

| Function | Tests |
|----------|-------|
| `formatDate` — null, valid ISO, boundary dates | 4 |
| `daysPending` — null submit, same day, day count, in-progress, negative guard | 5 |
| `safeStr` — null, undefined, string, number, zero, empty | 6 |
| `titleCase` — snake_case, single word, already correct, multi-underscore | 5 |
| `autoWidth` — column count, min 10, max 50, padding, longest cell, null values, empty | 7 |

---

### Step 4 Plans Component (`Step4Plans.test.tsx`)

| Group | Tests |
|-------|-------|
| Rendering — textareas present, info box, pre-filled values | 6 |
| Unlocked interaction — onChange called with correct shape | 2 |
| Locked state — textarea disabled, onChange not called, CSS class | 3 |
| Manager expectation — always disabled (read-only for employees) | 1 |
| onChange shape — preserves other fields when one changes | 1 |

---

### StatusBadge Component (`StatusBadge.test.tsx`)

All 4 statuses (`draft`, `pending_review`, `returned`, `approved`) render the correct label text and apply distinct CSS classes.

---

### StepIndicator Component (`StepIndicator.test.tsx`)

- Steps 1–5 rendered with correct numbers
- Completed steps show checkmark icon, not number
- Current step highlighted
- Connector bar between steps present
- Progress bar width proportional to current step

---

### PrivateRoute Component (`PrivateRoute.test.tsx`)

`useAuth` is mocked to control `loading`, `user`, and `role`.

| Scenario | Expected |
|----------|----------|
| `loading: true` | Spinner rendered |
| `user: null` | Redirect to `/login` |
| Correct role | Children rendered |
| Wrong role (e.g. employee accessing admin route) | Redirect to role home |

---

## Mocking Strategy

### Supabase client

Always mock via `vi.hoisted()` + `vi.mock('../lib/supabaseClient', ...)` to avoid hoisting errors:

```typescript
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));
```

For RPC calls, mock `supabase.rpc`:

```typescript
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));
```

### React Router

Wrap components in `<MemoryRouter>` for components that use `useNavigate` or `<Link>`.

### Fake timers

Use `vi.useFakeTimers()` / `vi.useRealTimers()` in `beforeEach`/`afterEach`. Never mix `userEvent` async clicks with fake timers — use direct `.click()` calls wrapped in `await act(async () => { ... })`.

---

## Recommended New Tests

The following tests should be added to improve coverage of the cycle system:

### Cycle-Aware `isApproved` Logic

Test the derived values in `SkillFormPage`:

| Scenario | Expected |
|----------|----------|
| Form `status = 'approved'` AND `cycle_id = activeCycle.id` | `isApproved = true`, form locked |
| Form `status = 'approved'` AND `cycle_id ≠ activeCycle.id` (old cycle) | `isApproved = false`, form editable |
| Form `status = 'pending_review'` AND belongs to active cycle | `isLocked = true` |
| Form `status = 'pending_review'` AND belongs to old cycle | `isLocked = false` |
| No `activeCycle` | Falls back to raw `status` check |

### CycleSelectorDropdown (`buildCycleOptions`)

The `buildCycleOptions` pure function in `CycleSelectorDropdown.tsx` is unit-testable:

| Scenario | Expected |
|----------|----------|
| No active cycle, no closed cycles | Returns one "No active cycle" option |
| Active cycle, no closed cycles | Returns one current option only |
| Active cycle + 2 closed cycles | Returns 3 options; current first, closed sorted newest-first |
| Closed cycles sorted by `closed_at` descending | Most recently closed appears second |
| `isCurrent` flag set correctly | Only the first option has `isCurrent = true` |

### Historical Snapshot Loading

Mock `supabase.from('skill_form_versions')` and verify:

| Scenario | Expected |
|----------|----------|
| Closed cycle selected | Loads from `skill_form_versions`, not `skill_forms` |
| No snapshot found for a closed cycle | Shows "No approved assessment found" message |
| Snapshot found | Displays read-only data from `snapshot_data` |
| Switch from history to current | Re-loads from `skill_forms` |

### `activate_cycle_reset_forms` RPC Call

Mock `supabase.rpc` and verify `CyclesPage.handleActivate`:

| Scenario | Expected |
|----------|----------|
| RPC succeeds | Cycle shows as active in UI, success toast shown |
| RPC returns error | Error toast shown, cycle status unchanged |
| RPC called with correct `p_cycle_id` | Argument matches the activated cycle's `id` |

---

### SSO Configuration Panel (`SsoConfigPanel` in `AdminPage.tsx`)

Mock `supabase.from('sso_config')` and verify:

| Scenario | Expected |
|----------|----------|
| Renders toggle and Client ID input | Both present on mount |
| Fetches current config on mount | `from('sso_config').select('*').eq('provider','google')` called |
| Toggle reflects DB `enabled` state | When DB returns `enabled: true`, toggle is checked |
| Save calls update with correct payload | `from('sso_config').update({ enabled, client_id, updated_by, updated_at }).eq('provider','google')` |
| Save success shows success toast | Toast message visible after save |
| Save error shows error toast | Error message visible on DB failure |

---

### `signInWithGoogle` via `AuthContext`

These scenarios should be covered in `AuthContext.test.tsx`:

| Scenario | Expected |
|----------|----------|
| Calls `supabase.auth.signInWithOAuth` with `{ provider: 'google' }` | `mockSignInWithOAuth` receives correct args |
| Returns `{ error: null }` when `signInWithOAuth` resolves without error | Result error is null |
| Returns `{ error }` when `signInWithOAuth` returns an error | Error propagated correctly |

---

### `LoginPage` — Google SSO Button Visibility

Mock `supabase.from('sso_config')` and verify:

| Scenario | Expected |
|----------|----------|
| `sso_config` returns `enabled: false` | Google button NOT rendered |
| `sso_config` returns `enabled: true` | Google button rendered |
| `sso_config` fetch fails | Google button NOT rendered (safe fallback) |
| `sso_config` returns `enabled: true` and button clicked | `signInWithGoogle()` called |

---

### Role Assignment Panel (`RoleAssignPanel` in `AdminPage.tsx`)

Mock `supabase.from('users')` and verify:

| Scenario | Expected |
|----------|----------|
| Email search returns no user | "No user found" message shown |
| Email search returns a user | User card with name, email, current role rendered |
| Role dropdown changes | New role reflected in UI |
| Assign button with same role | Button disabled, "no change" state |
| Assign button with new role | `from('users').update({ role }).eq('id', foundUser.id)` called |
| Update succeeds | Success toast, role badge updated in UI |
| Update fails | Error toast shown |

---

## Running Specific Tests

```bash
# Single file
npx vitest run src/test/schema.test.ts

# Pattern match
npx vitest run --reporter=verbose schema

# With coverage (requires @vitest/coverage-v8)
npx vitest run --coverage
```

---

## What Is Not Tested

The following are intentionally excluded from unit tests — they require live Supabase or a running browser:

- `SkillFormPage` — complex multi-step form with DB reads/writes and cycle context
- `ManagerReviewPage`, `AdminPage`, `TmgDashboardPage` — require authenticated sessions
- `CyclesPage` — requires live Supabase RPC and Realtime
- Edge functions (`admin-create-user`, `admin-reset-password`, etc.) — tested via Supabase dashboard
- Export service (`exportService.ts`) XLSX/PDF generation — DOM and blob APIs not available in jsdom; helper functions are tested via `exportServiceHelpers.test.ts`
- `skill_form_versions` snapshot trigger — requires live Postgres trigger execution
