import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface PinUsageLog {
  id: string;
  pin_id: string;
  student_id: string | null;
  used_at: string;
  ip_address: string | null;
  user_agent: string | null;
  pin?: {
    serial_number: string;
    pin_code: string;
  };
  student?: {
    first_name: string;
    last_name: string;
    admission_number: string;
  };
}

export const PinUsageLogsTab = () => {
  const [logs, setLogs] = useState<PinUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("pin_usage_logs")
      .select(`
        *,
        pin:pins(serial_number, pin_code),
        student:students(first_name, last_name, admission_number)
      `)
      .order("used_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Failed to fetch usage logs");
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.pin?.serial_number?.toLowerCase().includes(searchLower) ||
      log.pin?.pin_code?.toLowerCase().includes(searchLower) ||
      log.student?.admission_number?.toLowerCase().includes(searchLower) ||
      log.student?.first_name?.toLowerCase().includes(searchLower) ||
      log.student?.last_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatUserAgent = (ua: string | null) => {
    if (!ua) return "-";
    // Simplify user agent display
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return ua.slice(0, 30) + "...";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PIN Usage Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by PIN, serial number, or student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No usage logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>PIN Code</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.used_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.pin?.serial_number || "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {log.pin?.pin_code || "-"}
                    </TableCell>
                    <TableCell>
                      {log.student
                        ? `${log.student.first_name} ${log.student.last_name} (${log.student.admission_number})`
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ip_address || "-"}
                    </TableCell>
                    <TableCell>{formatUserAgent(log.user_agent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </CardContent>
    </Card>
  );
};
