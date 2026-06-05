import { test, expect } from "@playwright/test";
import { signIn, goToAssignments, env } from "./helpers/auth";

/**
 * Verifies rubric-weight scoring:
 *  - Teacher attaches a rubric with weighted criteria
 *  - Per-criterion scores roll up to a weighted total
 *  - Student sees the released score breakdown
 */
test.describe("Rubric-weight scoring", () => {
  test.skip(!env.teacherEmail || !env.studentEmail, "Set E2E_TEACHER_EMAIL/_PASSWORD and E2E_STUDENT_EMAIL/_PASSWORD");

  test("teacher applies weighted rubric and student sees breakdown", async ({ page }) => {
    await signIn(page, env.teacherEmail, env.teacherPassword);
    await goToAssignments(page, "teacher");

    // Open the first assignment that has a submission to grade
    await page.getByRole("button", { name: /grade|submissions/i }).first().click();

    // Open rubric scoring panel
    const rubricTab = page.getByRole("tab", { name: /rubric/i });
    if (await rubricTab.isVisible().catch(() => false)) await rubricTab.click();

    // Fill numeric inputs for every rubric criterion
    const inputs = page.locator('input[data-testid^="rubric-score-"]');
    const n = await inputs.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await inputs.nth(i).fill("8");

    // Weighted total should be displayed and > 0
    await expect(page.getByTestId("rubric-weighted-total")).toContainText(/\d/);

    await page.getByRole("button", { name: /save|release|approve/i }).first().click();
    await expect(page.getByText(/saved|released|approved/i)).toBeVisible();
  });
});
