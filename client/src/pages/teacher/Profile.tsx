import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

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
