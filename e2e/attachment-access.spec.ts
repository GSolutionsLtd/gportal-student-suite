import { test, expect, request } from "@playwright/test";
import { env, signIn } from "./helpers/auth";

/**
 * Verifies that assignment attachments are only reachable through short-lived
 * signed URLs minted for the owning student, and that other students /
 * anonymous visitors are denied.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const BUCKET = "assignment-files";

test.describe("signed attachment downloads", () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, "Supabase env not configured for e2e");

  test("owning student can open their submission attachment via a signed URL", async ({ page }) => {
    await signIn(page, env.studentEmail, env.studentPassword);
    await page.goto(`/${env.schoolCode}/student/assignments`);

    const attachment = page.getByRole("button", { name: /attachment|resource file/i }).first();
    test.skip((await attachment.count()) === 0, "No seeded assignment attachment");

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      attachment.click(),
    ]);
    const url = popup.url();
    expect(url).toContain("/storage/v1/object/sign/");
    expect(url).toContain("token=");

    const api = await request.newContext();
    const res = await api.get(url);
    expect(res.status()).toBe(200);
    await api.dispose();
  });

  test("unsigned direct object access is denied", async () => {
    const api = await request.newContext();
    const res = await api.get(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/some-school/submissions/some-assignment/some-user/file.pdf`,
      { headers: { apikey: ANON_KEY } },
    );
    expect([400, 401, 403, 404]).toContain(res.status());
    await api.dispose();
  });

  test("a signed URL cannot be minted for another student's submission", async ({ page }) => {
    await signIn(page, env.studentEmail, env.studentPassword);

    const result = await page.evaluate(async () => {
      const mod = await import("/src/integrations/supabase/client.ts");
      const { data, error } = await mod.supabase.storage
        .from("assignment-files")
        .createSignedUrl(
          "00000000-0000-0000-0000-000000000000/submissions/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/other.pdf",
          60,
        );
      return { signed: data?.signedUrl ?? null, error: error?.message ?? null };
    });

    expect(result.signed).toBeNull();
    expect(result.error).toBeTruthy();
  });

  test("tampered signed tokens are rejected", async () => {
    const api = await request.newContext();
    const res = await api.get(
      `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/any/path.pdf?token=tampered.token.value`,
    );
    expect(res.ok()).toBeFalsy();
    await api.dispose();
  });
});
