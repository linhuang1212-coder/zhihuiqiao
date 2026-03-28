import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, DollarSign, Clock, Zap, Users, Filter, CheckCircle2, XCircle, Send } from "lucide-react";

interface HallDemand {
  id: number;
  childAge: number;
  childGender: string | null;
  serviceCategory: string;
  specificService: string | null;
  serviceType: string;
  location: string | null;
  preferredTime: string;
  budgetMin: number | null;
  budgetMax: number | null;
  specialRequirements: string | null;
  createdAt: string | null;
  applicationCount: number;
  myApplicationStatus: string | null;
  myApplicationId: number | null;
}

const SERVICE_CATEGORIES = ["全部", "音乐陪伴", "体育培训", "科目辅导", "兴趣培养", "氛围陪伴", "其他"];
const SHENZHEN_DISTRICTS = ["全部", "南山区", "福田区", "罗湖区", "宝安区", "龙岗区", "龙华区", "盐田区", "坪山区", "光明区", "大鹏新区"];
const serviceTypeMap: Record<string, string> = {
  home: "上门服务", center: "机构中心", online: "线上授课",
};

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "已申请", variant: "secondary" },
  accepted: { label: "已接受", variant: "default" },
  rejected: { label: "未通过", variant: "destructive" },
  withdrawn: { label: "已撤回", variant: "outline" },
};

export default function DemandHall() {
  const { toast } = useToast();
  const [category, setCategory] = useState("全部");
  const [districtFilter, setDistrictFilter] = useState("全部");
  const [applyDemand, setApplyDemand] = useState<HallDemand | null>(null);
  const [introduction, setIntroduction] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");

  const queryParams: Record<string, string> = {};
  if (category !== "全部") queryParams.category = category;
  if (districtFilter !== "全部") queryParams.city = `深圳市${districtFilter}`;

  const { data: demands, isLoading } = useQuery<HallDemand[]>({
    queryKey: ["/api/demand-hall", queryParams],
  });

  const applyMutation = useMutation({
    mutationFn: async ({ demandId, introduction, quotedPrice }: { demandId: number; introduction: string; quotedPrice: number }) => {
      const res = await apiRequest("POST", `/api/demand-hall/${demandId}/apply`, { introduction, quotedPrice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-hall"] });
      setApplyDemand(null);
      setIntroduction("");
      setQuotedPrice("");
      toast({ title: "申请已提交，等待家长审核" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "申请失败", variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (appId: number) => {
      await apiRequest("DELETE", `/api/demand-applications/${appId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-hall"] });
      toast({ title: "已撤回申请" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "撤回失败", variant: "destructive" });
    },
  });

  const handleApply = () => {
    if (!applyDemand) return;
    const price = parseInt(quotedPrice);
    if (!introduction.trim() || introduction.length > 500) {
      toast({ title: "自我介绍需在1-500字之间", variant: "destructive" });
      return;
    }
    if (!price || price <= 0) {
      toast({ title: "请填写有效报价", variant: "destructive" });
      return;
    }
    applyMutation.mutate({ demandId: applyDemand.id, introduction: introduction.trim(), quotedPrice: price });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">需求大厅</h1>
        <p className="text-sm text-muted-foreground mt-1">浏览家长发布的需求，主动申请接单</p>
      </div>

      {/* Filters */}
      <Card className="border-card-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
            <Filter size={14} />
            筛选条件
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-40">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="filter-category" className="h-9">
                  <SelectValue placeholder="服务类别" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger data-testid="filter-district" className="h-9">
                  <SelectValue placeholder="区域筛选" />
                </SelectTrigger>
                <SelectContent>
                  {SHENZHEN_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demand list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !demands || demands.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="text-center py-16 text-muted-foreground">
            <p>暂无符合条件的需求</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {demands.map((d) => {
            const times: string[] = (() => { try { return JSON.parse(d.preferredTime || "[]"); } catch { return []; } })();
            const hasApplied = !!d.myApplicationStatus;
            const badge = d.myApplicationStatus ? statusBadge[d.myApplicationStatus] : null;
            return (
              <Card
                key={d.id}
                className={`border-card-border transition-colors ${hasApplied ? "" : "hover:border-primary/30"}`}
                data-testid={`hall-demand-${d.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{d.serviceCategory}</span>
                        {d.specificService && <Badge variant="outline" className="text-xs">{d.specificService}</Badge>}
                        <Badge variant="secondary" className="text-xs">{serviceTypeMap[d.serviceType] || d.serviceType}</Badge>
                        {badge && (
                          <Badge variant={badge.variant} className="text-xs gap-1">
                            {d.myApplicationStatus === "accepted" && <CheckCircle2 size={10} />}
                            {d.myApplicationStatus === "rejected" && <XCircle size={10} />}
                            {badge.label}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span>孩子{d.childAge}岁 {d.childGender || ""}</span>
                        {d.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {d.location}
                          </span>
                        )}
                        {(d.budgetMin || d.budgetMax) && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={12} />
                            ¥{d.budgetMin || 0}-{d.budgetMax || "不限"}/小时
                          </span>
                        )}
                        {times.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {times.slice(0, 2).join("、")}
                          </span>
                        )}
                      </div>
                      {d.specialRequirements && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{d.specialRequirements}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users size={11} />
                        {d.applicationCount} 位老师已申请
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {!hasApplied ? (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setApplyDemand(d);
                            setIntroduction("");
                            setQuotedPrice(d.budgetMin?.toString() || "");
                          }}
                          data-testid={`btn-apply-${d.id}`}
                        >
                          <Send size={14} />
                          申请接单
                        </Button>
                      ) : d.myApplicationStatus === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground"
                          onClick={() => d.myApplicationId && withdrawMutation.mutate(d.myApplicationId)}
                          disabled={withdrawMutation.isPending}
                          data-testid={`btn-withdraw-${d.id}`}
                        >
                          撤回申请
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply modal */}
      <Dialog open={!!applyDemand} onOpenChange={(open) => !open && setApplyDemand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申请接单</DialogTitle>
            <DialogDescription>
              {applyDemand && `${applyDemand.serviceCategory}${applyDemand.specificService ? ` · ${applyDemand.specificService}` : ""}`}
              {applyDemand?.budgetMin || applyDemand?.budgetMax ? ` · 预算 ¥${applyDemand.budgetMin || 0}-${applyDemand.budgetMax || "不限"}/小时` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>自我介绍 <span className="text-xs text-muted-foreground">（针对该需求说明您的优势，1-500字）</span></Label>
              <Textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="介绍您在该领域的经验、教学方法和特色..."
                rows={5}
                className="mt-1"
                data-testid="input-introduction"
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{introduction.length}/500</p>
            </div>
            <div>
              <Label>报价（元/小时）</Label>
              <Input
                type="number"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
                placeholder="如：150"
                className="mt-1"
                data-testid="input-quoted-price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDemand(null)}>取消</Button>
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending}
              data-testid="btn-confirm-apply"
            >
              <Zap size={14} className="mr-1" />
              {applyMutation.isPending ? "提交中..." : "提交申请"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
