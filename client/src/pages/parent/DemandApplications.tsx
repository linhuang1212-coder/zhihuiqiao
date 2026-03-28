import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Star, DollarSign, GraduationCap, CheckCircle2, XCircle, ShieldCheck, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import CertificationStatusBadge from "@/components/CertificationStatusBadge";

interface ApplicationWithTeacher {
  id: number;
  demandId: number;
  teacherId: number;
  introduction: string;
  quotedPrice: number;
  status: string;
  parentNote: string | null;
  createdAt: string | null;
  teacher: {
    id: number;
    name: string;
    avatar: string | null;
    city: string | null;
    profile: {
      education: string | null;
      degree: string | null;
      ratingAvg: number;
      totalOrders: number;
      verified: boolean;
      certificationStatus: string;
      skills: string;
    } | null;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审核", variant: "secondary" },
  accepted: { label: "已接受", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
};

export default function DemandApplications() {
  const [, params] = useRoute("/parent/demands/:id/applications");
  const demandId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const [rejectDialog, setRejectDialog] = useState<ApplicationWithTeacher | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: applications, isLoading } = useQuery<ApplicationWithTeacher[]>({
    queryKey: [`/api/demands/${demandId}/applications`],
    enabled: !!demandId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (appId: number) => {
      const res = await apiRequest("POST", `/api/demand-applications/${appId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/demands/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demands/application-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my"] });
      toast({ title: "已接受申请，订单已自动创建" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "操作失败", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ appId, reason }: { appId: number; reason: string }) => {
      await apiRequest("POST", `/api/demand-applications/${appId}/reject`, { reason: reason || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/demands/application-counts"] });
      setRejectDialog(null);
      setRejectReason("");
      toast({ title: "已拒绝该申请" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "操作失败", variant: "destructive" });
    },
  });

  const pendingApps = applications?.filter(a => a.status === "pending") || [];
  const otherApps = applications?.filter(a => a.status !== "pending") || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/parent/demands">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="btn-back-demands">
            <ChevronLeft size={16} /> 返回需求列表
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold">老师申请列表</h1>
        <p className="text-sm text-muted-foreground mt-1">
          共 {applications?.length || 0} 位老师申请，{pendingApps.length} 位待审核
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : !applications || applications.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="text-center py-16 text-muted-foreground">
            <p>暂无老师申请</p>
            <p className="text-xs mt-1">有老师申请后将在此处展示</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending applications */}
          {pendingApps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">待审核 ({pendingApps.length})</h2>
              {pendingApps.map((a) => (
                <ApplicationCard
                  key={a.id}
                  app={a}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  onAccept={() => acceptMutation.mutate(a.id)}
                  onReject={() => { setRejectDialog(a); setRejectReason(""); }}
                  acceptPending={acceptMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* Other applications */}
          {otherApps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">已处理 ({otherApps.length})</h2>
              {otherApps.map((a) => (
                <ApplicationCard
                  key={a.id}
                  app={a}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝申请</DialogTitle>
            <DialogDescription>
              拒绝 {rejectDialog?.teacher?.name} 的申请，可选填拒绝原因。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="拒绝原因（可选）"
            rows={3}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog && rejectMutation.mutate({ appId: rejectDialog.id, reason: rejectReason })}
              disabled={rejectMutation.isPending}
              data-testid="btn-confirm-reject-app"
            >
              {rejectMutation.isPending ? "处理中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationCard({
  app,
  expanded,
  onToggle,
  onAccept,
  onReject,
  acceptPending,
}: {
  app: ApplicationWithTeacher;
  expanded: boolean;
  onToggle: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  acceptPending?: boolean;
}) {
  const teacher = app.teacher;
  const profile = teacher?.profile;
  const skills: string[] = (() => { try { return JSON.parse(profile?.skills || "[]"); } catch { return []; } })();
  const config = statusConfig[app.status] || statusConfig.pending;
  const isPending = app.status === "pending";

  return (
    <Card
      className={`border-card-border cursor-pointer transition-colors ${isPending ? "hover:border-primary/30" : ""}`}
      onClick={onToggle}
      data-testid={`application-card-${app.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-11 h-11 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {teacher?.name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{teacher?.name || "未知老师"}</span>
              {profile?.verified && <CertificationStatusBadge status="certified" size="sm" />}
              <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {profile?.education && (
                <span className="flex items-center gap-1">
                  <GraduationCap size={12} />
                  {profile.education}{profile.degree ? ` · ${profile.degree}` : ""}
                </span>
              )}
              <span className="flex items-center gap-1 text-amber-500">
                <Star size={12} fill="currentColor" />
                {profile?.ratingAvg?.toFixed(1) || "暂无"}
              </span>
              <span>{profile?.totalOrders || 0}单</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-sm text-primary font-medium">
              <DollarSign size={13} />
              报价：¥{app.quotedPrice}/小时
            </div>

            {/* Expanded content */}
            {expanded && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-foreground whitespace-pre-wrap">{app.introduction}</p>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                  </div>
                )}
                {app.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    申请时间：{new Date(app.createdAt).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
            )}

            {/* Actions — only for pending */}
            {isPending && expanded && onAccept && onReject && (
              <div className="flex gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-1"
                  onClick={onAccept}
                  disabled={acceptPending}
                  data-testid={`btn-accept-app-${app.id}`}
                >
                  <CheckCircle2 size={14} />
                  {acceptPending ? "处理中..." : "接受"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 gap-1"
                  onClick={onReject}
                  data-testid={`btn-reject-app-${app.id}`}
                >
                  <XCircle size={14} />
                  拒绝
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
