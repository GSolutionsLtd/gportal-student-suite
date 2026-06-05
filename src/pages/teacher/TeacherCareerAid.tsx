import AdminCareerAid from "@/pages/admin/AdminCareerAid";

// Teachers share the same authoring experience as admins (RLS allows both to post).
export default function TeacherCareerAid() {
  return <AdminCareerAid />;
}
