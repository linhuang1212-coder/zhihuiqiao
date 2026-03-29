import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, BookOpen, DollarSign, TrendingUp, ClipboardList, ShieldCheck, Unlock, Clock } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const cards = [
    { label: "总用户数", value: stats?.totalUsers || 0, icon: <Users className="text-primary" size={20} />, bg: "bg-primary/10" },
    { label: "教师数", value: stats?.totalTeachers || 0, icon: <ShieldCheck className="text-green-500" size={20} />, bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "家长数", value: stats?.totalParents || 0, icon: <Users className="text-amber-500" size={20} />, bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "总订单数", value: stats?.totalOrders || 0, icon: <BookOpen className="text-blue-500" size={20} />, bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "完成订单", value: stats?.completedOrders || 0, icon: <TrendingUp className="text-emerald-500" size={20} />, bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "总需求数", value: stats?.totalDemands || 0, icon: <ClipboardList className="text-violet-500" size={20} />, bg: "bg-violet-50 dark:bg-violet-900/20" },
    { label: "平台GMV", value: `¥${stats?.gmv || 0}`, icon: <DollarSign className="text-rose-500" size={20} />, bg: "bg-rose-50 dark:bg-rose-900/20" },
    { label: "套餐收入", value: `¥${stats?.totalRevenue?.toFixed(1) || 0}`, icon: <DollarSign className="text-green-500" size={20} />, bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "总解锁次数", value: stats?.totalUnlocks || 0, icon: <Unlock className="text-indigo-500" size={20} />, bg: "bg-indigo-50 dark:bg-indigo-900/20" },
    { label: "待确认订单", value: stats?.pendingPurchases || 0, icon: <Clock className="text-orange-500" size={20} />, bg: "bg-orange-50 dark:bg-orange-900/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">管理后台</h1>
        <p className="text-sm text-muted-foreground mt-1">平台整体运营数据概览</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8,9,10].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <Card key={i} className="border-card-border">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>{c.icon}</div>
                <div className="text-xl font-bold text-foreground" data-testid={`admin-stat-${i}`}>{c.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">快速操作</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 前往 <a href="/#/admin/certifications" className="text-primary hover:underline">教师认证</a> 审核待认证老师</p>
            <p>• 前往 <a href="/#/admin/users" className="text-primary hover:underline">用户管理</a> 管理用户状态</p>
            <p>• 前往 <a href="/#/admin/orders" className="text-primary hover:underline">订单管理</a> 查看所有订单</p>
            <p>• 前往 <a href="/#/admin/revenue" className="text-primary hover:underline">收入管理</a> 确认购买订单</p>
            <p>• 前往 <a href="/#/admin/analytics" className="text-primary hover:underline">数据分析</a> 查看详细报表</p>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">平台指标</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">订单完成率</span>
              <span className="font-medium">
                {stats?.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">人均GMV</span>
              <span className="font-medium">
                ¥{stats?.totalOrders > 0 ? Math.round((stats?.gmv || 0) / stats.totalOrders) : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">师生比</span>
              <span className="font-medium">
                {stats?.totalTeachers && stats?.totalParents ? `1:${Math.round(stats.totalParents / stats.totalTeachers)}` : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
