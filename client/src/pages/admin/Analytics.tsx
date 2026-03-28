import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import {
  Users, BookOpen, DollarSign, TrendingUp, ClipboardList,
  ShieldCheck, GraduationCap, Star, Award,
} from "lucide-react";

const COLORS = [
  "hsl(217, 91%, 60%)", "hsl(24, 95%, 53%)", "hsl(158, 64%, 42%)",
  "hsl(43, 96%, 56%)", "hsl(280, 68%, 56%)", "hsl(350, 80%, 55%)",
];

function StatCard({ label, value, icon, bg }: { label: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

// ==================== Tab: 今日概览 ====================
function OverviewTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats/overview"] });

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <StatCard label="今日新增用户" value={data?.todayUsers || 0} icon={<Users size={18} className="text-primary" />} bg="bg-primary/10" />
      <StatCard label="今日新增需求" value={data?.todayDemands || 0} icon={<ClipboardList size={18} className="text-violet-500" />} bg="bg-violet-50 dark:bg-violet-900/20" />
      <StatCard label="今日新增订单" value={data?.todayOrders || 0} icon={<BookOpen size={18} className="text-blue-500" />} bg="bg-blue-50 dark:bg-blue-900/20" />
      <StatCard label="平台总 GMV" value={`¥${data?.totalGmv || 0}`} icon={<DollarSign size={18} className="text-rose-500" />} bg="bg-rose-50 dark:bg-rose-900/20" />
      <StatCard label="平台佣金总额" value={`¥${data?.totalPlatformFee || 0}`} icon={<DollarSign size={18} className="text-green-500" />} bg="bg-green-50 dark:bg-green-900/20" />
      <StatCard label="已完成订单" value={`${data?.completedOrders || 0}/${data?.totalOrders || 0}`} icon={<TrendingUp size={18} className="text-emerald-500" />} bg="bg-emerald-50 dark:bg-emerald-900/20" />
    </div>
  );
}

// ==================== Tab: 用户分析 ====================
function UsersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats/users"] });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="老师认证率" value={`${data?.certificationRate || 0}%`} icon={<ShieldCheck size={18} className="text-amber-500" />} bg="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard label="已认证老师" value={data?.certifiedTeachers || 0} icon={<GraduationCap size={18} className="text-green-500" />} bg="bg-green-50 dark:bg-green-900/20" />
        <StatCard label="老师总数" value={data?.totalTeachers || 0} icon={<Users size={18} className="text-primary" />} bg="bg-primary/10" />
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">用户增长趋势（近30天）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.growth || []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip labelFormatter={(v) => `日期: ${v}`} />
              <Line type="monotone" dataKey="parents" name="家长" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="teachers" name="老师" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={false} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">用户角色分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data?.roleDistribution || []} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(data?.roleDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">城市分布 Top10</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.cityDistribution || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="city" type="category" fontSize={12} width={60} />
                <Tooltip />
                <Bar dataKey="count" name="用户数" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== Tab: 订单分析 ====================
function OrdersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats/orders"] });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="总订单数" value={data?.totalOrders || 0} icon={<BookOpen size={18} className="text-blue-500" />} bg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="平均订单金额" value={`¥${data?.avgAmount || 0}`} icon={<DollarSign size={18} className="text-green-500" />} bg="bg-green-50 dark:bg-green-900/20" />
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">订单量趋势（近30天）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip labelFormatter={(v) => `日期: ${v}`} />
              <Line type="monotone" dataKey="count" name="订单数" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">订单状态分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data?.statusDistribution || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(data?.statusDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">服务类别订单量</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.categoryDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="category" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="订单数" fill="hsl(158, 64%, 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== Tab: 老师分析 ====================
function TeachersTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats/teachers"] });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <StatCard label="老师总数" value={data?.totalTeachers || 0} icon={<Users size={18} className="text-primary" />} bg="bg-primary/10" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">老师评分分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.ratingDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="range" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="老师数" fill="hsl(43, 96%, 56%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">服务类别分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data?.skillDistribution || []} dataKey="count" nameKey="skill" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(data?.skillDistribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award size={16} />
            接单量 Top 10
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.top10Teachers || data.top10Teachers.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {data.top10Teachers.map((t: any, idx: number) => (
                <div key={t.teacherId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30" data-testid={`teacher-rank-${idx}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{t.orderCount} 单</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Main Page ====================
export default function AdminAnalytics() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">数据分析</h1>
        <p className="text-sm text-muted-foreground mt-1">平台核心运营指标可视化</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg" data-testid="analytics-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">今日概览</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">用户分析</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">订单分析</TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teachers">老师分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
        <TabsContent value="orders" className="mt-6"><OrdersTab /></TabsContent>
        <TabsContent value="teachers" className="mt-6"><TeachersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
