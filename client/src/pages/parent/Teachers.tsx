import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Star, MapPin, DollarSign, GraduationCap, Lock, Unlock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CertificationStatusBadge from "@/components/CertificationStatusBadge";

interface TeacherWithProfile {
  id: number;
  name: string;
  city?: string;
  avatar?: string | null;
  phone?: string | null;
  isUnlocked: boolean;
  profile: {
    education?: string;
    major?: string | null;
    degree?: string;
    skills: string;
    serviceTypes: string;
    hourlyRateMin?: number;
    hourlyRateMax?: number;
    ratingAvg: number;
    totalOrders: number;
    verified: boolean;
    bio?: string | null;
  } | null;
}

interface UnlockStatus {
  hasActivePackage: boolean;
  remainingUnlocks: number | null;
  expiresAt: string | null;
  totalUnlocked: number;
}

export default function BrowseTeachers() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { data: teachers, isLoading } = useQuery<TeacherWithProfile[]>({
    queryKey: ["/api/teachers"],
  });

  const { data: unlockStatus } = useQuery<UnlockStatus>({
    queryKey: ["/api/unlock/status"],
  });

  const unlockMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      const res = await apiRequest("POST", `/api/unlock/${teacherId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unlock/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unlock/records"] });
      toast({ title: "解锁成功！" });
    },
    onError: (err: any) => {
      if (err.message?.includes("没有有效套餐")) {
        toast({ title: "请先购买解锁套餐", description: "前往「解锁套餐」页面购买", variant: "destructive" });
      } else {
        toast({ title: err.message || "解锁失败", variant: "destructive" });
      }
    },
  });

  const filtered = teachers?.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const skills = (() => { try { return JSON.parse(t.profile?.skills || "[]").join(" "); } catch { return ""; } })();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.profile?.education || "").toLowerCase().includes(q) ||
      skills.toLowerCase().includes(q) ||
      (t.city || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="page-title-teachers">浏览老师</h1>
        <p className="text-sm text-muted-foreground mt-1">寻找最适合您孩子的老师</p>
      </div>

      {/* Unlock status bar */}
      {unlockStatus && (
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg" data-testid="unlock-status-bar">
          <Lock size={16} className="text-primary" />
          {unlockStatus.hasActivePackage ? (
            <span className="text-sm">
              剩余解锁次数：
              <span className="font-semibold text-primary">
                {unlockStatus.remainingUnlocks === null ? "无限" : unlockStatus.remainingUnlocks}
              </span>
              {unlockStatus.expiresAt && (
                <span className="text-muted-foreground ml-2">
                  · 有效期至 {new Date(unlockStatus.expiresAt).toLocaleDateString("zh-CN")}
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              暂无有效套餐，
              <Link href="/parent/packages">
                <a className="text-primary hover:underline" data-testid="link-buy-package">请先购买套餐</a>
              </Link>
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="搜索老师技能、学校、区域..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-teachers"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-52 w-full" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p>没有找到匹配的老师</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((t) => {
            const skills: string[] = (() => { try { return JSON.parse(t.profile?.skills || "[]"); } catch { return []; } })();
            const isUnlocked = t.isUnlocked;
            return (
              <Card
                key={t.id}
                className={`border-card-border transition-colors ${isUnlocked ? "hover:border-green-400" : "hover:border-primary/40"}`}
                data-testid={`teacher-card-${t.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {isUnlocked ? (
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                          {t.name[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-12 h-12 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <Lock size={18} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{t.name}</span>
                        {isUnlocked && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600 border-green-300" data-testid={`badge-unlocked-${t.id}`}>
                            <Unlock size={10} className="mr-0.5" />
                            已解锁
                          </Badge>
                        )}
                        {t.profile?.verified && (
                          <CertificationStatusBadge status="certified" size="sm" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                        <GraduationCap size={13} />
                        <span className="truncate">
                          {t.profile?.education || "未填写"}
                          {t.profile?.degree && ` · ${t.profile.degree}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {skills.slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {skills.length > 4 && (
                      <Badge variant="outline" className="text-xs">+{skills.length - 4}</Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star size={13} fill="currentColor" />
                      <span className="font-medium">{t.profile?.ratingAvg?.toFixed(1) || "暂无"}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {t.profile?.totalOrders || 0} 单
                    </span>
                    {t.city && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin size={12} />
                        {t.city}
                      </span>
                    )}
                  </div>

                  {/* Rate */}
                  {(t.profile?.hourlyRateMin || t.profile?.hourlyRateMax) && (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <DollarSign size={13} className="text-primary" />
                      <span className="font-medium text-primary">
                        ¥{t.profile.hourlyRateMin}-{t.profile.hourlyRateMax}/小时
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  {isUnlocked ? (
                    <Link href={`/parent/teachers/${t.id}`}>
                      <Button
                        className="w-full mt-3"
                        variant="outline"
                        size="sm"
                        data-testid={`btn-view-teacher-${t.id}`}
                      >
                        查看详情
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <Button
                        className="flex-1 gap-1"
                        size="sm"
                        onClick={() => unlockMutation.mutate(t.id)}
                        disabled={unlockMutation.isPending}
                        data-testid={`btn-unlock-teacher-${t.id}`}
                      >
                        <Lock size={13} />
                        解锁查看
                      </Button>
                      <Link href={`/parent/teachers/${t.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`btn-preview-teacher-${t.id}`}
                        >
                          预览
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
