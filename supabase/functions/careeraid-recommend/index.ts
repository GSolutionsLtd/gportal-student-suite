// Generate Nigerian-context career recommendations from a Personality Test assessment.
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

const SYSTEM = `You are a Nigerian career counselor. Given a senior secondary student's Personality Test profile, produce 5 ranked career paths tailored to Nigeria.
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
      .select("id, school_id, student_id, realistic, investigative, artistic, social, enterprising, conventional, dominant_type, holland_code")
      .eq("id", assessment_id)
      .single();
    if (aerr || !assess) return json({ error: "Assessment not found" }, 404);

    // Do not rely on an implicit PostgREST relationship here: some deployments
    // do not have a FK from career_assessments.student_id to students.id, which
    // was causing false 404s after the assessment was saved.
    const { data: student, error: serr } = await admin
      .from("students")
      .select("id, user_id, school_id, first_name, last_name")
      .eq("id", assess.student_id)
      .single();
    if (serr || !student) return json({ error: "Student profile not found" }, 404);
    if (student.user_id !== user.id || student.school_id !== assess.school_id) return json({ error: "Forbidden" }, 403);

    const prompt = `Student Personality Test profile:
- Realistic: ${assess.realistic}
- Investigative: ${assess.investigative}
- Artistic: ${assess.artistic}
- Social: ${assess.social}
- Enterprising: ${assess.enterprising}
- Conventional: ${assess.conventional}
Dominant type: ${assess.dominant_type ?? "n/a"} (Profile code: ${assess.holland_code ?? "n/a"})

