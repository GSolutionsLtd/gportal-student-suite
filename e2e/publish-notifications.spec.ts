import { test, expect } from "@playwright/test";
import { signIn, goToAssignments, env } from "./helpers/auth";

/**
 * Verifies publish workflow:
 *  - Teacher publishes a draft assignment and the status pill flips immediately
 *  - Student then sees the published assignment + a "New assignment published" notification
 */
test.describe("Publish flow notifications", () => {
  test.skip(!env.teacherEmail || !env.studentEmail, "Set teacher + student E2E credentials");

  const title = `E2E Published ${Date.now()}`;

  test("teacher publishes — status updates immediately in UI", async ({ page }) => {
    await signIn(page, env.teacherEmail, env.teacherPassword);
    await goToAssignments(page, "teacher");

    await page.getByRole("button", { name: /new assignment|create/i }).click();
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/instructions/i).fill("E2E published assignment");
    await page.getByRole("button", { name: /save (as )?draft|create/i }).click();
    await expect(page.getByText(title)).toBeVisible();

    const row = page.locator(`text=${title}`).locator("xpath=ancestor::*[contains(@class,'rounded-lg')][1]");
    await row.getByRole("button", { name: /publish/i }).click();
    await expect(row.getByText(/published/i)).toBeVisible({ timeout: 5_000 });
  });

  test("student receives published-assignment notification", async ({ page }) => {
    await signIn(page, env.studentEmail, env.studentPassword);

    await page.getByRole("button", { name: /notifications/i }).click();
    await expect(page.getByText(/new assignment published/i).first()).toBeVisible({ timeout: 15_000 });

    await goToAssignments(page, "student");
    await expect(page.getByText(title)).toBeVisible();
  });
});
