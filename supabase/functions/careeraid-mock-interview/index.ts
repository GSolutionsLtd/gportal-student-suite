// Generate mock interview questions and score answers for a given career path.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "start") {
      const { career_path } = body;
      if (!career_path) return json({ error: "career_path required" }, 400);
      const { data: student } = await admin.from("students").select("id, school_id").eq("user_id", user.id).single();
      if (!student) return json({ error: "Student profile not found" }, 404);

      const aiResp = await callAI([
        { role: "system", content: "You are a Nigerian career interviewer. Return only JSON." },
        { role: "user", content: `Generate 5 mock interview questions for someone aspiring to be a ${career_path} in Nigeria. JSON: {"questions":[{"q":"..."}]}` },
      ], { type: "json_object" });
      if (aiResp.error) return json(aiResp, aiResp.status);
      const parsed = JSON.parse(aiResp.content);

      const { data: row, error } = await admin.from("career_mock_interviews").insert({
        school_id: student.school_id,
        student_id: student.id,
        career_path,
        questions: parsed.questions,
      }).select("id, questions").single();
      if (error) return json({ error: error.message }, 500);
      return json(row);
    }

    if (action === "submit") {
      const { interview_id, answers } = body;
      const { data: row } = await admin.from("career_mock_interviews")
        .select("*, student:students!inner(user_id)").eq("id", interview_id).single();
      if (!row || row.student.user_id !== user.id) return json({ error: "Forbidden" }, 403);

      const qa = (row.questions as any[]).map((q, i) => `Q${i + 1}: ${q.q}\nA: ${answers[i] || "(no answer)"}`).join("\n\n");
      const aiResp = await callAI([
        { role: "system", content: "You are a strict but encouraging Nigerian career interviewer. Return only JSON." },
        { role: "user", content: `Career: ${row.career_path}\n\n${qa}\n\nScore 0-100 and give constructive feedback. JSON: {"score": number, "feedback": "..."}` },
      ], { type: "json_object" });
      if (aiResp.error) return json(aiResp, aiResp.status);
      const parsed = JSON.parse(aiResp.content);

      await admin.from("career_mock_interviews").update({
        answers, score: parsed.score, feedback: parsed.feedback,
        status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", interview_id);
      return json({ score: parsed.score, feedback: parsed.feedback });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function callAI(messages: any[], response_format: any) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, response_format }),
  });
  if (!r.ok) {
    if (r.status === 429) return { error: "AI rate limit", status: 429 } as any;
    if (r.status === 402) return { error: "AI credits exhausted", status: 402 } as any;
    return { error: "AI error", detail: await r.text(), status: 502 } as any;
  }
  const j = await r.json();
  return { content: j.choices?.[0]?.message?.content };
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