Generate 5 ranked Nigerian career paths.`;

    const parsed = await buildRecommendations(prompt, assess);

    const { data: rec, error: rerr } = await admin.from("career_recommendations").insert({
      school_id: student.school_id,
      student_id: student.id,
      assessment_id,
      summary: parsed.summary,
      model: parsed.source === "fallback" ? "rule-based-fallback" : MODEL,
    }).select("id").single();
    if (rerr) return json({ error: rerr.message }, 500);

    const paths = parsed.paths.map((p: any) => ({
      recommendation_id: rec.id,
      school_id: student.school_id,
      student_id: student.id,
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

    return json({ recommendation_id: rec.id, summary: parsed.summary, paths: parsed.paths, source: parsed.source });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildRecommendations(prompt: string, assess: any) {
  try {
    if (!LOVABLE_API_KEY) throw new Error("AI key unavailable");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "career_recs", schema: SCHEMA, strict: true } },
      }),
    });
    if (!aiResp.ok) throw new Error(await aiResp.text());
    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed?.summary || !Array.isArray(parsed.paths) || parsed.paths.length < 5) {
      throw new Error("Invalid recommendation payload");
    }
    return normalizeRecommendation(parsed, "ai");
  } catch (err) {
    console.warn("CareerAid AI fallback used:", (err as Error).message);
    return normalizeRecommendation(fallbackRecommendations(assess), "fallback");
  }
}

function normalizeRecommendation(parsed: any, source: "ai" | "fallback") {
  return {
    summary: String(parsed.summary || "Your Personality Test has been analyzed and matched with suitable Nigerian career pathways."),
    source,
    paths: parsed.paths.slice(0, 5).map((p: any, index: number) => ({
      rank: Number(p.rank || index + 1),
      career_title: String(p.career_title || "Career Path"),
      ss_subjects: arr(p.ss_subjects),
      university_courses: arr(p.university_courses),
      jamb_subjects: arr(p.jamb_subjects),
      jamb_cutoff: String(p.jamb_cutoff || "180-250 depending on institution"),
      universities: arr(p.universities),
      polytechnics: arr(p.polytechnics),
      colleges_of_education: arr(p.colleges_of_education),
      tech_skills: arr(p.tech_skills),
      soft_skills: arr(p.soft_skills),
      salary_insight: String(p.salary_insight || "Entry pay varies by location, certification, and experience."),
      market_relevance: String(p.market_relevance || "Relevant across Nigerian public, private, and entrepreneurial sectors."),
    })),
  };
}

function arr(value: unknown) {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function fallbackRecommendations(assess: any) {
  const templates: Record<string, any[]> = {
    R: [
      path(1, "Mechanical Engineer", ["Physics", "Chemistry", "Mathematics", "Technical Drawing"], ["Mechanical Engineering", "Mechatronics Engineering"], ["English", "Mathematics", "Physics", "Chemistry"]),
      path(2, "Civil Engineer", ["Physics", "Chemistry", "Mathematics", "Geography"], ["Civil Engineering", "Building Technology"], ["English", "Mathematics", "Physics", "Chemistry"]),
      path(3, "Agricultural Technologist", ["Agricultural Science", "Biology", "Chemistry", "Mathematics"], ["Agricultural Engineering", "Agronomy"], ["English", "Chemistry", "Biology/Agric", "Mathematics"]),
      path(4, "Electrical Technician", ["Physics", "Mathematics", "Basic Electricity", "Technical Drawing"], ["Electrical/Electronics Engineering", "Computer Engineering"], ["English", "Mathematics", "Physics", "Chemistry"]),
      path(5, "Quantity Surveyor", ["Mathematics", "Physics", "Economics", "Technical Drawing"], ["Quantity Surveying", "Estate Management"], ["English", "Mathematics", "Physics", "Economics"]),
    ],
    I: [
      path(1, "Medical Doctor", ["Biology", "Chemistry", "Physics", "Mathematics"], ["Medicine and Surgery", "Medical Laboratory Science"], ["English", "Biology", "Chemistry", "Physics"]),
      path(2, "Data Analyst", ["Mathematics", "Further Mathematics", "Economics", "Computer Studies"], ["Statistics", "Computer Science", "Data Science"], ["English", "Mathematics", "Physics", "Economics"]),
      path(3, "Pharmacist", ["Biology", "Chemistry", "Physics", "Mathematics"], ["Pharmacy", "Pharmacology"], ["English", "Biology", "Chemistry", "Physics"]),
      path(4, "Research Scientist", ["Biology", "Chemistry", "Physics", "Mathematics"], ["Biochemistry", "Microbiology", "Industrial Chemistry"], ["English", "Biology", "Chemistry", "Physics"]),
      path(5, "Cybersecurity Analyst", ["Computer Studies", "Mathematics", "Physics", "Further Mathematics"], ["Cybersecurity", "Computer Science", "Information Technology"], ["English", "Mathematics", "Physics", "Computer Studies"]),
    ],
    A: [
      path(1, "Creative Director", ["Literature", "Fine Arts", "Government", "CRS/IRS"], ["Theatre Arts", "Creative Arts", "Mass Communication"], ["English", "Literature", "Government", "CRS/IRS"]),
      path(2, "UX/UI Designer", ["Computer Studies", "Fine Arts", "Mathematics", "Economics"], ["Computer Science", "Industrial Design", "Fine Arts"], ["English", "Mathematics", "Fine Arts", "Computer Studies"]),
      path(3, "Content Strategist", ["Literature", "Government", "Economics", "CRS/IRS"], ["Mass Communication", "English", "Linguistics"], ["English", "Literature", "Government", "Economics"]),
      path(4, "Architect", ["Technical Drawing", "Physics", "Mathematics", "Fine Arts"], ["Architecture", "Urban and Regional Planning"], ["English", "Mathematics", "Physics", "Fine Arts"]),
      path(5, "Media Producer", ["Literature", "Fine Arts", "Government", "Computer Studies"], ["Film Studies", "Mass Communication", "Performing Arts"], ["English", "Literature", "Government", "Fine Arts"]),
    ],
    S: [
      path(1, "Teacher/Education Specialist", ["English", "Mathematics", "Government", "CRS/IRS"], ["Education", "Guidance and Counselling"], ["English", "Subject of specialization", "Government", "CRS/IRS"]),
      path(2, "Counselor", ["Biology", "Government", "English", "CRS/IRS"], ["Guidance and Counselling", "Psychology"], ["English", "Biology", "Government", "CRS/IRS"]),
      path(3, "Nurse", ["Biology", "Chemistry", "Physics", "Mathematics"], ["Nursing Science", "Public Health"], ["English", "Biology", "Chemistry", "Physics"]),
      path(4, "Social Worker", ["Government", "Economics", "English", "CRS/IRS"], ["Social Work", "Sociology"], ["English", "Government", "Economics", "CRS/IRS"]),
      path(5, "Public Health Officer", ["Biology", "Chemistry", "Physics", "Mathematics"], ["Public Health", "Health Education"], ["English", "Biology", "Chemistry", "Physics"]),
    ],
    E: [
      path(1, "Entrepreneur/Business Founder", ["Economics", "Commerce", "Mathematics", "Accounting"], ["Business Administration", "Entrepreneurship"], ["English", "Mathematics", "Economics", "Commerce"]),
      path(2, "Marketing Manager", ["Economics", "Commerce", "Government", "Mathematics"], ["Marketing", "Business Administration"], ["English", "Mathematics", "Economics", "Government"]),
      path(3, "Lawyer", ["Literature", "Government", "CRS/IRS", "English"], ["Law", "International Relations"], ["English", "Literature", "Government", "CRS/IRS"]),
      path(4, "Product Manager", ["Economics", "Mathematics", "Computer Studies", "Commerce"], ["Business Administration", "Computer Science", "Economics"], ["English", "Mathematics", "Economics", "Computer Studies"]),
      path(5, "Banking/Finance Professional", ["Accounting", "Economics", "Mathematics", "Commerce"], ["Accounting", "Finance", "Economics"], ["English", "Mathematics", "Economics", "Accounting"]),
    ],
    C: [
      path(1, "Accountant", ["Accounting", "Economics", "Mathematics", "Commerce"], ["Accounting", "Finance"], ["English", "Mathematics", "Economics", "Accounting"]),
      path(2, "Database Administrator", ["Computer Studies", "Mathematics", "Physics", "Economics"], ["Computer Science", "Information Systems"], ["English", "Mathematics", "Physics", "Computer Studies"]),
      path(3, "Auditor", ["Accounting", "Economics", "Mathematics", "Commerce"], ["Accounting", "Taxation"], ["English", "Mathematics", "Economics", "Accounting"]),
      path(4, "Operations Analyst", ["Mathematics", "Economics", "Commerce", "Computer Studies"], ["Business Administration", "Statistics", "Economics"], ["English", "Mathematics", "Economics", "Commerce"]),
      path(5, "Records/Information Manager", ["Government", "Economics", "Computer Studies", "English"], ["Library and Information Science", "Information Management"], ["English", "Government", "Economics", "Computer Studies"]),
    ],
  };
  const code = String(assess.holland_code || "S").charAt(0).toUpperCase();
  const paths = templates[code] || templates.S;
  return {
    summary: `Your Personality Test profile shows a strongest match with ${assess.dominant_type || "people-focused and practical"} interests. These recommendations are tailored to Nigerian senior-secondary subject choices, JAMB planning, and local training routes.`,
    paths,
  };
}

function path(rank: number, career_title: string, ss_subjects: string[], university_courses: string[], jamb_subjects: string[]) {
  return {
    rank,
    career_title,
    ss_subjects,
    university_courses,
    jamb_subjects,
    jamb_cutoff: "180-260 depending on institution and competition",
    universities: ["UNILAG", "University of Ibadan", "OAU", "UNN", "ABU", "Covenant University"],
    polytechnics: ["Yaba College of Technology", "Kaduna Polytechnic", "Federal Polytechnic Ilaro"],
    colleges_of_education: ["FCE Akoka", "AOCOED", "Federal College of Education, Zaria"],
    tech_skills: ["Digital literacy", "Data handling", "Presentation tools", "Online research"],
    soft_skills: ["Communication", "Problem solving", "Teamwork", "Time management"],
    salary_insight: "Early-career earnings vary widely by location, employer, certification, and portfolio strength.",
    market_relevance: "Relevant in Nigeria with opportunities across private practice, public institutions, startups, NGOs, and remote work pathways.",
  };
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
