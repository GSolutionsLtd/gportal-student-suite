# CareerAid Portal, Counselor Dashboard & Module Improvements

This is a large scope, so it ships in three phases. Each phase is usable on its own.

## Phase 1 — Fixes and smaller features

**Audit trail CSV export**
Add a "Download CSV" button on the Audit Trail page that exports exactly the rows currently visible (module, action, date range and keyword filters applied), with columns: When, Action, Event, Area, Record ID, By.

**Curriculum note version history**
Every time a lesson/curriculum note is saved or its publish state changes, a snapshot is stored. Teachers and admins get a "History" panel on each note showing who changed what and when, with a "Restore this version" action that rolls the note back (including the publish state at that time). Restores are themselves versioned, so nothing is lost.

**Assignment due notifications**
- Students get a reminder 48h and 24h before `due_at` when they have not submitted.
- Teachers get a reminder 24h before `due_at` for assignments with ungraded or unapproved submissions.
- Runs on a scheduled job; each reminder is sent once per assignment per window.

**Correct class / class-arm display**
Class arms currently render as just the arm name (e.g. "A"). Everywhere an arm is picked or shown — Assignments (admin, teacher, student), Attendance, AI Lesson/Curriculum Planner — it will read as the full label (e.g. "JSS 1 A"), sorted by class level then arm.

## Phase 2 — Public CareerAid Portal

A public, school-independent entry point, mirroring the existing Result Checker.

- New `/careeraid` landing + signup, linked from the homepage next to Check Result.
- Any student can register: those from a subscribed school link via school code + admission number; independent students register with just their own details and no school affiliation.
- Paystack checkout for independent students (a CareerAid subscription). School-affiliated students whose school has the CareerAid feature enabled skip payment.
- After payment/verification the student gets a CareerAid account: personality assessment, AI recommendations, plan and goals, resources, mock interview and counseling booking — the same feature set school students already have.
- Data model: CareerAid records get an optional `school_id` so independent learners are fully supported, with access rules updated accordingly.

## Phase 3 — Career Counselor role, scheduling and wallet

**Counselor role** — a new role with its own dashboard, able to see students from subscribed schools *and* independent CareerAid subscribers.

**Live video scheduling** — booking requests land in a counselor queue; the counselor accepts, reschedules or declines, and the confirmed session gets a meeting link both sides can join from their dashboard at the scheduled time. Session notes and guidance are recorded per student.

**Wallet** — for each calendar month the wallet counts distinct students the counselor actually counseled (completed sessions), accruing N2,000 per student. The dashboard shows the current month's students counseled, accrued balance, and payout history. Withdrawal is only enabled on the 28th of each month; requests are queued for admin approval and marked paid. All balance figures are computed server-side so they cannot be manipulated from the browser.

## Technical notes

- New tables: `lesson_plan_versions`, `careeraid_subscriptions`, `counselor_wallets`, `counselor_wallet_entries`, `counselor_payout_requests`; `app_role` gains `counselor`; `career_counseling_sessions` gains counselor/booking status fields; CareerAid tables get nullable `school_id` for independent students.
- All new tables get GRANTs plus RLS scoped by owner/school/role; wallet accrual and payout eligibility are enforced by database functions and edge functions, never client-side.
- Reminders reuse the existing notifications table and a pg_cron scheduled edge function.
- Paystack reuses the existing initialize/verify payment functions with a CareerAid product path.

Confirm and I'll start with Phase 1.
