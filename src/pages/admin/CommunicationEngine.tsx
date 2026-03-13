import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail, MessageSquare, Bell, Send, Loader2, Users, GraduationCap,
  CheckCircle, XCircle, Clock, FileText, Phone, RefreshCw, Search,
  AlertTriangle, TrendingUp, TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/admin/broadsheet/TablePagination";

type NotificationType = "result_published" | "result_approved" | "payment_confirmed" | "performance_alert" | "custom";

interface NotificationLog {
  id: string;
  type: NotificationType;
  channel: "email" | "sms" | "in_app";
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  created_at: string;
  student_name?: string;
}

interface StudentWithGuardian {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian_name: string | null;
  current_class_arm_id: string | null;
}

export default function CommunicationEngine() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Dashboard stats
  const [stats, setStats] = useState({
    totalNotifications: 0,
    emailsSent: 0,
    smsSent: 0,
    inAppSent: 0,
    pendingResults: 0,
    publishedToday: 0,
  });

  // Notification logs
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk notification state
  const [bulkType, setBulkType] = useState<NotificationType>("result_published");
  const [bulkChannel, setBulkChannel] = useState<"email" | "sms" | "both">("email");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all_parents" | "class" | "individual">("all_parents");
  const [selectedClassArm, setSelectedClassArm] = useState("all");
  const [classArms, setClassArms] = useState<{ id: string; name: string; class: { name: string } }[]>([]);
  const [students, setStudents] = useState<StudentWithGuardian[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Published results for notification
  const [publishedResults, setPublishedResults] = useState<any[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());

  // Compose dialog
  const [composeOpen, setComposeOpen] = useState(false);

  // Performance alerts
  const [performanceThreshold, setPerformanceThreshold] = useState(45);
  const [performanceAlertStudents, setPerformanceAlertStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchLogs(), fetchClassArms(), fetchStudents(), fetchPublishedResults()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const [notifRes, publishedRes, pendingRes] = await Promise.all([
      supabase.from("notifications").select("id, type", { count: "exact" }),
      supabase.from("results").select("id", { count: "exact" }).eq("status", "published")
        .gte("published_at", new Date().toISOString().split("T")[0]),
      supabase.from("results").select("id", { count: "exact" }).eq("status", "approved"),
    ]);

    setStats({
      totalNotifications: notifRes.count || 0,
      emailsSent: 0,
      smsSent: 0,
      inAppSent: notifRes.count || 0,
      pendingResults: pendingRes.count || 0,
      publishedToday: publishedRes.count || 0,
    });
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);

    const mapped: NotificationLog[] = (data || []).map((n) => ({
      id: n.id,
      type: (n.type as NotificationType) || "custom",
      channel: "in_app" as const,
      recipient: n.user_id || "Unknown",
      subject: n.title,
      status: "sent" as const,
      created_at: n.created_at,
    }));
    setLogs(mapped);
  };

  const fetchClassArms = async () => {
    const { data } = await supabase
      .from("class_arms").select("id, name, class:classes(name)").eq("is_active", true).order("name");
    setClassArms((data as any[]) || []);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, admission_number, guardian_email, guardian_phone, guardian_name, current_class_arm_id")
      .eq("is_active", true)
      .order("last_name");
    setStudents((data as StudentWithGuardian[]) || []);
  };

  const fetchPublishedResults = async () => {
    const { data } = await supabase
      .from("results")
      .select(`id, average_score, class_position, published_at,
        student:students(first_name, last_name, admission_number, guardian_email, guardian_phone, guardian_name),
        term:terms(name, session:academic_sessions(name)),
        class_arm:class_arms(name, class:classes(name))`)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);
    setPublishedResults(data || []);
  };

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedClassArm !== "all") {
      filtered = filtered.filter((s) => s.current_class_arm_id === selectedClassArm);
    }
    return filtered;
  }, [students, selectedClassArm]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((l) => l.subject.toLowerCase().includes(q) || l.recipient.toLowerCase().includes(q));
  }, [logs, searchQuery]);

  const logPagination = usePagination(filteredLogs);

  const handleSendResultNotifications = async () => {
    if (selectedResultIds.size === 0) {
      toast({ title: "No results selected", description: "Select results to notify guardians.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const ids = Array.from(selectedResultIds);
      
      if (bulkChannel === "email" || bulkChannel === "both") {
        const { error } = await supabase.functions.invoke("send-result-notification", {
          body: { type: "published", resultIds: ids },
        });
        if (error) throw error;
      }

      if (bulkChannel === "sms" || bulkChannel === "both" || bulkChannel === "all") {
        for (const resultId of ids) {
          const result = publishedResults.find((r: any) => r.id === resultId);
          if (!result) continue;
          const student = result.student as any;
          const term = result.term as any;
          if (!student?.guardian_phone) continue;

          const classSize = publishedResults.filter((r: any) =>
            (r.class_arm as any)?.name === (result.class_arm as any)?.name &&
            (r.term as any)?.name === term?.name
          ).length;

          await supabase.functions.invoke("send-sms-notification", {
            body: {
              phoneNumber: student.guardian_phone,
              studentName: `${student.first_name} ${student.last_name}`,
              admissionNumber: student.admission_number,
              termName: term?.name || "",
              sessionName: term?.session?.name || "",
              averageScore: result.average_score,
              classPosition: result.class_position,
              classSize,
            },
          });
        }
      }

      toast({ title: "Notifications sent", description: `Sent to ${ids.length} guardian(s) via ${bulkChannel}.` });
      setSelectedResultIds(new Set());
      fetchLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send notifications", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendCustomNotification = async () => {
    if (!customSubject || !customMessage) {
      toast({ title: "Missing fields", description: "Subject and message are required.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      let targetStudents: StudentWithGuardian[] = [];
      if (targetAudience === "all_parents") {
        targetStudents = students.filter((s) => s.guardian_email || s.guardian_phone);
      } else if (targetAudience === "class") {
        targetStudents = filteredStudents.filter((s) => s.guardian_email || s.guardian_phone);
      } else {
        targetStudents = students.filter((s) => selectedStudentIds.has(s.id));
      }

      if (targetStudents.length === 0) {
        toast({ title: "No recipients", description: "No valid recipients found.", variant: "destructive" });
        setSending(false);
        return;
      }

      // Send in-app notifications to students with user_ids
      const notifications = targetStudents.map((s) => ({
        user_id: user?.id || "",
        title: customSubject,
        message: customMessage.replace("{student_name}", `${s.first_name} ${s.last_name}`),
        type: "info",
      }));

      // Batch insert in-app notifications
      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      toast({ title: "Notifications sent", description: `Custom notification sent to ${targetStudents.length} recipient(s).` });
      setComposeOpen(false);
      setCustomSubject("");
      setCustomMessage("");
      fetchLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handlePerformanceAlerts = async () => {
    setSending(true);
    try {
      const { data: lowPerformers } = await supabase
        .from("results")
        .select(`id, average_score, class_position,
          student:students(first_name, last_name, admission_number, guardian_email, guardian_phone, guardian_name),
          term:terms(name, session:academic_sessions(name)),
          class_arm:class_arms(name, class:classes(name))`)
        .eq("status", "published")
        .lt("average_score", performanceThreshold)
        .order("average_score", { ascending: true })
        .limit(50);

      if (!lowPerformers || lowPerformers.length === 0) {
        toast({ title: "No alerts needed", description: `No students found with average below ${performanceThreshold}%.` });
        setSending(false);
        return;
      }

      setPerformanceAlertStudents(lowPerformers);

      // Send in-app notifications for low performers
      const notifications = lowPerformers
        .filter((r: any) => r.student)
        .map((r: any) => ({
          user_id: user?.id || "",
          title: "Performance Alert",
          message: `${r.student.first_name} ${r.student.last_name} (${r.student.admission_number}) scored ${Number(r.average_score).toFixed(1)}% in ${(r.term as any)?.name}. Immediate attention recommended.`,
          type: "warning",
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      toast({ title: "Performance alerts sent", description: `${lowPerformers.length} alert(s) generated for students below ${performanceThreshold}%.` });
      fetchLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate alerts", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleResultSelection = (id: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllResults = () => {
    if (selectedResultIds.size === publishedResults.length) {
      setSelectedResultIds(new Set());
    } else {
      setSelectedResultIds(new Set(publishedResults.map((r: any) => r.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Communication & Notification Engine</h1>
        <p className="text-muted-foreground">Automated SMS, email alerts, and performance notifications for all stakeholders.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Sent", value: stats.totalNotifications, icon: Bell, color: "text-primary" },
          { label: "Emails", value: stats.emailsSent, icon: Mail, color: "text-blue-500" },
          { label: "SMS", value: stats.smsSent, icon: Phone, color: "text-emerald-500" },
          { label: "In-App", value: stats.inAppSent, icon: MessageSquare, color: "text-amber-500" },
          { label: "Pending Publish", value: stats.pendingResults, icon: Clock, color: "text-orange-500" },
          { label: "Published Today", value: stats.publishedToday, icon: CheckCircle, color: "text-green-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "..." : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Result Alerts</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">History</TabsTrigger>
        </TabsList>

        {/* Result Notification Tab */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Result Notifications
              </CardTitle>
              <CardDescription>
                Notify parents/guardians when results are published. Select results and choose delivery channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Channel</Label>
                  <Select value={bulkChannel} onValueChange={(v) => setBulkChannel(v as any)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="email">Email Only</SelectItem>
                       <SelectItem value="sms">SMS Only</SelectItem>
                       <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                       <SelectItem value="both">Email + SMS</SelectItem>
                       <SelectItem value="all">All Channels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1" />
                <Button onClick={handleSendResultNotifications} disabled={sending || selectedResultIds.size === 0}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send to {selectedResultIds.size} Selected
                </Button>
              </div>

              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={publishedResults.length > 0 && selectedResultIds.size === publishedResults.length}
                          onCheckedChange={toggleAllResults}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead>Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : publishedResults.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No published results found.</TableCell></TableRow>
                    ) : (
                      publishedResults.map((r: any) => {
                        const student = r.student as any;
                        const term = r.term as any;
                        const classArm = r.class_arm as any;
                        const hasContact = student?.guardian_email || student?.guardian_phone;
                        return (
                          <TableRow key={r.id} className={!hasContact ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedResultIds.has(r.id)}
                                onCheckedChange={() => toggleResultSelection(r.id)}
                                disabled={!hasContact}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student?.last_name} {student?.first_name}</TableCell>
                            <TableCell>{classArm?.class?.name} {classArm?.name}</TableCell>
                            <TableCell>{term?.name}</TableCell>
                            <TableCell className="font-semibold">{r.average_score ? Number(r.average_score).toFixed(1) + "%" : "-"}</TableCell>
                            <TableCell>{r.class_position || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {student?.guardian_email && <Badge variant="outline" className="text-xs"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                                {student?.guardian_phone && <Badge variant="outline" className="text-xs"><Phone className="h-3 w-3 mr-1" />SMS</Badge>}
                                {!hasContact && <Badge variant="destructive" className="text-xs">No contact</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.published_at ? format(new Date(r.published_at), "dd MMM yyyy") : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compose Custom Notification */}
        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compose Custom Notification
              </CardTitle>
              <CardDescription>Send custom messages to parents, students, or specific classes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_parents">All Parents/Guardians</SelectItem>
                      <SelectItem value="class">By Class</SelectItem>
                      <SelectItem value="individual">Individual Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {targetAudience === "class" && (
                  <div>
                    <Label>Class</Label>
                    <Select value={selectedClassArm} onValueChange={setSelectedClassArm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classArms.map((ca) => (
                          <SelectItem key={ca.id} value={ca.id}>{(ca.class as any)?.name} - {ca.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label>Subject</Label>
                <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Notification subject" />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type your message here. Use {student_name} to personalize."
                  rows={5}
                />
                <p className="text-xs text-muted-foreground mt-1">Variables: {"{student_name}"} will be replaced per student.</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSendCustomNotification} disabled={sending || !customSubject || !customMessage}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Notification
                </Button>
              </div>

              {targetAudience === "individual" && (
                <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Select Students ({selectedStudentIds.size} selected)</p>
                  <div className="space-y-1">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm py-1 hover:bg-muted/50 px-2 rounded cursor-pointer">
                        <Checkbox
                          checked={selectedStudentIds.has(s.id)}
                          onCheckedChange={() => {
                            setSelectedStudentIds((prev) => {
                              const next = new Set(prev);
                              next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                              return next;
                            });
                          }}
                        />
                        <span>{s.last_name} {s.first_name} ({s.admission_number})</span>
                        {s.guardian_email && <Mail className="h-3 w-3 text-muted-foreground" />}
                        {s.guardian_phone && <Phone className="h-3 w-3 text-muted-foreground" />}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Alerts Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Academic Performance Alerts
              </CardTitle>
              <CardDescription>
                Automatically identify and notify guardians of students performing below a threshold.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label>Performance Threshold (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={performanceThreshold}
                    onChange={(e) => setPerformanceThreshold(Number(e.target.value))}
                    className="w-[120px]"
                  />
                </div>
                <Button onClick={handlePerformanceAlerts} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingDown className="h-4 w-4 mr-2" />}
                  Generate Alerts
                </Button>
              </div>

              {performanceAlertStudents.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Average</TableHead>
                        <TableHead>Guardian</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceAlertStudents.map((r: any) => {
                        const student = r.student as any;
                        const term = r.term as any;
                        const classArm = r.class_arm as any;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{student?.last_name} {student?.first_name}</TableCell>
                            <TableCell>{classArm?.class?.name} {classArm?.name}</TableCell>
                            <TableCell>{term?.name}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{Number(r.average_score).toFixed(1)}%</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {student?.guardian_name || "-"}
                              {student?.guardian_email && <span className="text-xs text-muted-foreground block">{student.guardian_email}</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                <Bell className="h-3 w-3 mr-1" />Alert Sent
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification History */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>View all sent notifications and their delivery status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notifications..."
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={fetchLogs}>
                  <RefreshCw className="h-4 w-4 mr-2" />Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S/N</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : logPagination.paginatedItems.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No notifications yet.</TableCell></TableRow>
                    ) : (
                      logPagination.paginatedItems.map((log, i) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">{logPagination.startIndex + i + 1}</TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate">{log.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {log.channel === "email" ? <Mail className="h-3 w-3 mr-1" /> :
                                log.channel === "sms" ? <Phone className="h-3 w-3 mr-1" /> :
                                  <Bell className="h-3 w-3 mr-1" />}
                              {log.channel.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                              {log.status === "sent" ? <CheckCircle className="h-3 w-3 mr-1" /> : log.status === "failed" ? <XCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  currentPage={logPagination.currentPage}
                  totalPages={logPagination.totalPages}
                  totalItems={logPagination.totalItems}
                  pageSize={logPagination.pageSize}
                  startIndex={logPagination.startIndex}
                  onPageChange={logPagination.goToPage}
                  onPageSizeChange={logPagination.changePageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
