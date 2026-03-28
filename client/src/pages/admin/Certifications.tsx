import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ShieldCheck,
  ShieldX,
  GraduationCap,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
} from "lucide-react";
import CertificationStatusBadge from "@/components/CertificationStatusBadge";

interface CertMaterial {
  id: number;
  teacherId: number;
  materialType: string;
  imageUrl: string;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  adminNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

interface CertGroup {
  teacherId: number;
  teacherName: string;
  education: string;
  major: string;
  degree: string;
  certificationStatus: string;
  materials: CertMaterial[];
}

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  student_card: "学生证",
  degree_cert: "学位证书",
  xuexin_screenshot: "学信网截图",
  other: "其他材料",
};

export default function AdminCertifications() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [selectedGroup, setSelectedGroup] = useState<CertGroup | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: certGroups, isLoading } = useQuery<CertGroup[]>({
    queryKey: ["/api/admin/certifications", { status: tab === "all" ? "" : tab }],
  });

  const approveMutation = useMutation({
    mutationFn: async (certId: number) => {
      const res = await apiRequest("POST", `/api/admin/certifications/${certId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/certifications"] });
      setSelectedGroup(null);
      toast({ title: "认证已通过" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "操作失败", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ certId, reason }: { certId: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/certifications/${certId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/certifications"] });
      setSelectedGroup(null);
      setRejectDialogOpen(false);
      setRejectReason("");
      toast({ title: "已拒绝认证" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "操作失败", variant: "destructive" });
    },
  });

  const handleApprove = (group: CertGroup) => {
    const pendingCert = group.materials.find((m) => m.status === "pending");
    if (pendingCert) approveMutation.mutate(pendingCert.id);
  };

  const handleRejectConfirm = () => {
    if (!selectedGroup || !rejectReason.trim()) {
      toast({ title: "请填写拒绝原因", variant: "destructive" });
      return;
    }
    const pendingCert = selectedGroup.materials.find((m) => m.status === "pending");
    if (pendingCert) rejectMutation.mutate({ certId: pendingCert.id, reason: rejectReason });
  };

  const filteredGroups = certGroups || [];

  // Detail view
  if (selectedGroup) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button
          variant="ghost"
          className="gap-1"
          onClick={() => setSelectedGroup(null)}
          data-testid="btn-back-to-list"
        >
          <ChevronLeft size={16} />
          返回列表
        </Button>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {selectedGroup.teacherName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{selectedGroup.teacherName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedGroup.education} · {selectedGroup.major} · {selectedGroup.degree}
                  </p>
                </div>
              </div>
              <CertificationStatusBadge status={selectedGroup.certificationStatus} size="md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="text-sm font-medium">认证材料</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedGroup.materials.map((m) => (
                <div
                  key={m.id}
                  className="border rounded-lg overflow-hidden bg-muted/20"
                  data-testid={`review-material-${m.id}`}
                >
                  <div
                    className="aspect-[4/3] cursor-pointer relative group"
                    onClick={() => setPreviewImage(m.imageUrl)}
                  >
                    <img
                      src={m.imageUrl}
                      alt={m.fileName || "认证材料"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye
                        size={24}
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium">
                      {MATERIAL_TYPE_LABELS[m.materialType] || m.materialType}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.fileName || "材料"}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedGroup.certificationStatus === "pending" && (
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedGroup)}
                  disabled={approveMutation.isPending}
                  data-testid="btn-approve-cert"
                >
                  <CheckCircle2 size={16} className="mr-2" />
                  {approveMutation.isPending ? "处理中..." : "通过认证"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }}
                  disabled={rejectMutation.isPending}
                  data-testid="btn-reject-cert"
                >
                  <XCircle size={16} className="mr-2" />
                  拒绝
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image preview dialog */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>材料预览</DialogTitle>
            </DialogHeader>
            {previewImage && (
              <img
                src={previewImage}
                alt="材料大图"
                className="w-full h-auto rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Reject reason dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>拒绝认证</DialogTitle>
              <DialogDescription>
                请填写拒绝原因，该信息将通知老师，帮助其改进材料。
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请说明拒绝原因，如：照片不清晰、信息不完整..."
              rows={4}
              data-testid="input-reject-reason"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                data-testid="btn-confirm-reject"
              >
                {rejectMutation.isPending ? "处理中..." : "确认拒绝"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">学历认证审核</h1>
        <p className="text-sm text-muted-foreground mt-1">审核老师提交的学历认证材料</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="cert-tabs">
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock size={14} className="mr-1" />
            待审核
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            <ShieldCheck size={14} className="mr-1" />
            已通过
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            <ShieldX size={14} className="mr-1" />
            已拒绝
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <Card className="border-card-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
                <p>暂无{tab === "pending" ? "待审核" : tab === "approved" ? "已通过" : "已拒绝"}的认证申请</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => (
                <Card
                  key={group.teacherId}
                  className="border-card-border hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => setSelectedGroup(group)}
                  data-testid={`cert-group-${group.teacherId}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {group.teacherName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{group.teacherName}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.education} · {group.major} · {group.degree}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {group.materials.length} 份材料
                        </Badge>
                        <CertificationStatusBadge status={group.certificationStatus} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
