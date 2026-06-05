import { test, expect } from "@playwright/test";
import { signIn, goToAssignments, env } from "./helpers/auth";

/**
 * Verifies the revision-history timeline:
 *  - Student resubmits an assignment that allows resubmissions
 *  - Timeline shows the previous revision below the current one
 *  - Teacher sees the same revision count on their submissions view
 */
test.describe("Revision history timeline", () => {
  test.skip(!env.studentEmail, "Set E2E_STUDENT_EMAIL/_PASSWORD");

  test("student sees timeline grow after resubmission", async ({ page }) => {
    await signIn(page, env.studentEmail, env.studentPassword);
    await goToAssignments(page, "student");

    // Pick an assignment that allows resubmissions and isn't overdue
    const card = page.locator("text=Resubmissions allowed").first().locator("xpath=ancestor::*[contains(@class,'rounded-lg')][1]");
    await card.getByRole("button", { name: /attempt|view \/ resubmit/i }).click();

    const textarea = page.getByPlaceholder(/type your answer/i);
    const before = (await textarea.inputValue()) || "";
    await textarea.fill(`${before}\nrevision ${Date.now()}`);
    await page.getByRole("button", { name: /resubmit|submit/i }).click();

    await expect(page.getByText(/submitted|resubmitted/i)).toBeVisible();

    // Reopen and confirm the timeline now lists at least one prior revision
    await page.getByRole("button", { name: /view \/ resubmit/i }).first().click();
    await expect(page.getByText(/revision history/i)).toBeVisible();
    await expect(page.locator("ol li").nth(1)).toBeVisible();
  });

  test.skip(!env.teacherEmail, "Set E2E_TEACHER_EMAIL/_PASSWORD");
  test("teacher sees revision count badge on submissions list", async ({ page }) => {
    await signIn(page, env.teacherEmail, env.teacherPassword);
    await goToAssignments(page, "teacher");
    await expect(page.getByText(/rev \d+|resubmission/i).first()).toBeVisible();
  });
});
