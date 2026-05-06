import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Loader2, Shield, User, GraduationCap, School, UserPlus, Copy, Ban, Trash2, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  role: string | null;
}

interface InviteSchoolOption {
  id: string;
  name: string;
  code: string;
  subscription_status: string | null;
  admin_available: boolean;
}

const ROLE_ICONS: Record<string, typeof User> = {
  super_admin: Shield,
  admin: Shield,
  teacher: School,
  student: GraduationCap,
  parent: Users,
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  teacher: "bg-blue-100 text-blue-800",
  student: "bg-green-100 text-green-800",
  parent: "bg-secondary text-secondary-foreground",
};

export default function UserManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSchools, setInviteSchools] = useState<InviteSchoolOption[]>([]);
  const [selectedInviteSchoolId, setSelectedInviteSchoolId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ code: string; link: string; expires_at: string } | null>(null);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, is_active, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        ...profile,
        role: roleMap.get(profile.id) || null,
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string | null) => {
    if (!role) return <Badge variant="outline">No Role</Badge>;
    const Icon = ROLE_ICONS[role] || User;
    const colorClass = ROLE_COLORS[role] || "";
    return (
      <Badge className={colorClass}>
        <Icon className="h-3 w-3 mr-1" />
        {role.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const openInviteDialog = async () => {
    setInviteDialogOpen(true);
    setInviteResult(null);
    setInviteError("");
    setInviteEmail("");
    setSelectedInviteSchoolId("");

    const { data, error } = await supabase.functions.invoke("school-admin-invites", {
      body: { action: "list-schools" },
    });
    if (error || data?.error) {
      setInviteError(data?.error || error?.message || "Failed to load eligible schools.");
      return;
    }
    const eligible = ((data?.schools || []) as InviteSchoolOption[]).filter((school) => school.admin_available);
    setInviteSchools(eligible);
    if (eligible[0]) setSelectedInviteSchoolId(eligible[0].id);
  };

  const generateInvite = async () => {
    if (!selectedInviteSchoolId) return;
    setInviteCreating(true);
    setInviteError("");
    try {
      const { data, error } = await supabase.functions.invoke("school-admin-invites", {
        body: { action: "create", schoolId: selectedInviteSchoolId, email: inviteEmail.trim() },
      });
      const backendError = data?.error || error?.message;
      if (backendError) throw new Error(backendError);
      if (!data?.invite?.code) throw new Error("Failed to generate invite code.");
      setInviteResult({
        code: data.invite.code,
        link: `${window.location.origin}/auth?invite=${data.invite.code}`,
        expires_at: data.invite.expires_at,
      });
      toast({ title: "Invite created", description: "Share the code or link with the new Admin." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite generation failed.";
      setInviteError(message);
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    } finally {
      setInviteCreating(false);
    }
  };

  const copyInvite = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const manageUser = async (user: UserWithRole, action: "suspend" | "activate" | "delete") => {
    if (action === "delete" && !confirm(`Delete ${user.full_name || user.email}? This removes the account and cannot be undone.`)) return;
    if (action === "suspend" && !confirm(`Suspend ${user.full_name || user.email}? They will not be able to sign in.`)) return;

    setActionLoadingId(`${action}:${user.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-users", {
        body: { action, userId: user.id },
      });
      const backendError = data?.error || error?.message;
      if (backendError) throw new Error(backendError);
      toast({ title: "User updated", description: action === "delete" ? "User deleted successfully." : `User ${action === "activate" ? "activated" : "suspended"}.` });
      await fetchUsers();
    } catch (error) {
      toast({ title: "Action failed", description: error instanceof Error ? error.message : "Could not update user.", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            View and manage all users in the system
          </p>
        </div>
        <Button onClick={openInviteDialog} className="gap-2 sm:w-auto w-full">
          <UserPlus className="h-4 w-4" />
          Invite School Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
          <CardDescription>
            {users.length} total users in the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {user.is_active ? (
                            <Button variant="outline" size="sm" onClick={() => manageUser(user, "suspend")} disabled={!!actionLoadingId || user.role === "super_admin"} className="gap-1">
                              {actionLoadingId === `suspend:${user.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                              Suspend
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => manageUser(user, "activate")} disabled={!!actionLoadingId || user.role === "super_admin"} className="gap-1">
                              {actionLoadingId === `activate:${user.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              Activate
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => manageUser(user, "delete")} disabled={!!actionLoadingId || user.role === "super_admin"}>
                            {actionLoadingId === `delete:${user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite School Admin
            </DialogTitle>
            <DialogDescription>
              Generate a one-time signup invite for an eligible school without a primary Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>School</Label>
              <Select value={selectedInviteSchoolId} onValueChange={setSelectedInviteSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder={inviteSchools.length === 0 ? "No eligible schools available" : "Select a school"} />
                </SelectTrigger>
                <SelectContent>
                  {inviteSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>{school.name} ({school.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-management-invite-email">Restrict to email (optional)</Label>
              <Input id="user-management-invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="admin@school.com" />
            </div>
            <Button onClick={generateInvite} disabled={!selectedInviteSchoolId || inviteCreating} className="w-full">
              {inviteCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Invite
            </Button>
            {inviteResult && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border rounded px-2 py-1 font-mono">{inviteResult.code}</code>
                  <Button variant="outline" size="icon" onClick={() => copyInvite(inviteResult.code)}><Copy className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border rounded px-2 py-1 text-xs truncate">{inviteResult.link}</code>
                  <Button variant="outline" size="icon" onClick={() => copyInvite(inviteResult.link)}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Status: unused · Expires {format(new Date(inviteResult.expires_at), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
            )}
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
