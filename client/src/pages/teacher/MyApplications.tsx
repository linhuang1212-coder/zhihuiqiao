import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, DollarSign, CheckCircle2, XCircle, Clock, Undo2 } from "lucide-react";

interface ApplicationWithDemand {
  id: number;
  demandId: number;
  introduction: string;
  quotedPrice: number;
  status: string;
  parentNote: string | null;
  createdAt: string | null;
  demand: {
    id: number;
    serviceCategory: string;
    specificService: string | null;
    serviceType: string;
    location: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    childAge: number;
    status: string;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon?: typeof CheckCircle2 }> = {
  pending: { label: "待审核", variant: "secondary", icon: Clock },
  accepted: { label: "已接受", variant: "default", icon: CheckCircle2 },
  rejected: { label: "未通过", variant: "destructive", icon: XCircle },
  withdrawn: { label: "已撤回", variant: "outline", icon: Undo2 },
};

const serviceTypeMap: Record<string, string> = {
  home: "上门服务", center: "机构中心", online: "线上授课",
};

export default function MyApplications() {
  const { toast } = useToast();

  const { data: applications, isLoading } = useQuery<ApplicationWithDemand[]>({
    queryKey: ["/api/teacher/my-applications"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (appId: number) => {
      await apiRequest("DELETE", `/api/demand-applications/${appId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-hall"] });
      toast({ title: "已撤回申请" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "撤回失败", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">我的申请</h1>
        <p className="text-sm text-muted-foreground mt-1">查看您提交的所有接单申请及审核状态</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : !applications || applications.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="text-center py-16 text-muted-foreground">
            <p>暂无申请记录</p>
            <p className="text-xs mt-1">前往「需求大厅」浏览并申请感兴趣的需求</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => {
            const config = statusConfig[a.status] || statusConfig.pending;
            const Icon = config.icon;
            return (
              <Card key={a.id} className="border-card-border" data-testid={`app-card-${a.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.demand?.serviceCategory || "未知需求"}</span>
                        {a.demand?.specificService && (
                          <Badge variant="outline" className="text-xs">{a.demand.specificService}</Badge>
                        )}
                        <Badge variant={config.variant} className="text-xs gap-1">
                          {Icon && <Icon size={10} />}
                          {config.label}
                        </Badge>
                      </div>

                      {a.demand && (
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>孩子{a.demand.childAge}岁</span>
                          <span>{serviceTypeMap[a.demand.serviceType] || a.demand.serviceType}</span>
                          {a.demand.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {a.demand.location}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign size={13} />
                          我的报价：¥{a.quotedPrice}/小时
                        </span>
                        {a.demand?.budgetMin || a.demand?.budgetMax ? (
                          <span className="text-muted-foreground">
                            预算 ¥{a.demand.budgetMin || 0}-{a.demand.budgetMax || "不限"}/小时
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{a.introduction}</p>

                      {a.status === "rejected" && a.parentNote && (
                        <p className="mt-2 text-sm text-destructive">拒绝原因：{a.parentNote}</p>
                      )}

                      <div className="mt-2 text-xs text-muted-foreground">
                        {a.createdAt && `申请时间：${new Date(a.createdAt).toLocaleDateString("zh-CN")}`}
                      </div>
                    </div>

                    {a.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => withdrawMutation.mutate(a.id)}
                        disabled={withdrawMutation.isPending}
                        data-testid={`btn-withdraw-app-${a.id}`}
                      >
                        撤回
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
