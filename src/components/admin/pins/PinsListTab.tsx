import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Trash2, Ban, RotateCcw, UserX, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type PinStatus = Database["public"]["Enums"]["pin_status"];

interface Term {
  id: string;
  name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

interface Pin {
  id: string;
  serial_number: string;
  pin_code: string;
  status: PinStatus;
  max_usage: number;
  usage_count: number;
  expires_at: string | null;
  generated_at: string;
  term_id: string | null;
  student_id: string | null;
  term?: Term;
  student?: Student;
}

export const PinsListTab = () => {
  const [pins, setPins] = useState<Pin[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [termFilter, setTermFilter] = useState<string>("all");
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    fetchTerms();
    fetchPins();
  }, []);

  const fetchTerms = async () => {
    const { data } = await supabase
      .from("terms")
      .select("id, name")
      .order("start_date", { ascending: false });
    setTerms(data || []);
  };

  const fetchPins = async () => {
    setLoading(true);
    let query = supabase
      .from("pins")
      .select(`
        *,
        term:terms(id, name),
        student:students(id, first_name, last_name, admission_number)
      `)
      .order("generated_at", { ascending: false })
      .limit(100);

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to fetch PINs");
    } else {
      setPins(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (pinId: string, newStatus: PinStatus) => {
    const { error } = await supabase
      .from("pins")
      .update({ status: newStatus })
      .eq("id", pinId);

    if (error) {
      toast.error("Failed to update PIN status");
    } else {
      toast.success(`PIN ${newStatus === "deactivated" ? "deactivated" : "reactivated"} successfully`);
      fetchPins();
    }
  };

  const handleDelete = async (pinId: string) => {
    if (!confirm("Are you sure you want to delete this PIN?")) return;

    const { error } = await supabase.from("pins").delete().eq("id", pinId);

    if (error) {
      toast.error("Failed to delete PIN");
    } else {
      toast.success("PIN deleted successfully");
      fetchPins();
    }
  };

  const openUnassignDialog = (pin: Pin) => {
    setSelectedPin(pin);
    setUnassignDialogOpen(true);
  };

  const handleUnassign = async () => {
    if (!selectedPin) return;

    setUnassigning(true);
    try {
      const { error } = await supabase
        .from("pins")
        .update({ student_id: null })
        .eq("id", selectedPin.id);

      if (error) throw error;

      toast.success(`PIN unassigned from ${selectedPin.student?.first_name} ${selectedPin.student?.last_name}`);
      setUnassignDialogOpen(false);
      setSelectedPin(null);
      fetchPins();
    } catch (error: any) {
      toast.error("Failed to unassign PIN: " + error.message);
    } finally {
      setUnassigning(false);
    }
  };

  const getStatusBadge = (status: PinStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "used":
        return <Badge variant="secondary">Used</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "deactivated":
        return <Badge variant="destructive">Deactivated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredPins = pins.filter((pin) => {
    const studentName = pin.student 
      ? `${pin.student.first_name} ${pin.student.last_name} ${pin.student.admission_number}`.toLowerCase() 
      : "";
    const matchesSearch =
      pin.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pin.pin_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      studentName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || pin.status === statusFilter;
    const matchesTerm = termFilter === "all" || pin.term_id === termFilter;
    return matchesSearch && matchesStatus && matchesTerm;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All PINs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by serial number, PIN code, or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={termFilter} onValueChange={setTermFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : filteredPins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No PINs found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>PIN Code</TableHead>
                    <TableHead>Assigned Student</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPins.map((pin) => (
                    <TableRow key={pin.id}>
                      <TableCell className="font-mono">{pin.serial_number}</TableCell>
                      <TableCell className="font-mono font-medium">{pin.pin_code}</TableCell>
                      <TableCell>
                        {pin.student ? (
                          <div>
                            <div className="font-medium">
                              {pin.student.first_name} {pin.student.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {pin.student.admission_number}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{pin.term?.name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(pin.status)}</TableCell>
                      <TableCell>
                        {pin.usage_count} / {pin.max_usage}
                      </TableCell>
                      <TableCell>
                        {pin.expires_at
                          ? new Date(pin.expires_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {new Date(pin.generated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {pin.student && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openUnassignDialog(pin)}
                              title="Unassign from student"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          {pin.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStatusChange(pin.id, "deactivated")}
                              title="Deactivate PIN"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : pin.status === "deactivated" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStatusChange(pin.id, "active")}
                              title="Reactivate PIN"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(pin.id)}
                            title="Delete PIN"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Showing {filteredPins.length} of {pins.length} PINs
          </div>
        </CardContent>
      </Card>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign PIN from Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the PIN assignment from{" "}
              <strong>
                {selectedPin?.student?.first_name} {selectedPin?.student?.last_name}
              </strong>{" "}
              ({selectedPin?.student?.admission_number}). The PIN will become available for reassignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnassign} disabled={unassigning}>
              {unassigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unassigning...
                </>
              ) : (
                "Unassign PIN"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};