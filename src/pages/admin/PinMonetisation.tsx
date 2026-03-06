import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, TrendingUp, Key, BarChart3, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line } from "recharts";

const PIN_TYPE_LABELS: Record<string, string> = {
  single_use: "Single Use",
  multi_use: "Multi Use",
  unlimited: "Unlimited",
};

const PIN_TYPE_COLORS: Record<string, string> = {
  single_use: "#ef4444",
  multi_use: "#3b82f6",
  unlimited: "#22c55e",
};

export default function PinMonetisation() {
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [pins, setPins] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalPins: 0,
    avgPrice: 0,
    activeRevenue: 0,
    usedRevenue: 0,
  });

  useEffect(() => {
    fetchTerms();
  }, []);

  useEffect(() => {
    if (selectedTerm) fetchPinData();
  }, [selectedTerm]);

  const fetchTerms = async () => {
    const { data } = await supabase.from("terms").select("id, name, is_current").order("start_date", { ascending: false });
    setTerms(data || []);
    const current = data?.find(t => t.is_current);
    if (current) setSelectedTerm(current.id);
  };

  const fetchPinData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pins")
      .select("id, pin_type, price, status, max_usage, usage_count, created_at, student_id")
      .eq("term_id", selectedTerm);

    const allPins = data || [];
    setPins(allPins);

    // Calculate stats
    const totalRevenue = allPins.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const activeRevenue = allPins.filter(p => p.status === "active").reduce((sum, p) => sum + Number(p.price || 0), 0);
    const usedRevenue = allPins.filter(p => p.status === "used").reduce((sum, p) => sum + Number(p.price || 0), 0);
    const paidPins = allPins.filter(p => Number(p.price) > 0);

    setStats({
      totalRevenue,
      totalPins: allPins.length,
      avgPrice: paidPins.length > 0 ? totalRevenue / paidPins.length : 0,
      activeRevenue,
      usedRevenue,
    });

    // Type distribution
    const typeCounts: Record<string, { count: number; revenue: number }> = {};
    allPins.forEach(p => {
      const type = p.pin_type || "multi_use";
      if (!typeCounts[type]) typeCounts[type] = { count: 0, revenue: 0 };
      typeCounts[type].count++;
      typeCounts[type].revenue += Number(p.price || 0);
    });
    setTypeDistribution(
      Object.entries(typeCounts).map(([type, data]) => ({
        name: PIN_TYPE_LABELS[type] || type,
        value: data.count,
        revenue: data.revenue,
        type,
      }))
    );

    // Revenue by date
    const byDate: Record<string, number> = {};
    allPins.forEach(p => {
      const date = new Date(p.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
      byDate[date] = (byDate[date] || 0) + Number(p.price || 0);
    });
    setRevenueData(
      Object.entries(byDate)
        .slice(-14)
        .map(([date, revenue]) => ({ date, revenue }))
    );

    setLoading(false);
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

  const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

  if (loading && !selectedTerm) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">PIN Monetisation</h1>
          <p className="text-muted-foreground">Revenue analytics and tiered PIN management</p>
        </div>
        <Select value={selectedTerm} onValueChange={setSelectedTerm}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select term" />
          </SelectTrigger>
          <SelectContent>
            {terms.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name} {t.is_current && "(Current)"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total PINs</p>
                <p className="text-2xl font-bold">{stats.totalPins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Price/PIN</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Realized Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.usedRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="tiers">PIN Tiers</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>Daily PIN revenue generation</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No revenue data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={v => `₦${v}`} />
                      <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Revenue"]} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PIN Type Distribution</CardTitle>
                <CardDescription>Breakdown by PIN tier</CardDescription>
              </CardHeader>
              <CardContent>
                {typeDistribution.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {typeDistribution.map((entry, i) => (
                          <Cell key={i} fill={PIN_TYPE_COLORS[entry.type] || COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tiers">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                type: "single_use",
                label: "Single Use",
                description: "One-time result access. Best for individual term checks.",
                icon: "🔑",
                maxUsage: 1,
                color: "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
              },
              {
                type: "multi_use",
                label: "Multi Use",
                description: "Multiple accesses within the term. Ideal for parents who need repeated checks.",
                icon: "🔐",
                maxUsage: 5,
                color: "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
              },
              {
                type: "unlimited",
                label: "Unlimited",
                description: "Unlimited access for the full academic session. Premium option.",
                icon: "🏆",
                maxUsage: 999,
                color: "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
              },
            ].map(tier => {
              const tierPins = pins.filter(p => (p.pin_type || "multi_use") === tier.type);
              const tierRevenue = tierPins.reduce((s, p) => s + Number(p.price || 0), 0);
              return (
                <Card key={tier.type} className={tier.color}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{tier.icon}</span>
                      {tier.label}
                    </CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">PINs Generated</span>
                      <span className="font-bold">{tierPins.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Usage</span>
                      <span className="font-bold">{tier.maxUsage === 999 ? "∞" : tier.maxUsage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Revenue</span>
                      <span className="font-bold">{formatCurrency(tierRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Badge variant="secondary">{tierPins.filter(p => p.status === "active").length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Used</span>
                      <Badge variant="outline">{tierPins.filter(p => p.status === "used").length}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {typeDistribution.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data available</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={v => `₦${v}`} />
                      <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>PIN Type</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeDistribution.map(item => (
                        <TableRow key={item.type}>
                          <TableCell>
                            <Badge style={{ backgroundColor: PIN_TYPE_COLORS[item.type], color: "#fff" }}>
                              {item.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.value}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                          <TableCell className="text-right">
                            {stats.totalRevenue > 0 ? ((item.revenue / stats.totalRevenue) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
