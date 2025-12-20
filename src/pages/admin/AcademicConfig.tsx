import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionsTab } from "@/components/admin/academic/SessionsTab";
import { TermsTab } from "@/components/admin/academic/TermsTab";
import { ClassesTab } from "@/components/admin/academic/ClassesTab";
import { ClassArmsTab } from "@/components/admin/academic/ClassArmsTab";
import { SubjectsTab } from "@/components/admin/academic/SubjectsTab";
import { GradingScalesTab } from "@/components/admin/academic/GradingScalesTab";
import { ScoreWeightsTab } from "@/components/admin/academic/ScoreWeightsTab";
import { Calendar, BookOpen, Users, Layers, GraduationCap, Award, Percent } from "lucide-react";

const AcademicConfig = () => {
  const [activeTab, setActiveTab] = useState("sessions");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academic Configuration</h1>
        <p className="text-muted-foreground">
          Manage academic sessions, terms, classes, subjects, and grading scales
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto gap-2">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="terms" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Terms</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Classes</span>
          </TabsTrigger>
          <TabsTrigger value="arms" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Class Arms</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Subjects</span>
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Grading</span>
          </TabsTrigger>
          <TabsTrigger value="weights" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            <span className="hidden sm:inline">Weights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="terms">
          <TermsTab />
        </TabsContent>
        <TabsContent value="classes">
          <ClassesTab />
        </TabsContent>
        <TabsContent value="arms">
          <ClassArmsTab />
        </TabsContent>
        <TabsContent value="subjects">
          <SubjectsTab />
        </TabsContent>
        <TabsContent value="grading">
          <GradingScalesTab />
        </TabsContent>
        <TabsContent value="weights">
          <ScoreWeightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AcademicConfig;
