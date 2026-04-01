import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, Send, Plus, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Message {
  id: string;
  subject: string;
  message: string;
  reply: string | null;
  replied_at: string | null;
  is_read: boolean;
  created_at: string;
  teacher_name: string;
  student_name: string;
}

interface TeacherOption {
  id: string;
  name: string;
}

export default function MessageTeacher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchMessages(), fetchLinkedStudents()]);
    setIsLoading(false);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("parent_teacher_messages")
      .select("id, subject, message, reply, replied_at, is_read, created_at, teacher_id, student_id")
      .eq("parent_user_id", user!.id)
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setMessages([]);
      return;
    }

    const teacherIds = [...new Set(data.map((m) => m.teacher_id))];
    const studentIds = [...new Set(data.map((m) => m.student_id))];

    const [teachersRes, studentsRes] = await Promise.all([
      supabase.from("teachers").select("id, user_id").in("id", teacherIds),
      supabase.from("students").select("id, first_name, last_name").in("id", studentIds),
    ]);

    const teacherUserIds = (teachersRes.data || []).map((t) => t.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
    const teacherMap = new Map((teachersRes.data || []).map((t) => [t.id, profileMap.get(t.user_id) || "Unknown Teacher"]));
    const studentMap = new Map((studentsRes.data || []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));

    setMessages(data.map((m) => ({
      ...m,
      teacher_name: teacherMap.get(m.teacher_id) || "Unknown",
      student_name: studentMap.get(m.student_id) || "Unknown",
    })));
  };

  const fetchLinkedStudents = async () => {
    const { data: links } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_user_id", user!.id)
      .eq("is_active", true);

    if (!links || links.length === 0) return;

    const studentIds = links.map((l) => l.student_id);
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, current_class_arm_id")
      .in("id", studentIds);

    setLinkedStudents(students || []);

    // Gather all teachers: from teacher_subjects AND form teachers from class_arms
    const classArmIds = [...new Set((students || []).map((s) => s.current_class_arm_id).filter(Boolean))];
    if (classArmIds.length === 0) return;

    // Fetch subject-assigned teachers AND form teachers in parallel
    const [assignmentsRes, classArmsRes] = await Promise.all([
      supabase.from("teacher_subjects").select("teacher_id").in("class_arm_id", classArmIds),
      supabase.from("class_arms").select("form_teacher_id").in("id", classArmIds).not("form_teacher_id", "is", null),
    ]);

    const teacherIdSet = new Set<string>();
    (assignmentsRes.data || []).forEach((a) => teacherIdSet.add(a.teacher_id));
    (classArmsRes.data || []).forEach((ca) => {
      if (ca.form_teacher_id) teacherIdSet.add(ca.form_teacher_id);
    });

    const allTeacherIds = [...teacherIdSet];
    if (allTeacherIds.length === 0) {
      // Fallback: load ALL active teachers so parents can still message
      const { data: allTeachers } = await supabase
        .from("teachers")
        .select("id, user_id")
        .eq("is_active", true);

      if (allTeachers && allTeachers.length > 0) {
        const userIds = allTeachers.map((t) => t.user_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const profMap = new Map((profs || []).map((p) => [p.id, p.full_name]));
        setTeachers(allTeachers.map((t) => ({ id: t.id, name: profMap.get(t.user_id) || "Unknown Teacher" })));
      }
      return;
    }

    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id, user_id")
      .in("id", allTeacherIds)
      .eq("is_active", true);

    if (!teacherData || teacherData.length === 0) return;

    const userIds = teacherData.map((t) => t.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const profMap = new Map((profs || []).map((p) => [p.id, p.full_name]));

    setTeachers(teacherData.map((t) => ({
      id: t.id,
      name: profMap.get(t.user_id) || "Unknown Teacher",
    })));
  };

  const handleSend = async () => {
    if (!selectedStudent || !selectedTeacher || !subject || !messageText) {
      toast({ title: "Missing fields", description: "Please fill all fields.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("parent_teacher_messages").insert({
        parent_user_id: user!.id,
        teacher_id: selectedTeacher,
        student_id: selectedStudent,
        subject,
        message: messageText,
      });
      if (error) throw error;

      toast({ title: "Message sent", description: "Your message has been sent to the teacher." });
      setComposeOpen(false);
      setSubject("");
      setMessageText("");
      setSelectedStudent("");
      setSelectedTeacher("");
      fetchMessages();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground">Communicate directly with your child's teachers</p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Message
        </Button>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Messages Yet</h3>
            <p className="text-muted-foreground mt-2">Start a conversation with your child's teacher.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedMessage(msg)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{msg.subject}</p>
                      {msg.reply ? (
                        <Badge variant="default" className="text-xs shrink-0"><CheckCircle className="h-3 w-3 mr-1" />Replied</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">To: {msg.teacher_name} • Re: {msg.student_name}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{msg.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{format(new Date(msg.created_at), "dd MMM yyyy")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedMessage?.subject}</DialogTitle></DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                To: {selectedMessage.teacher_name} • Student: {selectedMessage.student_name} • {format(new Date(selectedMessage.created_at), "dd MMM yyyy HH:mm")}
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Your message:</p>
                <p className="text-sm">{selectedMessage.message}</p>
              </div>
              {selectedMessage.reply ? (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary mb-1">
                    Teacher's reply ({format(new Date(selectedMessage.replied_at!), "dd MMM yyyy HH:mm")}):
                  </p>
                  <p className="text-sm">{selectedMessage.reply}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Awaiting teacher's reply...</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Message to Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {linkedStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">No teachers found. Please contact admin.</div>
                  ) : (
                    teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type your message..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || teachers.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
