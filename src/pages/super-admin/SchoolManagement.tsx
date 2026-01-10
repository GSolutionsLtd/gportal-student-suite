import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  School,
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";

interface SchoolData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  motto: string | null;
  subscription_status: string;
  subscription_ends_at: string | null;
  max_students: number;
  max_teachers: number;
  created_at: string;
  admin_count?: number;
  student_count?: number;
  teacher_count?: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-blue-500/20 text-blue-700 border-blue-500/50",
  active: "bg-green-500/20 text-green-700 border-green-500/50",
  suspended: "bg-yellow-500/20 text-yellow-700 border-yellow-500/50",
  expired: "bg-red-500/20 text-red-700 border-red-500/50",
};

export default function SchoolManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState<AdminUser[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    motto: "",
    max_students: 100,
    max_teachers: 20,
    subscription_status: "trial",
    subscription_days: 30,
  });

  useEffect(() => {
    fetchSchools();
    fetchAvailableAdmins();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSchools((data as SchoolData[]) || []);
    } catch (error) {
      console.error("Error fetching schools:", error);
      toast({ title: "Error", description: "Failed to fetch schools", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAdmins = async () => {
    try {
      // Get users with admin role
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (!adminRoles || adminRoles.length === 0) {
        setAvailableAdmins([]);
        return;
      }

      const adminIds = adminRoles.map((r) => r.user_id);

      // Get profile info for admins
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", adminIds);

      // Get already assigned admins
      const { data: assignedAdmins } = await supabase
        .from("school_admins")
        .select("user_id");

      const assignedIds = new Set((assignedAdmins || []).map((a) => a.user_id));

      // Filter out already assigned admins
      const available = (profiles || []).filter((p) => !assignedIds.has(p.id));
      setAvailableAdmins(available);
    } catch (error) {
      console.error("Error fetching available admins:", error);
    }
  };

  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      searchQuery === "" ||
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || school.subscription_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openCreateDialog = () => {
    setEditingSchool(null);
    setFormData({
      name: "",
      code: "",
      address: "",
      phone: "",
      email: "",
      motto: "",
      max_students: 100,
      max_teachers: 20,
      subscription_status: "trial",
      subscription_days: 30,
    });
    setSelectedAdmin("");
    setDialogOpen(true);
  };

  const openEditDialog = (school: SchoolData) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      code: school.code,
      address: school.address || "",
      phone: school.phone || "",
      email: school.email || "",
      motto: school.motto || "",
      max_students: school.max_students,
      max_teachers: school.max_teachers,
      subscription_status: school.subscription_status,
      subscription_days: 30,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast({ title: "Error", description: "School name and code are required", variant: "destructive" });
      return;
    }

    try {
      setProcessing(true);

      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + formData.subscription_days);

      const schoolData = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        motto: formData.motto || null,
        max_students: formData.max_students,
        max_teachers: formData.max_teachers,
        subscription_status: formData.subscription_status,
        subscription_ends_at: subscriptionEndsAt.toISOString(),
      };

      if (editingSchool) {
        const { error } = await supabase
          .from("schools")
          .update(schoolData)
          .eq("id", editingSchool.id);

        if (error) throw error;
        toast({ title: "Success", description: "School updated successfully" });
      } else {
        const { data: newSchool, error } = await supabase
          .from("schools")
          .insert({ ...schoolData, created_by: user?.id })
          .select()
          .single();

        if (error) throw error;

        // Assign admin if selected
        if (selectedAdmin && newSchool) {
          const { error: adminError } = await supabase
            .from("school_admins")
            .insert({
              school_id: newSchool.id,
              user_id: selectedAdmin,
              is_primary: true,
            });

          if (adminError) {
            console.error("Error assigning admin:", adminError);
          }
        }

        toast({ title: "Success", description: "School created successfully" });
      }

      setDialogOpen(false);
      fetchSchools();
      fetchAvailableAdmins();
    } catch (error: any) {
      console.error("Error saving school:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save school",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (school: SchoolData) => {
    if (!confirm(`Are you sure you want to delete ${school.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessing(true);
      const { error } = await supabase.from("schools").delete().eq("id", school.id);

      if (error) throw error;

      toast({ title: "Success", description: "School deleted successfully" });
      fetchSchools();
    } catch (error) {
      console.error("Error deleting school:", error);
      toast({ title: "Error", description: "Failed to delete school", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const updateSubscriptionStatus = async (schoolId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("schools")
        .update({ subscription_status: status })
        .eq("id", schoolId);

      if (error) throw error;

      toast({ title: "Success", description: "Subscription status updated" });
      fetchSchools();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">School Management</h1>
          <p className="text-muted-foreground">
            Onboard and manage schools in the system
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add New School
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Schools
            </CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schools.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
            <Badge className={STATUS_COLORS.active}>Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schools.filter((s) => s.subscription_status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trial
            </CardTitle>
            <Badge className={STATUS_COLORS.trial}>Trial</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schools.filter((s) => s.subscription_status === "trial").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspended/Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schools.filter((s) => ["suspended", "expired"].includes(s.subscription_status)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schools Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No schools found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{school.name}</p>
                        {school.motto && (
                          <p className="text-xs text-muted-foreground italic">
                            "{school.motto}"
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{school.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {school.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{school.email}</span>
                          </div>
                        )}
                        {school.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{school.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3 text-muted-foreground" />
                          <span>{school.max_students} students</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span>{school.max_teachers} teachers</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={school.subscription_status}
                        onValueChange={(value) => updateSubscriptionStatus(school.id, value)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <Badge className={STATUS_COLORS[school.subscription_status]}>
                            {school.subscription_status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(school.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(school)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(school)}
                          disabled={processing}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchool ? "Edit School" : "Add New School"}
            </DialogTitle>
            <DialogDescription>
              {editingSchool
                ? "Update school information"
                : "Onboard a new school to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">School Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter school name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">School Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SCH001"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motto">Motto</Label>
              <Input
                id="motto"
                value={formData.motto}
                onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                placeholder="School motto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="school@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+234..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_students">Max Students</Label>
                <Input
                  id="max_students"
                  type="number"
                  value={formData.max_students}
                  onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 100 })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_teachers">Max Teachers</Label>
                <Input
                  id="max_teachers"
                  type="number"
                  value={formData.max_teachers}
                  onChange={(e) => setFormData({ ...formData, max_teachers: parseInt(e.target.value) || 20 })}
                  min={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subscription_status">Subscription Status</Label>
                <Select
                  value={formData.subscription_status}
                  onValueChange={(value) => setFormData({ ...formData, subscription_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription_days">Subscription Days</Label>
                <Input
                  id="subscription_days"
                  type="number"
                  value={formData.subscription_days}
                  onChange={(e) => setFormData({ ...formData, subscription_days: parseInt(e.target.value) || 30 })}
                  min={1}
                />
              </div>
            </div>

            {!editingSchool && availableAdmins.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="admin">Assign Primary Admin</Label>
                <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an admin (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAdmins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name} ({admin.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchool ? "Update School" : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
