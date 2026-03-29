import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
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

const SERVICE_TYPES = ["音乐陪伴", "体育培训", "科目辅导", "兴趣培养", "氛围陪伴"];
const TIME_OPTIONS = ["工作日上午", "工作日下午", "工作日晚上", "周六全天", "周日全天", "周末上午", "周末下午"];
const SHENZHEN_DISTRICTS = ["南山区", "福田区", "罗湖区", "宝安区", "龙岗区", "龙华区", "盐田区", "坪山区", "光明区", "大鹏新区"];

export default function TeacherProfile() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/teacher/profile"],
  });

  const [form, setForm] = useState({
    bio: "",
    education: "",
    major: "",
    degree: "本科",
    hourlyRateMin: "",
    hourlyRateMax: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [certMaterials, setCertMaterials] = useState<MaterialItem[]>([]);
  const [certNote, setCertNote] = useState("");

  const { data: certData } = useQuery<CertStatusResponse>({
    queryKey: ["/api/teacher/certifications/status"],
  });

  const certStatus = certData?.certificationStatus || "uncertified";
  const certIsPending = certStatus === "pending";
  const certIsCertified = certStatus === "certified";
  const certIsRejected = certStatus === "rejected";
  const certCanSubmit = certStatus === "uncertified" || certStatus === "rejected";
  const certRejectedNote = certData?.materials?.find((m) => m.status === "rejected" && m.adminNote)?.adminNote;

  const submitCertMutation = useMutation({
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
      setCertMaterials([]);
      setCertNote("");
      toast({ title: "提交成功，请等待管理员审核" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "提交失败", variant: "destructive" });
    },
  });

  const handleCertSubmit = () => {
    if (certMaterials.length === 0) {
      toast({ title: "请至少上传一项认证材料", variant: "destructive" });
      return;
    }
    submitCertMutation.mutate({ materials: certMaterials, note: certNote });
  };

  useEffect(() => {
    if (profile) {
      setForm({
        bio: profile.bio || "",
        education: profile.education || "",
        major: profile.major || "",
        degree: profile.degree || "本科",
        hourlyRateMin: profile.hourlyRateMin?.toString() || "",
        hourlyRateMax: profile.hourlyRateMax?.toString() || "",
      });
      try { setSkills(JSON.parse(profile.skills || "[]")); } catch {}
      try { setServiceTypes(JSON.parse(profile.serviceTypes || "[]")); } catch {}
      try { setServiceAreas(JSON.parse(profile.serviceAreas || "[]")); } catch {}
      try { setAvailableTimes(JSON.parse(profile.availableTimes || "[]")); } catch {}
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/teacher/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/profile"] });
      toast({ title: "资料已保存" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "保存失败", variant: "destructive" });
    },
  });

  const handleSave = () => {
    mutation.mutate({
      ...form,
      hourlyRateMin: form.hourlyRateMin ? parseInt(form.hourlyRateMin) : null,
      hourlyRateMax: form.hourlyRateMax ? parseInt(form.hourlyRateMax) : null,
      skills: JSON.stringify(skills),
      serviceTypes: JSON.stringify(serviceTypes),
      serviceAreas: JSON.stringify(serviceAreas),
      availableTimes: JSON.stringify(availableTimes),
    });
  };

  const addSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setNewSkill("");
    }
  };

  const toggleArea = (a: string) => {
    setServiceAreas((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const toggleServiceType = (t: string) => {
    setServiceTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const toggleTime = (t: string) => {
    setAvailableTimes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">我的资料</h1>
        <p className="text-sm text-muted-foreground mt-1">完善资料有助于匹配更多家长</p>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">基本信息</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>院校名称</Label>
              <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="如：北京大学" className="mt-1" data-testid="input-education" />
            </div>
            <div>
              <Label>专业</Label>
              <Input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} placeholder="如：音乐表演" className="mt-1" data-testid="input-major" />
            </div>
          </div>
          <div>
            <Label>学历</Label>
            <Select value={form.degree} onValueChange={(v) => setForm({ ...form, degree: v })}>
              <SelectTrigger className="mt-1" data-testid="select-degree">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="本科">本科</SelectItem>
                <SelectItem value="硕士">硕士</SelectItem>
                <SelectItem value="博士">博士</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>个人简介</Label>
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="介绍您的教育背景、教学经验和特色..." rows={4} className="mt-1" data-testid="input-bio" />
          </div>
        </CardContent>
      </Card>

      {/* 学历认证 */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">学历认证</CardTitle>
            <CertificationStatusBadge status={certStatus} size="md" />
          </div>
          <CardDescription>上传学历材料通过认证后，可获得「已认证」标识，有效提升接单率</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {certIsCertified && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                您的学历已通过认证！认证标识将展示在您的个人资料和列表卡片上，提升家长的信任度。
              </AlertDescription>
            </Alert>
          )}
          {certIsPending && (
            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                您的认证材料正在审核中，通常 1-3 个工作日内完成。审核结果将通过消息通知您。
              </AlertDescription>
            </Alert>
          )}
          {certIsRejected && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                您的认证材料未通过审核。
                {certRejectedNote && <span className="font-medium">原因：{certRejectedNote}</span>}
                <br />请修改材料后重新提交。
              </AlertDescription>
            </Alert>
          )}
          {certStatus === "uncertified" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                您尚未进行学历认证。请上传学生证（在校生）、学位证书（毕业生）或学信网截图。
              </AlertDescription>
            </Alert>
          )}

          {certData?.materials && certData.materials.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">已提交材料</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {certData.materials.map((m) => (
                  <div key={m.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30" data-testid={`submitted-material-${m.id}`}>
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                      <img src={m.imageUrl} alt={m.fileName || "认证材料"} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.fileName || "材料"}</p>
                      <p className="text-xs text-muted-foreground">{MATERIAL_TYPE_LABELS[m.materialType] || m.materialType}</p>
                      <CertificationStatusBadge status={m.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {certCanSubmit && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-medium">{certIsRejected ? "重新提交材料" : "上传认证材料"}</p>
              <CertificationUploadZone
                materials={certMaterials}
                onMaterialsChange={setCertMaterials}
                disabled={submitCertMutation.isPending}
              />
              <div>
                <label className="text-sm font-medium mb-1.5 block">补充说明（可选）</label>
                <Textarea
                  value={certNote}
                  onChange={(e) => setCertNote(e.target.value)}
                  placeholder="如有需要，可在此补充说明情况..."
                  rows={3}
                  disabled={submitCertMutation.isPending}
                  data-testid="input-cert-note"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCertSubmit}
                disabled={certMaterials.length === 0 || submitCertMutation.isPending}
                data-testid="btn-submit-certification"
              >
                <ShieldCheck size={16} className="mr-2" />
                {submitCertMutation.isPending ? "提交中..." : "提交认证申请"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">收费标准</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>最低时薪（元）</Label>
              <Input type="number" value={form.hourlyRateMin} onChange={(e) => setForm({ ...form, hourlyRateMin: e.target.value })} placeholder="如：100" className="mt-1" data-testid="input-rate-min" />
            </div>
            <div>
              <Label>最高时薪（元）</Label>
              <Input type="number" value={form.hourlyRateMax} onChange={(e) => setForm({ ...form, hourlyRateMax: e.target.value })} placeholder="如：300" className="mt-1" data-testid="input-rate-max" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">专业技能</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1 pr-1">
                {s}
                <button onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-destructive"><X size={12} /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="添加技能，如：钢琴" className="flex-1" data-testid="input-new-skill"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
            <Button type="button" variant="outline" size="sm" onClick={addSkill} data-testid="btn-add-skill">添加</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">服务类型</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => toggleServiceType(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${serviceTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary"}`}
                data-testid={`service-type-${t}`}>{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">服务区域（深圳）</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SHENZHEN_DISTRICTS.map((a) => (
              <button key={a} type="button" onClick={() => toggleArea(a)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${serviceAreas.includes(a) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary"}`}
                data-testid={`area-${a}`}>{a}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">可用时间</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((t) => (
              <button key={t} type="button" onClick={() => toggleTime(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${availableTimes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary"}`}
                data-testid={`avail-time-${t}`}>{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={mutation.isPending} data-testid="btn-save-profile">
        {mutation.isPending ? "保存中..." : "保存资料"}
      </Button>
    </div>
  );
}
