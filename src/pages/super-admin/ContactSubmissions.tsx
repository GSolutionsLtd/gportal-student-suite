import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MapPin, Building2, Trash2, RefreshCcw, Download, FileSpreadsheet } from "lucide-react";

type Submission = {
  id: string;
  full_name: string;
  school_name: string;
  city_state: string;
  email: string;
  phone: string;
  message: string;
  source: string | null;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = ["new", "in_progress", "closed"] as const;

export default function ContactSubmissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<"all" | (typeof STATUS_OPTIONS)[number]>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load submissions", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data ?? []) as Submission[]);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contact_submissions").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const exportCsv = () => {
    if (!filtered.length) {
      toast({ title: "Nothing to export", description: "No submissions match the current filter." });
      return;
    }
    const headers = [
      "Submitted At", "Full Name", "School Name", "City / State",
      "Email", "Phone", "Source", "Status", "Message",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((s) => [
      new Date(s.created_at).toISOString(),
      s.full_name, s.school_name, s.city_state,
      s.email, s.phone, s.source ?? "", s.status, s.message,
    ].map(escape).join(","));
    const csv = "\uFEFF" + [headers.map(escape).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `contact-submissions-${filter}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Export ready", description: `${filtered.length} submission(s) downloaded as CSV.` });
  };

  const exportXlsx = () => {
    if (!filtered.length) {
      toast({ title: "Nothing to export", description: "No submissions match the current filter." });
      return;
    }
    const data = filtered.map((s) => ({
      "Submitted At": new Date(s.created_at).toLocaleString(),
      "Full Name": s.full_name,
      "School Name": s.school_name,
      "City / State": s.city_state,
      Email: s.email,
      Phone: s.phone,
      Source: s.source ?? "",
      Status: s.status,
      Message: s.message,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 22 },
      { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 60 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    XLSX.writeFile(wb, `contact-submissions-${filter}-${stamp}.xlsx`);
    toast({ title: "Excel export ready", description: `${filtered.length} submission(s) downloaded as .xlsx.` });
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contact Submissions</h1>
          <p className="text-sm text-muted-foreground">
            Demo requests, sales enquiries and free consultation leads from the website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2" disabled={!filtered.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx} className="gap-2" disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No submissions yet.</Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{s.full_name}</h3>
                    <Badge variant={s.status === "new" ? "default" : s.status === "closed" ? "outline" : "secondary"}>
                      {s.status}
                    </Badge>
                    {s.source && <Badge variant="outline" className="text-xs">{s.source}</Badge>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {s.school_name}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {s.city_state}</div>
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> <a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a></div>
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> <a href={`tel:${s.phone}`} className="text-primary hover:underline">{s.phone}</a></div>
                  </div>
                  <p className="mt-3 text-sm whitespace-pre-wrap bg-secondary/40 rounded-md p-3">{s.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>{o.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => remove(s.id)} className="gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
