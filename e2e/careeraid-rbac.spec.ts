import { test, expect } from "@playwright/test";
import { env, signIn } from "./helpers/auth";

test.describe("CareerAid — RBAC visibility", () => {
  test("teacher sees only their assigned class arms", async ({ page }) => {
    test.skip(!env.teacherEmail, "Set E2E_TEACHER_EMAIL/_PASSWORD");
    await signIn(page, env.teacherEmail, env.teacherPassword);
    await page.goto(`/${env.schoolCode}/teacher/careeraid`);
    await expect(page.getByRole("heading", { name: /careeraid/i })).toBeVisible();

    // Teacher dashboard must scope to assigned class arms only.
    const scopeHint = page.getByText(/assigned class|your class/i);
    await expect(scopeHint.first()).toBeVisible();
    await expect(page.getByText(/all students.*school/i)).toHaveCount(0);
  });

  test("admin sees school-wide roster, assessments, counseling, analytics", async ({ page }) => {
    test.skip(!env.adminEmail, "Set E2E_ADMIN_EMAIL/_PASSWORD");
    await signIn(page, env.adminEmail, env.adminPassword);
    await page.goto(`/${env.schoolCode}/admin/careeraid`);
    await expect(page.getByTestId("admin-careeraid")).toBeVisible();

    for (const name of [/resources/i, /students/i, /assessments/i, /counseling/i, /analytics/i]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    await page.getByRole("tab", { name: /students/i }).click();
    await expect(page.getByText(/all students/i)).toBeVisible();

    await page.getByRole("tab", { name: /analytics/i }).click();
    await expect(page.getByText(/holland code distribution/i)).toBeVisible();
  });

  test("student cannot reach admin CareerAid route", async ({ page }) => {
    test.skip(!env.studentEmail, "Set E2E_STUDENT_EMAIL/_PASSWORD");
    await signIn(page, env.studentEmail, env.studentPassword);
    await page.goto(`/${env.schoolCode}/admin/careeraid`);
    await expect(page).not.toHaveURL(/\/admin\/careeraid$/);
  });
});
