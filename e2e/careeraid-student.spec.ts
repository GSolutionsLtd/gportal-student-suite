import { test, expect } from "@playwright/test";
import { env, signIn } from "./helpers/auth";

test.describe("CareerAid — student flows", () => {
  test.skip(!env.studentEmail, "Set E2E_STUDENT_EMAIL/_PASSWORD to enable");

  test.beforeEach(async ({ page }) => {
    await signIn(page, env.studentEmail, env.studentPassword);
    await page.goto(`/${env.schoolCode}/student/careeraid`);
    await expect(page.getByRole("heading", { name: /careeraid/i })).toBeVisible();
  });

  test("Holland quiz → recommendations → PDF download", async ({ page }) => {
    await page.getByRole("tab", { name: /assessment/i }).click();
    const radios = page.getByRole("radio");
    const count = await radios.count();
    test.skip(count === 0, "Assessment already taken; skip quiz flow");

    // Answer every question by clicking the middle radio per group.
    const groups = page.locator("[role='radiogroup']");
    const groupCount = await groups.count();
    for (let i = 0; i < groupCount; i++) {
      await groups.nth(i).getByRole("radio").nth(2).click();
    }
    await page.getByRole("button", { name: /submit|generate/i }).click();
    await expect(page.getByText(/recommendation|career plan/i).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: /plan/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /download.*pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("schedule and view counseling session", async ({ page }) => {
    await page.getByRole("tab", { name: /counsel/i }).click();
    await page.getByRole("button", { name: /schedule|book/i }).first().click();
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
    await page.getByLabel(/date|time/i).first().fill(future);
    await page.getByRole("button", { name: /confirm|save|book/i }).click();
    await expect(page.getByRole("link", { name: /join/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("mock interview returns scoring feedback", async ({ page }) => {
    await page.getByRole("tab", { name: /mock interview/i }).click();
    await page.getByRole("button", { name: /start|begin/i }).first().click();
    const answer = page.getByRole("textbox").first();
    await answer.fill("I led a team project where I coordinated tasks and delivered on time.");
    await page.getByRole("button", { name: /submit|finish/i }).click();
    await expect(page.getByText(/score|feedback/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
