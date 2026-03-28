import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import CertificationStatusBadge from "@/components/CertificationStatusBadge";
import CertificationUploadZone, { type MaterialItem } from "@/components/CertificationUploadZone";

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

interface CertStatusResponse {
  certificationStatus: string;
  certifiedAt: string | null;
  materials: CertMaterial[];
}

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  student_card: "学生证",
  degree_cert: "学位证书",
  xuexin_screenshot: "学信网截图",
  other: "其他材料",
};

export default function TeacherCertification() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery<CertStatusResponse>({
    queryKey: ["/api/teacher/certifications/status"],
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { materials: MaterialItem[]; note: string }) => {
      const res = await apiRequest("POST", "/api/teacher/certifications/submit", {
        materials: payload.materials.map((m) => ({
          materialType: m.materialType,
          imageUrl: m.imageUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
        })),
        note: payload.note || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/certifications/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/profile"] });
      setMaterials([]);
      setNote("");
      toast({ title: "提交成功，请等待管理员审核" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "提交失败", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (materials.length === 0) {
      toast({ title: "请至少上传一项认证材料", variant: "destructive" });
      return;
    }
    submitMutation.mutate({ materials, note });
  };

  const status = data?.certificationStatus || "uncertified";
  const isPending = status === "pending";
  const isCertified = status === "certified";
  const isRejected = status === "rejected";
  const canSubmit = status === "uncertified" || status === "rejected";

  const rejectedNote = data?.materials?.find((m) => m.status === "rejected" && m.adminNote)?.adminNote;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">学历认证</h1>
        <p className="text-sm text-muted-foreground mt-1">
          提交学历材料进行认证，通过后将展示「已认证」标识
        </p>
      </div>

      {/* Status card */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">认证状态</CardTitle>
            <CertificationStatusBadge status={status} size="md" />
          </div>
        </CardHeader>
        <CardContent>
          {isCertified && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                您的学历已通过认证！认证标识将展示在您的个人资料和列表卡片上，提升家长的信任度。
              </AlertDescription>
            </Alert>
          )}
          {isPending && (
            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                您的认证材料正在审核中，通常 1-3 个工作日内完成。审核结果将通过消息通知您。
              </AlertDescription>
            </Alert>
          )}
          {isRejected && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                您的认证材料未通过审核。
                {rejectedNote && <span className="font-medium">原因：{rejectedNote}</span>}
                <br />请修改材料后重新提交。
              </AlertDescription>
            </Alert>
          )}
          {status === "uncertified" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                您尚未进行学历认证。上传学历材料通过认证后，可获得「已认证」标识，有效提升接单率。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Previously submitted materials */}
      {data?.materials && data.materials.length > 0 && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已提交材料</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.materials.map((m) => (
                <div
                  key={m.id}
                  className="flex gap-3 p-3 rounded-lg border bg-muted/30"
                  data-testid={`submitted-material-${m.id}`}
                >
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                    <img
                      src={m.imageUrl}
                      alt={m.fileName || "认证材料"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.fileName || "材料"}</p>
                    <p className="text-xs text-muted-foreground">
                      {MATERIAL_TYPE_LABELS[m.materialType] || m.materialType}
                    </p>
                    <CertificationStatusBadge status={m.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload form (only shown if can submit) */}
      {canSubmit && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isRejected ? "重新提交材料" : "上传认证材料"}
            </CardTitle>
            <CardDescription>
              请上传以下材料之一：学生证照片（在校生）、学位证书照片（毕业生）、学信网查询截图。至少上传 1 项。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CertificationUploadZone
              materials={materials}
              onMaterialsChange={setMaterials}
              disabled={submitMutation.isPending}
            />

            <div>
              <label className="text-sm font-medium mb-1.5 block">补充说明（可选）</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="如有需要，可在此补充说明情况..."
                rows={3}
                disabled={submitMutation.isPending}
                data-testid="input-cert-note"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={materials.length === 0 || submitMutation.isPending}
              data-testid="btn-submit-certification"
            >
              <ShieldCheck size={16} className="mr-2" />
              {submitMutation.isPending ? "提交中..." : "提交认证申请"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
