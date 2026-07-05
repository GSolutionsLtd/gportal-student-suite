import { Sparkles } from "lucide-react";
import { NewFeaturePage } from "@/components/NewFeaturePage";

export default function LessonPlanner() {
  return (
    <NewFeaturePage
      icon={Sparkles}
      title="AI Lesson Planner"
      tagline="Turn any curriculum into ready-to-teach lesson plans in seconds."
      description="Upload your scheme of work or a curriculum topic and generate structured, editable lesson plans and lesson notes aligned to Nigerian and international standards. Save hours of preparation each week."
      highlights={[
        "Auto-generate lesson plans from a topic or scheme of work",
        "Editable lesson notes, objectives, activities and evaluation",
        "Curriculum-aligned (NERDC, Cambridge, Common Core)",
        "Export as PDF or DOCX for classroom use",
        "Shareable across teachers in the same subject",
        "AI-suggested learning resources and questions",
      ]}
      ctaSource="feature_lesson_planner"
    />
  );
}
