import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const SERVICE_CATEGORIES = ["音乐陪伴", "体育培训", "科目辅导", "兴趣培养", "氛围陪伴", "其他"];
const SERVICE_TYPES = [
  { value: "home", label: "上门服务" },
  { value: "center", label: "机构中心" },
  { value: "online", label: "线上授课" },
];
const TIME_OPTIONS = ["工作日上午", "工作日下午", "工作日晚上", "周六全天", "周日全天", "周末上午", "周末下午"];
const SHENZHEN_DISTRICTS = ["南山区", "福田区", "罗湖区", "宝安区", "龙岗区", "龙华区", "盐田区", "坪山区", "光明区", "大鹏新区"];

export default function PostDemand() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    childAge: "",
    childGender: "男",
    serviceCategory: "",
    specificService: "",
    serviceType: "home",
    location: "",
    budgetMin: "",
    budgetMax: "",
    specialRequirements: "",
  });
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/demands", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demands/my"] });
      toast({ title: "需求发布成功！" });
      navigate("/parent/demands");
    },
    onError: (err: any) => {
      toast({ title: err.message || "发布失败", variant: "destructive" });
    },
  });

  const toggleTime = (t: string) => {
    setSelectedTimes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.childAge || !form.serviceCategory || !form.serviceType) {
      toast({ title: "请填写必要信息", variant: "destructive" });
      return;
    }
    mutation.mutate({
      ...form,
      childAge: parseInt(form.childAge),
      budgetMin: form.budgetMin ? parseInt(form.budgetMin) : null,
      budgetMax: form.budgetMax ? parseInt(form.budgetMax) : null,
      preferredTime: JSON.stringify(selectedTimes),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">发布新需求</h1>
        <p className="text-sm text-muted-foreground mt-1">填写需求信息，快速匹配合适的老师</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">孩子信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="child-age">孩子年龄 *</Label>
                <Input
                  id="child-age"
                  type="number"
                  min={1}
                  max={18}
                  placeholder="年龄（1-18岁）"
                  value={form.childAge}
                  onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                  data-testid="input-child-age"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>孩子性别</Label>
                <Select value={form.childGender} onValueChange={(v) => setForm({ ...form, childGender: v })}>
                  <SelectTrigger className="mt-1" data-testid="select-child-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">服务需求</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>服务类别 *</Label>
                <Select
                  value={form.serviceCategory}
                  onValueChange={(v) => setForm({ ...form, serviceCategory: v })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-service-category">
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="specific-service">具体科目 / 项目</Label>
                <Input
                  id="specific-service"
                  placeholder="如：钢琴、篮球、数学"
                  value={form.specificService}
                  onChange={(e) => setForm({ ...form, specificService: e.target.value })}
                  data-testid="input-specific-service"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>服务方式 *</Label>
              <Select value={form.serviceType} onValueChange={(v) => setForm({ ...form, serviceType: v })}>
                <SelectTrigger className="mt-1" data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>服务区域</Label>
              <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                <SelectTrigger className="mt-1" data-testid="select-location">
                  <SelectValue placeholder="请选择服务区域" />
                </SelectTrigger>
                <SelectContent>
                  {SHENZHEN_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={`深圳市${d}`}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>可用时间（可多选）</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTime(t)}
                    data-testid={`time-${t}`}
                    className={`
                      px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer
                      ${selectedTimes.includes(t)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary"
                      }
                    `}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget-min">预算下限（元/小时）</Label>
                <Input
                  id="budget-min"
                  type="number"
                  placeholder="如：100"
                  value={form.budgetMin}
                  onChange={(e) => setForm({ ...form, budgetMin: e.target.value })}
                  data-testid="input-budget-min"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="budget-max">预算上限（元/小时）</Label>
                <Input
                  id="budget-max"
                  type="number"
                  placeholder="如：300"
                  value={form.budgetMax}
                  onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                  data-testid="input-budget-max"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="requirements">特殊要求</Label>
              <Textarea
                id="requirements"
                placeholder="对老师有哪些要求？孩子有什么特点需要老师知道？"
                value={form.specialRequirements}
                onChange={(e) => setForm({ ...form, specialRequirements: e.target.value })}
                data-testid="input-requirements"
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-4">
          <Button
            type="submit"
            className="flex-1"
            disabled={mutation.isPending}
            data-testid="btn-submit-demand"
          >
            {mutation.isPending ? "发布中..." : "发布需求"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/parent/demands")}
            data-testid="btn-cancel"
          >
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
