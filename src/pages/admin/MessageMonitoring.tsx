import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Search, Mail, MailOpen, Eye, Users } from "lucide-react";
import { format } from "date-fns";

interface MessageRecord {
  id: string;
  parent_user_id: string;
  teacher_id: string;
  student_id: string;
  subject: string;
  message: string;
  reply: string | null;
  replied_at: string | null;
  is_read: boolean;
  created_at: string;
  parent_name: string;
  teacher_name: string;
  student_name: string;
}

export default function MessageMonitoring() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<MessageRecord | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data: msgs, error } = await supabase
        .from("parent_teacher_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!msgs || msgs.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const parentIds = [...new Set(msgs.map((m) => m.parent_user_id))];
      const teacherIds = [...new Set(msgs.map((m) => m.teacher_id))];
      const studentIds = [...new Set(msgs.map((m) => m.student_id))];

      const [{ data: parentProfiles }, { data: teachers }, { data: students }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", parentIds),
        supabase.from("teachers").select("id, user_id").in("id", teacherIds),
        supabase.from("students").select("id, first_name, last_name").in("id", studentIds),
      ]);

      const teacherUserIds = (teachers || []).map((t) => t.user_id);
      const { data: teacherProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherUserIds);

      const teacherNameMap = new Map(
        (teachers || []).map((t) => [
          t.id,
          teacherProfiles?.find((p) => p.id === t.user_id)?.full_name || "Unknown",
        ])
      );

      const enriched: MessageRecord[] = msgs.map((m) => ({
        ...m,
        parent_name: parentProfiles?.find((p) => p.id === m.parent_user_id)?.full_name || "Unknown",
        teacher_name: teacherNameMap.get(m.teacher_id) || "Admin",
        student_name: (() => {
          const s = students?.find((s) => s.id === m.student_id);
          return s ? `${s.first_name} ${s.last_name}` : "Unknown";
        })(),
      }));

      setMessages(enriched);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = messages.filter((m) => {
    const matchesSearch =
      searchQuery === "" ||
      m.parent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.student_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "replied" && m.reply) ||
      (statusFilter === "pending" && !m.reply) ||
      (statusFilter === "unread" && !m.is_read);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: messages.length,
    replied: messages.filter((m) => m.reply).length,
    pending: messages.filter((m) => !m.reply).length,
    unread: messages.filter((m) => !m.is_read).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Message Monitoring</h1>
        <p className="text-muted-foreground">Track all parent-teacher message interactions</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Replied</CardTitle>
            <MailOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats.replied}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Mail className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
            <Mail className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.unread}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((msg) => (
                <TableRow key={msg.id} className={!msg.is_read ? "bg-primary/5" : ""}>
                  <TableCell>
                    {msg.is_read ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-primary" />}
                  </TableCell>
                  <TableCell className="font-medium">{msg.parent_name}</TableCell>
                  <TableCell>{msg.teacher_name}</TableCell>
                  <TableCell>{msg.student_name}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{msg.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(msg.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    {msg.reply ? <Badge variant="default">Replied</Badge> : <Badge variant="secondary">Pending</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedMessage(msg)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No messages found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedMessage?.subject}</DialogTitle></DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium">Parent:</span> {selectedMessage.parent_name}</div>
                <div><span className="font-medium">Teacher:</span> {selectedMessage.teacher_name}</div>
                <div><span className="font-medium">Student:</span> {selectedMessage.student_name}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Sent: {format(new Date(selectedMessage.created_at), "dd MMM yyyy HH:mm")}
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Parent's Message:</p>
                <p className="text-sm">{selectedMessage.message}</p>
              </div>
              {selectedMessage.reply ? (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary mb-1">
                    Teacher's Reply ({format(new Date(selectedMessage.replied_at!), "dd MMM yyyy HH:mm")}):
                  </p>
                  <p className="text-sm">{selectedMessage.reply}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No reply yet</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
