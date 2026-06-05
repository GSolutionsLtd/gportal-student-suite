# End-to-end tests (Playwright)

Covers the Assignment Management module:

- `rubric-scoring.spec.ts` — teacher applies a weighted rubric; student sees the breakdown.
- `revision-history.spec.ts` — student resubmits; timeline shows prior revisions; teacher sees rev count.
- `due-reminders.spec.ts` — teacher and student see due-soon reminders in the notification bell.
- `publish-notifications.spec.ts` — teacher publishes an assignment; status flips immediately; student gets the notification.

## Setup

```bash
bun add -D @playwright/test
npx playwright install --with-deps chromium
```

## Credentials

Tests run against a live deployment. Provide credentials via environment variables
(do **not** commit a `.env.e2e` file):

```
E2E_BASE_URL=https://gportals.lovable.app
E2E_SCHOOL_CODE=demo
E2E_TEACHER_EMAIL=...
E2E_TEACHER_PASSWORD=...
E2E_STUDENT_EMAIL=...
E2E_STUDENT_PASSWORD=...
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
```

Tests auto-skip when the relevant credentials are missing.

## Run

```bash
npx playwright test               # all
npx playwright test rubric        # filter by file
npx playwright test --headed      # see the browser
npx playwright show-report
```

## Notes

- The `rubric-scoring` test expects rubric inputs to expose `data-testid="rubric-score-<criterion-id>"`
  and a weighted total with `data-testid="rubric-weighted-total"`. If the teacher rubric panel uses
  different selectors, update them in `rubric-scoring.spec.ts` to match.
- `publish-notifications.spec.ts` creates a new assignment per run; clean up periodically in the admin UI
  or via a SQL prune job to keep the demo school tidy.
