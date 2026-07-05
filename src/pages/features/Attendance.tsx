import { CalendarCheck } from "lucide-react";
import { NewFeaturePage } from "@/components/NewFeaturePage";

export default function Attendance() {
  return (
    <NewFeaturePage
      icon={CalendarCheck}
      title="Attendance Management"
      tagline="Daily digital attendance for students and staff with instant parent alerts."
      description="Move beyond paper registers. Track student and teacher attendance daily, flag absenteeism early, and keep parents informed automatically through SMS, WhatsApp and email."
      highlights={[
        "Daily student & staff attendance registers",
        "Instant parent notifications for absentees",
        "Class, subject and term-level attendance analytics",
        "Attendance-based intervention and risk flags",
        "Export attendance reports for compliance",
        "Works offline and syncs when back online",
      ]}
      ctaSource="feature_attendance"
    />
  );
}
