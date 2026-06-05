import { Page, expect } from "@playwright/test";

export const env = {
  schoolCode: process.env.E2E_SCHOOL_CODE || "demo",
  adminEmail: process.env.E2E_ADMIN_EMAIL || "",
  adminPassword: process.env.E2E_ADMIN_PASSWORD || "",
  teacherEmail: process.env.E2E_TEACHER_EMAIL || "",
  teacherPassword: process.env.E2E_TEACHER_PASSWORD || "",
  studentEmail: process.env.E2E_STUDENT_EMAIL || "",
  studentPassword: process.env.E2E_STUDENT_PASSWORD || "",
};

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/(super-admin|[^/]+\/(admin|teacher|student|parent))/, { timeout: 15_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/auth/);
}

export async function goToAssignments(page: Page, role: "admin" | "teacher" | "student") {
  await page.goto(`/${env.schoolCode}/${role}/assignments`);
  await expect(page.getByRole("heading", { name: /assignment/i }).first()).toBeVisible();
}
