// Generate Nigerian-context AI career recommendations from a Holland Code assessment.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `You are a Nigerian career counselor. Given a senior secondary student's Holland Code profile, produce 5 ranked career paths tailored to Nigeria.
Use real Nigerian universities (UNILAG, UI, OAU, UNN, ABU, FUTA, Covenant, Babcock, etc.), polytechnics (Yabatech, Kaduna Poly, etc.), colleges of education (FCE Akoka, AOCOED, etc.), and accurate JAMB subject combinations and indicative cut-off ranges.
Return ONLY JSON matching the schema. No prose.`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    paths: {
      type: "array", minItems: 5, maxItems: 5,
      items: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          career_title: { type: "string" },
          ss_subjects: { type: "array", items: { type: "string" } },
          university_courses: { type: "array", items: { type: "string" } },
          jamb_subjects: { type: "array", items: { type: "string" } },
          jamb_cutoff: { type: "string" },
          universities: { type: "array", items: { type: "string" } },
          polytechnics: { type: "array", items: { type: "string" } },
          colleges_of_education: { type: "array", items: { type: "string" } },
          tech_skills: { type: "array", items: { type: "string" } },
          soft_skills: { type: "array", items: { type: "string" } },
          salary_insight: { type: "string" },
          market_relevance: { type: "string" },
        },
        required: ["rank","career_title","ss_subjects","university_courses","jamb_subjects","jamb_cutoff","universities","polytechnics","colleges_of_education","tech_skills","soft_skills","salary_insight","market_relevance"],
      },
    },
  },
  required: ["summary","paths"],
};

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

    const { assessment_id } = await req.json();
    if (!assessment_id) return json({ error: "assessment_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: assess, error: aerr } = await admin
      .from("career_assessments")
      .select("*, student:students!inner(id, user_id, school_id, first_name, last_name)")
      .eq("id", assessment_id)
      .single();
    if (aerr || !assess) return json({ error: "Assessment not found" }, 404);
    if (assess.student.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    const prompt = `Student Holland Code profile:
- Realistic: ${assess.realistic}
- Investigative: ${assess.investigative}
- Artistic: ${assess.artistic}
- Social: ${assess.social}
- Enterprising: ${assess.enterprising}
- Conventional: ${assess.conventional}
Dominant type: ${assess.dominant_type ?? "n/a"} (Holland Code: ${assess.holland_code ?? "n/a"})

Generate 5 ranked Nigerian career paths.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "career_recs", schema: SCHEMA, strict: true } },
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) return json({ error: "AI rate limit reached. Try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
      return json({ error: "AI error", detail: t }, 502);
    }
    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    const { data: rec, error: rerr } = await admin.from("career_recommendations").insert({
      school_id: assess.student.school_id,
      student_id: assess.student.id,
      assessment_id,
      summary: parsed.summary,
      model: MODEL,
    }).select("id").single();
    if (rerr) return json({ error: rerr.message }, 500);

    const paths = parsed.paths.map((p: any) => ({
      recommendation_id: rec.id,
      school_id: assess.student.school_id,
      student_id: assess.student.id,
      rank: p.rank,
      career_title: p.career_title,
      ss_subjects: p.ss_subjects,
      university_courses: p.university_courses,
      jamb_subjects: p.jamb_subjects,
      jamb_cutoff: p.jamb_cutoff,
      universities: p.universities,
      polytechnics: p.polytechnics,
      colleges_of_education: p.colleges_of_education,
      tech_skills: p.tech_skills,
      soft_skills: p.soft_skills,
      salary_insight: p.salary_insight,
      market_relevance: p.market_relevance,
    }));
    const { error: perr } = await admin.from("career_recommendation_paths").insert(paths);
    if (perr) return json({ error: perr.message }, 500);

    return json({ recommendation_id: rec.id, summary: parsed.summary, paths: parsed.paths });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
