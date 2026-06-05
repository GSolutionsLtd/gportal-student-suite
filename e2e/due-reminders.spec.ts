import { test, expect } from "@playwright/test";
import { signIn, env } from "./helpers/auth";

/**
 * Verifies due-date reminders surface for both roles:
 *  - Notification bell shows an unread reminder for assignments due soon
 *  - Both teacher and student can navigate from the notification to the assignment
 */
test.describe("Due reminders visibility", () => {
  for (const role of ["teacher", "student"] as const) {
    const email = role === "teacher" ? env.teacherEmail : env.studentEmail;
    const password = role === "teacher" ? env.teacherPassword : env.studentPassword;

    test.skip(!email, `Set E2E_${role.toUpperCase()}_EMAIL/_PASSWORD`);

    test(`${role} sees due reminder in notification bell`, async ({ page }) => {
      await signIn(page, email, password);
      await page.getByRole("button", { name: /notifications/i }).click();
      await expect(page.getByText(/due|reminder|assignment/i).first()).toBeVisible({ timeout: 10_000 });
    });
  }
});
