import { useEffect, useMemo, useState } from "react";
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
  const [teacherIdsByStudent, setTeacherIdsByStudent] = useState<Record<string, string[]>>({});
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (user) {
      void fetchAll();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedStudent) {
      setSelectedTeacher("");
      return;
    }

    const allowedTeacherIds = teacherIdsByStudent[selectedStudent] || [];
    if (allowedTeacherIds.length > 0 && !allowedTeacherIds.includes(selectedTeacher)) {
      setSelectedTeacher("");
    }
  }, [selectedStudent, selectedTeacher, teacherIdsByStudent]);

  const filteredTeachers = useMemo(() => {
    if (!selectedStudent) return teachers;
    const allowedTeacherIds = teacherIdsByStudent[selectedStudent] || [];
    if (allowedTeacherIds.length === 0) return teachers;
    return teachers.filter((teacher) => allowedTeacherIds.includes(teacher.id));
  }, [selectedStudent, teacherIdsByStudent, teachers]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parent-messaging-context");

      if (error) throw error;

      setMessages(data?.messages || []);
      setLinkedStudents(data?.linkedStudents || []);
      setTeachers(data?.teachers || []);
      setTeacherIdsByStudent(data?.teacherIdsByStudent || {});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
      await fetchAll();
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
                  {filteredTeachers.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">No teachers found. Please contact admin.</div>
                  ) : (
                    filteredTeachers.map((t) => (
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
            <Button onClick={handleSend} disabled={sending || filteredTeachers.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
