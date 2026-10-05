import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Users, Wallet, UserCheck } from "lucide-react";
import SchoolWebsiteManager from "./SchoolWebsiteManager";
import FeeManagement from "./FeeManagement";
import { TeachersTab } from "@/components/admin/teachers/TeachersTab";
import { TeacherApprovalsTab } from "@/components/admin/teachers/TeacherApprovalsTab";
import { useSchoolContext } from "@/hooks/useSchoolContext";

export default function SchoolAdminPortal() {
  const { schoolName } = useSchoolContext();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "approvals";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">School Admin Portal</h1>
        <p className="text-muted-foreground">
          Manage {schoolName || "your school"}'s website, staff, fees and teacher approvals in one place.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="approvals"><UserCheck className="mr-2 h-4 w-4" />Teacher approvals</TabsTrigger>
          <TabsTrigger value="staff"><Users className="mr-2 h-4 w-4" />Staff</TabsTrigger>
          <TabsTrigger value="fees"><Wallet className="mr-2 h-4 w-4" />Fees</TabsTrigger>
          <TabsTrigger value="website"><Globe className="mr-2 h-4 w-4" />Website pages</TabsTrigger>
        </TabsList>
        <TabsContent value="approvals"><TeacherApprovalsTab /></TabsContent>
        <TabsContent value="staff"><TeachersTab /></TabsContent>
        <TabsContent value="fees"><FeeManagement /></TabsContent>
        <TabsContent value="website"><SchoolWebsiteManager /></TabsContent>
      </Tabs>
    </div>
  );
}
