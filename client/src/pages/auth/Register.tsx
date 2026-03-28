import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    city: "",
    role: "parent",
  });

  const handleChange = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) {
      toast({ title: "请填写必要信息", variant: "destructive" });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: "两次密码不一致", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        username: form.username,
        password: form.password,
        name: form.name,
        phone: form.phone,
        city: form.city,
        role: form.role,
      });
      const user = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: `注册成功，欢迎 ${user.name}！` });
      if (user.role === "teacher") window.location.hash = "/teacher";
      else window.location.hash = "/parent";
    } catch (err: any) {
      toast({ title: err.message || "注册失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">智慧桥</h1>
          <p className="text-muted-foreground text-sm mt-1">注册新账号</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-center">创建账号</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reg-username">用户名 *</Label>
                  <Input
                    id="reg-username"
                    value={form.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    placeholder="登录用户名"
                    data-testid="input-reg-username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reg-name">真实姓名 *</Label>
                  <Input
                    id="reg-name"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="您的姓名"
                    data-testid="input-reg-name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>注册身份 *</Label>
                <Select value={form.role} onValueChange={(v) => handleChange("role", v)}>
                  <SelectTrigger className="mt-1" data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">👨‍👩‍👧 家长（寻找老师）</SelectItem>
                    <SelectItem value="teacher">👩‍🏫 老师（提供服务）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reg-phone">手机号</Label>
                  <Input
                    id="reg-phone"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="手机号码"
                    data-testid="input-reg-phone"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reg-city">所在城市</Label>
                  <Input
                    id="reg-city"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="如：北京"
                    data-testid="input-reg-city"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reg-password">密码 *</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="设置登录密码"
                  data-testid="input-reg-password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="reg-confirm">确认密码 *</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="再次输入密码"
                  data-testid="input-reg-confirm"
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="btn-register"
              >
                {loading ? "注册中..." : "注册"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                已有账号？{" "}
                <Link href="/" className="text-primary hover:underline font-medium">立即登录</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
