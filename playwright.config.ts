import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests covering:
 *  - rubric-weight scoring and revision-history rendering (teacher + student)
 *  - assignment due reminders visible to teachers and students
 *  - published-assignment notifications for students and immediate status reflection for teachers
 *
 * Required env vars (set in .env.e2e or shell, never commit):
 *   E2E_BASE_URL              (e.g. https://gportals.lovable.app)
 *   E2E_SCHOOL_CODE           (e.g. demo)
 *   E2E_ADMIN_EMAIL / _PASSWORD
 *   E2E_TEACHER_EMAIL / _PASSWORD
 *   E2E_STUDENT_EMAIL / _PASSWORD
 *
 * Run:  npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
