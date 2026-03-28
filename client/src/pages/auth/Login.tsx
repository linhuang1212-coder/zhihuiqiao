import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, isLoginPending } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "请填写用户名和密码", variant: "destructive" });
      return;
    }
    try {
      const user = await login({ username, password });
      toast({ title: `欢迎回来，${user.name}！` });
      // Use hash navigation directly
      if (user.role === "teacher") window.location.hash = "/teacher";
      else if (user.role === "admin") window.location.hash = "/admin";
      else window.location.hash = "/parent";
    } catch (err: any) {
      toast({ title: err.message || "登录失败", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <svg
            viewBox="0 0 60 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-16 h-14 mb-3"
            aria-label="智慧桥"
          >
            <rect x="3" y="33" width="54" height="4.5" rx="2.25" fill="hsl(var(--primary))" />
            <path d="M6 33 Q18 9 30 15" stroke="hsl(var(--primary))" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M54 33 Q42 9 30 15" stroke="hsl(var(--primary))" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <rect x="10" y="33" width="3.5" height="12" rx="1.5" fill="hsl(var(--primary))" />
            <rect x="46.5" y="33" width="3.5" height="12" rx="1.5" fill="hsl(var(--primary))" />
            <rect x="28.5" y="15" width="3" height="18" rx="1.5" fill="hsl(var(--accent))" />
            <circle cx="30" cy="12.5" r="3.5" fill="hsl(var(--accent))" />
          </svg>
          <h1 className="text-2xl font-bold text-foreground">智慧桥</h1>
          <p className="text-muted-foreground text-sm mt-1">连接优质教育，陪伴孩子成长</p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-center">登录账号</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoginPending}
                data-testid="btn-login"
              >
                {isLoginPending ? "登录中..." : "登录"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                还没有账号？{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">立即注册</Link>
              </p>
            </div>
            {/* Demo hints */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground mb-1">演示账号：</p>
              <p>👤 管理员：admin / admin123</p>
              <p>👨‍👩‍👧 家长：parent1 / 123456</p>
              <p>👩‍🏫 老师：teacher1 / 123456</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
