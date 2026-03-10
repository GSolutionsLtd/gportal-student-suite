import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SessionOption { id: string; name: string }
interface TermOption { id: string; name: string; session_id: string; session?: { name: string } }
interface ClassOption { id: string; name: string }
interface ClassArmOption { id: string; name: string; class_id: string; class?: { name: string } }
interface SubjectOption { id: string; name: string; code: string }

interface BroadsheetFiltersProps {
  sessions: SessionOption[];
  filteredTerms: TermOption[];
  classes: ClassOption[];
  filteredClassArms: ClassArmOption[];
  subjects: SubjectOption[];
  selectedSession: string;
  selectedTerm: string;
  selectedClass: string;
  selectedClassArm: string;
  selectedSubject: string;
  onSessionChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onClassArmChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
}

export function BroadsheetFilters({
  sessions, filteredTerms, classes, filteredClassArms, subjects,
  selectedSession, selectedTerm, selectedClass, selectedClassArm, selectedSubject,
  onSessionChange, onTermChange, onClassChange, onClassArmChange, onSubjectChange,
}: BroadsheetFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Select value={selectedSession} onValueChange={onSessionChange}>
            <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedTerm} onValueChange={onTermChange}>
            <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              {filteredTerms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedClass} onValueChange={onClassChange}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedClassArm} onValueChange={onClassArmChange}>
            <SelectTrigger><SelectValue placeholder="Class Arm" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Class Arms</SelectItem>
              {filteredClassArms.map((a) => <SelectItem key={a.id} value={a.id}>{a.class?.name} - {a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedSubject} onValueChange={onSubjectChange}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
