import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, GraduationCap, DollarSign, Lock, Unlock, CreditCard, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import CertificationStatusBadge from "@/components/CertificationStatusBadge";

export default function TeacherDetail() {
  const [, params] = useRoute("/parent/teachers/:id");
  const teacherId = parseInt(params?.id || "0");
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: teacher, isLoading } = useQuery<any>({
    queryKey: ["/api/teachers", teacherId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teachers/${teacherId}`);
      return res.json();
    },
    enabled: !!teacherId,
  });

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/reviews", { teacherId }],
  });

  const { data: myDemands } = useQuery<any[]>({
    queryKey: ["/api/demands/my"],
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/unlock/${teacherId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unlock/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unlock/records"] });
      toast({ title: "解锁成功！可以查看老师完整资料了" });
    },
    onError: (err: any) => {
      if (err.message?.includes("没有有效套餐")) {
        toast({ title: "请先购买解锁套餐", description: "前往「解锁套餐」页面购买", variant: "destructive" });
      } else {
        toast({ title: err.message || "解锁失败", variant: "destructive" });
      }
    },
  });

  const orderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my"] });
      toast({ title: "订单已创建！请等待老师确认" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "下单失败", variant: "destructive" });
    },
  });

  const handleOrder = () => {
    const openDemand = myDemands?.find((d) => d.status === "open");
    if (!openDemand) {
      toast({ title: "请先发布需求", variant: "destructive" });
      return;
    }
    orderMutation.mutate({
      demandId: openDemand.id,
      teacherId,
      serviceDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      durationHours: 2,
      totalAmount: teacher?.profile?.hourlyRateMin ? teacher.profile.hourlyRateMin * 2 : 0,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!teacher) {
    return <div className="text-center py-16 text-muted-foreground">老师不存在</div>;
  }

  const isUnlocked = teacher.isUnlocked === true;
  const skills: string[] = (() => { try { return JSON.parse(teacher.profile?.skills || "[]"); } catch { return []; } })();
  const serviceTypes: string[] = (() => { try { return JSON.parse(teacher.profile?.serviceTypes || "[]"); } catch { return []; } })();
  const serviceAreas: string[] = (() => { try { return JSON.parse(teacher.profile?.serviceAreas || "[]"); } catch { return []; } })();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header Card */}
      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {isUnlocked ? (
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-xl bg-primary/15 text-primary font-bold">
                  {teacher.name[0]}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock size={24} className="text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-foreground" data-testid="teacher-name">{teacher.name}</h1>
                {isUnlocked && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-0.5">
                    <Unlock size={10} />
                    已解锁
                  </Badge>
                )}
                {teacher.profile?.verified && (
                  <CertificationStatusBadge status="certified" size="sm" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <GraduationCap size={14} />
                {teacher.profile?.education || "未填写院校"}
                {isUnlocked && teacher.profile?.major && ` · ${teacher.profile.major}`}
                {teacher.profile?.degree && ` · ${teacher.profile.degree}`}
              </div>
              {teacher.city && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <MapPin size={13} />
                  {teacher.city}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-amber-500">
                  <Star size={14} fill="currentColor" />
                  <span className="font-semibold">{teacher.profile?.ratingAvg?.toFixed(1) || "暂无"}</span>
                </span>
                <span className="text-sm text-muted-foreground">{teacher.profile?.totalOrders || 0} 次服务</span>
                {(teacher.profile?.hourlyRateMin || teacher.profile?.hourlyRateMax) && (
                  <span className="flex items-center gap-1 text-primary font-medium text-sm">
                    <DollarSign size={13} />
                    ¥{teacher.profile.hourlyRateMin}-{teacher.profile.hourlyRateMax}/小时
                  </span>
                )}
              </div>
            </div>
          </div>

          {isUnlocked && teacher.profile?.bio && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed" data-testid="teacher-bio">{teacher.profile.bio}</p>
          )}

          {/* Contact info - only when unlocked */}
          {isUnlocked && teacher.phone && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="teacher-contact">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">联系方式：{teacher.phone}</p>
            </div>
          )}

          {/* Send message button - only when unlocked */}
          {isUnlocked && (
            <ChatButton teacherId={teacherId} />
          )}
        </CardContent>
      </Card>

      {/* Unlock CTA for non-unlocked */}
      {!isUnlocked && (
        <Card className="border-primary/30 bg-primary/5" data-testid="unlock-cta">
          <CardContent className="p-6 text-center">
            <Lock size={36} className="mx-auto mb-3 text-primary" />
            <h2 className="text-lg font-bold mb-2">解锁完整资料</h2>
            <p className="text-sm text-muted-foreground mb-4">
              解锁后可查看老师的完整姓名、联系方式、个人简介等详细信息
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => unlockMutation.mutate()}
                disabled={unlockMutation.isPending}
                className="gap-1"
                data-testid="btn-unlock-teacher"
              >
                <Unlock size={16} />
                {unlockMutation.isPending ? "解锁中..." : "立即解锁"}
              </Button>
              <Link href="/parent/packages">
                <Button variant="outline" className="gap-1" data-testid="btn-go-packages">
                  <CreditCard size={16} />
                  购买套餐
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">技能专长</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <Badge key={s} variant="secondary">{s}</Badge>
            ))}
            {skills.length === 0 && <span className="text-sm text-muted-foreground">暂未填写</span>}
          </div>
          {serviceTypes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">服务类型</p>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.map((s) => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          {serviceAreas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">服务区域</p>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((a) => (
                  <span key={a} className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin size={12} /> {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">学员评价 ({reviews?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!reviews || reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评价</p>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="p-3 bg-muted/30 rounded-lg" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          size={13}
                          className={i <= r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("zh-CN") : ""}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{r.comment || "无评论"}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action - only when unlocked */}
      {isUnlocked && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleOrder}
          disabled={orderMutation.isPending}
          data-testid="btn-book-teacher"
        >
          {orderMutation.isPending ? "提交中..." : "立即预约"}
        </Button>
      )}
    </div>
  );
}

function ChatButton({ teacherId }: { teacherId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleChat = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/conversations", { teacherId });
      const conv = await res.json();
      navigate(`/parent/messages/${conv.id}`);
    } catch (err: any) {
      toast({ title: err.message || "无法发起对话", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Button
      className="w-full mt-3 gap-2"
      variant="outline"
      onClick={handleChat}
      disabled={loading}
      data-testid="btn-send-message"
    >
      <MessageCircle size={16} />
      {loading ? "正在进入..." : "发消息"}
    </Button>
  );
}
