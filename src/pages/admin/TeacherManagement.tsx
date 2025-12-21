import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeachersTab } from "@/components/admin/teachers/TeachersTab";
import { TeacherAssignmentsTab } from "@/components/admin/teachers/TeacherAssignmentsTab";

const TeacherManagement = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teacher Management</h1>
        <p className="text-muted-foreground">
          Manage teachers and their subject/class assignments
        </p>
      </div>

      <Tabs defaultValue="teachers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="assignments">Subject Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers">
          <TeachersTab />
        </TabsContent>

        <TabsContent value="assignments">
          <TeacherAssignmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeacherManagement;
