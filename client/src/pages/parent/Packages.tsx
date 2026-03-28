import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Check, Clock, Zap, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Package {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unlockCount: number | null;
  durationDays: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface Purchase {
  id: number;
  packageId: number;
  amount: number;
  unlockQuota: number | null;
  expiresAt: string | null;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

const packageIcons = [
  <Zap size={24} className="text-blue-500" />,
  <CreditCard size={24} className="text-purple-500" />,
  <Crown size={24} className="text-amber-500" />,
  <Crown size={24} className="text-rose-500" />,
];

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待确认", color: "default" },
  confirmed: { label: "已确认", color: "secondary" },
  expired: { label: "已过期", color: "outline" },
  refunded: { label: "已退款", color: "destructive" },
};

export default function Packages() {
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [purchaseId, setPurchaseId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const { data: purchases } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases/my"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const res = await apiRequest("POST", "/api/purchases", { packageId });
      return res.json();
    },
    onSuccess: (data) => {
      setPurchaseId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unlock/status"] });
    },
    onError: (err: any) => {
      toast({ title: err.message || "购买失败", variant: "destructive" });
      setShowPayDialog(false);
    },
  });

  const handleBuy = (pkg: Package) => {
    setSelectedPkg(pkg);
    setShowPayDialog(true);
    purchaseMutation.mutate(pkg.id);
  };

  const pendingPurchases = purchases?.filter(p => p.status === "pending") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="page-title-packages">解锁套餐</h1>
        <p className="text-sm text-muted-foreground mt-1">购买套餐，解锁老师完整资料</p>
      </div>

      {/* Package grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages?.map((pkg, idx) => (
            <Card
              key={pkg.id}
              className={`border-card-border relative overflow-hidden ${idx === 2 ? "ring-2 ring-primary" : ""}`}
              data-testid={`package-card-${pkg.id}`}
            >
              {idx === 2 && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-bl-lg">
                  推荐
                </div>
              )}
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  {packageIcons[idx] || packageIcons[0]}
                  <div>
                    <h3 className="font-bold text-foreground">{pkg.name}</h3>
                    <p className="text-xs text-muted-foreground">{pkg.description}</p>
                  </div>
                </div>

                <div className="my-4">
                  <span className="text-3xl font-bold text-primary">¥{pkg.price}</span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                  {pkg.unlockCount ? (
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      可解锁 {pkg.unlockCount} 位老师
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      无限解锁老师资料
                    </div>
                  )}
                  {pkg.durationDays ? (
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      有效期 {pkg.durationDays} 天
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      永久有效
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  variant={idx === 2 ? "default" : "outline"}
                  onClick={() => handleBuy(pkg)}
                  disabled={purchaseMutation.isPending}
                  data-testid={`btn-buy-package-${pkg.id}`}
                >
                  立即购买
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* My purchases */}
      {purchases && purchases.length > 0 && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">我的购买记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  data-testid={`purchase-row-${p.id}`}
                >
                  <div>
                    <span className="text-sm font-medium">订单 #{p.id}</span>
                    <span className="text-sm text-primary font-medium ml-2">¥{p.amount}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString("zh-CN") : ""}
                    </div>
                  </div>
                  <Badge variant={statusMap[p.status]?.color as any || "default"}>
                    {statusMap[p.status]?.label || p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending notice */}
      {pendingPurchases.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400" data-testid="pending-notice">
              您有 {pendingPurchases.length} 笔订单待管理员确认，转账后请耐心等待。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md" data-testid="pay-dialog">
          <DialogHeader>
            <DialogTitle>扫码支付</DialogTitle>
            <DialogDescription>
              {selectedPkg?.name} · <span className="text-primary font-semibold">¥{selectedPkg?.price}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedPkg && (
            <div className="space-y-4">
              <Tabs defaultValue="wechat" className="w-full">
                <TabsList className="grid w-full grid-cols-2" data-testid="pay-tabs">
                  <TabsTrigger value="wechat" className="gap-1.5" data-testid="tab-wechat">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#07C160"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.68 4.025c-2.203 0-4.446.818-5.884 2.333-1.431 1.51-1.96 3.474-1.278 5.234.669 1.744 2.489 2.97 4.59 3.298.43.067.856.1 1.282.1.94 0 1.852-.18 2.694-.524a.57.57 0 0 1 .468.05l1.272.756a.222.222 0 0 0 .108.036c.107 0 .194-.088.194-.196a.376.376 0 0 0-.032-.143l-.26-.978a.393.393 0 0 1 .142-.442C23.063 18.691 24 17.008 24 15.17c0-2.86-2.735-5.154-6.722-5.154zm-2.7 2.791c.456 0 .826.376.826.838a.832.832 0 0 1-.826.837.832.832 0 0 1-.826-.837c0-.462.37-.838.826-.838zm4.647 0c.456 0 .826.376.826.838a.832.832 0 0 1-.826.837.832.832 0 0 1-.826-.837c0-.462.37-.838.826-.838z"/></svg>
                    微信支付
                  </TabsTrigger>
                  <TabsTrigger value="alipay" className="gap-1.5" data-testid="tab-alipay">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#1677FF"><path d="M21.422 15.358c-1.395-.676-5.152-2.268-6.22-2.752-.148-.066-.3-.13-.452-.19a19.1 19.1 0 0 0 1.677-4.034h-3.88V6.908h4.81V5.94h-4.81V3.202h-1.623s-.143.012-.143.161V5.94H6.052v.968h4.73v1.474H7.152v.928h7.863a15.84 15.84 0 0 1-1.224 2.97 24.17 24.17 0 0 0-3.1-1.06C7.647 10.307 4.83 11.18 4.038 13.2c-.555 1.418.1 3.486 3.138 3.486 1.864 0 3.674-1.11 5.184-2.878.86.45 3.128 1.59 4.388 2.322a.18.18 0 0 0 .044.015V2.28A2.28 2.28 0 0 0 14.512 0H2.28A2.28 2.28 0 0 0 0 2.28v19.44A2.28 2.28 0 0 0 2.28 24h12.232c.4 0 .773-.108 1.098-.292-.002 0-.003 0-.005-.002 2.998-1.584 5.187-4.382 5.817-7.348zM7.27 15.562c-2.7 0-2.82-2.076-2.025-2.913.795-.838 2.07-1.284 3.615-.78 1.044.34 2.107.855 3.096 1.42-1.254 1.467-2.886 2.273-4.686 2.273z"/></svg>
                    支付宝
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="wechat" className="mt-4">
                  <div className="flex justify-center">
                    <img
                      src="/pay-wechat.png"
                      alt="微信收款码"
                      className="w-64 h-auto rounded-lg border"
                      data-testid="qr-wechat"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="alipay" className="mt-4">
                  <div className="flex justify-center">
                    <img
                      src="/pay-alipay.png"
                      alt="支付宝收款码"
                      className="w-64 h-auto rounded-lg border"
                      data-testid="qr-alipay"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="p-3 bg-muted/40 rounded-lg text-center space-y-1">
                <p className="text-xs text-muted-foreground">转账备注请填写</p>
                <p className="text-base font-mono font-bold text-primary" data-testid="pay-remark">ZHQ-{purchaseId || "..."}</p>
                <p className="text-xs text-muted-foreground">管理员确认收款后，套餐自动生效</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Check size={16} className="text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  订单已创建 (#{purchaseId})，请尽快完成转账
                </span>
              </div>

              <Button
                className="w-full"
                onClick={() => setShowPayDialog(false)}
                data-testid="btn-close-pay-dialog"
              >
                我已完成转账，等待确认
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
