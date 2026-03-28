import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Clock, DollarSign, Trash2, Users } from "lucide-react";
import type { Demand } from "@shared/schema";

const statusMap: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "招募中", color: "default" },
  matched: { label: "已匹配", color: "secondary" },
  closed: { label: "已关闭", color: "outline" },
  cancelled: { label: "已取消", color: "destructive" },
};

const serviceTypeMap: Record<string, string> = {
  home: "上门服务",
  center: "机构中心",
  online: "线上授课",
};

export default function MyDemands() {
  const { toast } = useToast();
  const { data: demands, isLoading } = useQuery<Demand[]>({
    queryKey: ["/api/demands/my"],
  });

  const { data: appCounts } = useQuery<Record<number, number>>({
    queryKey: ["/api/demands/application-counts"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/demands/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demands/my"] });
      toast({ title: "需求已取消" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "操作失败", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">我的需求</h1>
          <p className="text-sm text-muted-foreground mt-1">管理您发布的所有服务需求</p>
        </div>
        <Link href="/parent/post-demand">
          <Button data-testid="btn-new-demand" className="gap-2">
            <Plus size={16} />
            发布需求
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : demands?.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Plus size={28} className="opacity-40" />
            </div>
            <p className="font-medium text-foreground">还没有需求</p>
            <p className="text-sm mt-1">发布您的第一个需求，快速匹配合适的老师</p>
            <Link href="/parent/post-demand">
              <Button className="mt-4" data-testid="btn-first-demand">发布需求</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {demands?.map((d) => (
            <Card key={d.id} className="border-card-border" data-testid={`demand-card-${d.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{d.serviceCategory}</span>
                      {d.specificService && (
                        <Badge variant="outline" className="text-xs">{d.specificService}</Badge>
                      )}
                      <Badge variant={statusMap[d.status]?.color || "default"}>
                        {statusMap[d.status]?.label || d.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>孩子{d.childAge}岁 {d.childGender || ""}</span>
                      <span>· {serviceTypeMap[d.serviceType] || d.serviceType}</span>
                      {d.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {d.location}
                        </span>
                      )}
                      {(d.budgetMin || d.budgetMax) && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} />
                          {d.budgetMin || 0}-{d.budgetMax || "不限"} 元/小时
                        </span>
                      )}
                    </div>
                    {d.specialRequirements && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {d.specialRequirements}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleDateString("zh-CN")
                        : "未知时间"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {(appCounts?.[d.id] || 0) > 0 && (
                      <Link href={`/parent/demands/${d.id}/applications`}>
                        <Button size="sm" variant="default" className="gap-1.5" data-testid={`btn-view-apps-${d.id}`}>
                          <Users size={13} />
                          {appCounts[d.id]} 位老师申请
                        </Button>
                      </Link>
                    )}
                    <Link href={`/parent/teachers`}>
                      <Button size="sm" variant="outline" data-testid={`btn-match-${d.id}`}>
                        匹配老师
                      </Button>
                    </Link>
                    {d.status === "open" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => cancelMutation.mutate(d.id)}
                        disabled={cancelMutation.isPending}
                        data-testid={`btn-cancel-demand-${d.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
