import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, MessageSquare, Send, Mail, MailOpen } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Message {
  id: string;
  parent_user_id: string;
  student_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  parent_name?: string;
  student_name?: string;
}

export default function ParentMessages() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  const fetchMessages = async () => {
    try {
      // Get teacher record
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!teacher) {
        setLoading(false);
        return;
      }

      const { data: msgs } = await supabase
        .from("parent_teacher_messages")
        .select("*")
        .eq("teacher_id", teacher.id)
        .order("created_at", { ascending: false });

      if (!msgs || msgs.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // Get parent names and student names
      const parentIds = [...new Set(msgs.map((m) => m.parent_user_id))];
      const studentIds = [...new Set(msgs.map((m) => m.student_id))];

      const [{ data: parentProfiles }, { data: students }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", parentIds),
        supabase.from("students").select("id, first_name, last_name").in("id", studentIds),
      ]);

      const enriched: Message[] = msgs.map((m) => ({
        ...m,
        parent_name: parentProfiles?.find((p) => p.id === m.parent_user_id)?.full_name || "Unknown",
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

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("parent_teacher_messages")
        .update({
          reply: replyText.trim(),
          replied_at: new Date().toISOString(),
          is_read: true,
        })
        .eq("id", selectedMessage.id);

      if (error) throw error;

      toast({ title: "Reply sent", description: "Your reply has been sent to the parent." });
      setSelectedMessage(null);
      setReplyText("");
      fetchMessages();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (msg: Message) => {
    if (msg.is_read) return;
    await supabase.from("parent_teacher_messages").update({ is_read: true }).eq("id", msg.id);
    fetchMessages();
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parent Messages</h1>
        <p className="text-muted-foreground">
          Read and reply to messages from parents
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">{unreadCount} unread</Badge>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No messages from parents yet.</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id} className={!msg.is_read ? "bg-primary/5" : ""}>
                      <TableCell>
                        {msg.is_read ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Mail className="h-4 w-4 text-primary" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{msg.parent_name}</TableCell>
                      <TableCell>{msg.student_name}</TableCell>
                      <TableCell>{msg.subject}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {msg.reply ? (
                          <Badge variant="default">Replied</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMessage(msg);
                            setReplyText(msg.reply || "");
                            markAsRead(msg);
                          }}
                        >
                          {msg.reply ? "View" : "Reply"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Detail / Reply Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedMessage?.parent_name} about {selectedMessage?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Parent's Message:</p>
              <p className="text-sm">{selectedMessage?.message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedMessage && new Date(selectedMessage.created_at).toLocaleString()}
              </p>
            </div>

            {selectedMessage?.reply && (
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <p className="text-sm font-medium text-muted-foreground mb-1">Your Reply:</p>
                <p className="text-sm">{selectedMessage.reply}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedMessage.replied_at && new Date(selectedMessage.replied_at).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">{selectedMessage?.reply ? "Update Reply:" : "Write Reply:"}</p>
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>Close</Button>
            <Button onClick={handleReply} disabled={sending || !replyText.trim()}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              {selectedMessage?.reply ? "Update Reply" : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
