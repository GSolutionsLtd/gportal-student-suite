This request bundles two large efforts. To keep quality high, I'll deliver it in clearly-scoped phases and confirm priorities before writing code.

## Phase A — Playwright hardening (1 turn)
1. Add a seed script `e2e/fixtures/seed.ts` that, using the service-role key, creates: a school, admin/teacher/student users, an assignment with rubric criteria + weights, a published state with `due_at` ~24h ahead, and two submission revisions. Wired as a Playwright `globalSetup`.
2. Replace placeholder specs with real assertions:
   - `rubric-scoring.spec.ts`: teacher enters weighted scores → student sees weighted total + per-criterion breakdown.
   - `revision-history.spec.ts`: student resubmits → both roles see ordered timeline (rev #1, #2) with timestamps.
   - `due-reminders.spec.ts`: invoke `notify_due_assignments` RPC → bell shows "due soon" for teacher and student.
   - `publish-notifications.spec.ts`: teacher publishes → student notification appears in realtime; teacher UI badge flips to Published without reload.

## Phase B — CareerAid Clinic v2 (split across 3–4 turns)

### B1. Data model (1 migration)
New tables (all school-scoped, RLS + GRANTs):
- `career_assessments` — Holland Code results (RIASEC scores, dominant type) per student.
- `career_recommendations` — header row per generation (student, assessment_id, created_at, summary).
- `career_recommendation_paths` — 5 ranked rows per recommendation: career_title, rank, ss_subjects[], university_courses[], jamb_subjects[], jamb_cutoff, universities[], polytechnics[], colleges_of_education[], tech_skills[], soft_skills[], salary_insight, market_relevance.
- `career_counseling_sessions` — student, counselor_user_id, scheduled_at, status, meeting_url, notes.
- `career_mock_interviews` — student, career_path, questions JSONB, answers JSONB, score, feedback, taken_at.
Keep existing `career_resources`, `student_career_profiles`, `student_career_saves`.

### B2. AI edge function
`supabase/functions/careeraid-recommend/index.ts` — takes assessment_id, calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a Nigerian-context structured-output prompt, writes recommendation + 5 paths. Second function `careeraid-mock-interview` generates questions and scores answers.

### B3. Student UI
Tabs in `StudentCareerAid.tsx`: **Assessment** (Holland Code quiz, 30 items), **My Career Plan** (latest recommendation + 5 ranked paths, PDF download via jsPDF), **History**, **Counseling** (book session, list upcoming, join link), **Mock Interview** (pick career, answer, get score), plus existing Explore/Saved/Profile.

### B4. Teacher & Admin UI
- `TeacherCareerAid.tsx` → real page (no longer aliasing Admin): list of students in assigned class arms, drill into their profile, latest recommendation, history. Read-only.
- `AdminCareerAid.tsx` → tabs: **Resources** (existing), **Students** (all CareerAid users), **Assessments**, **Recommendations history**, **Counseling sessions** (with realtime monitoring), **Analytics** (counts, top career paths, sessions/month bar chart).

## Technical notes
- Video counseling = generated meeting URL field (Jitsi Meet room) — no proprietary SDK needed unless you want Daily/Twilio integration (extra secret).
- PDF download uses existing `jspdf` already in the project.
- All new tables get audit_logs triggers consistent with Module 2.

## What I need from you before I start coding
Please confirm:
1. **Order**: Phase A first (Playwright), then B1→B4? Or start CareerAid immediately and do Playwright after?
2. **Video counseling**: Jitsi Meet (free, instant, no key) OR plug in Daily.co/Twilio (you'd provide API key)?
3. **Holland Code quiz length**: standard 60 items, short 30 items, or ultra-short 12 items?
4. **AI model**: default `google/gemini-3-flash-preview` OK, or want `gemini-3-pro` for higher quality recommendations (slower/costlier)?

Once you answer, I'll execute phase by phase, each in its own turn so migrations stay reviewable.