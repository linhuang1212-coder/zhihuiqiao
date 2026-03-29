import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

const roleLabels: Record<string, string> = { parent: "家长", teacher: "老师", admin: "管理员" };
const statusLabels: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "正常", color: "default" },
  frozen: { label: "已冻结", color: "secondary" },
  banned: { label: "已封禁", color: "destructive" },
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "用户状态已更新" });
    },
    onError: (err: any) => toast({ title: err.message || "操作失败", variant: "destructive" }),
  });

  const filtered = users?.filter((u) => {
    if (!search) return true;
    return u.name?.includes(search) || u.username?.includes(search) || u.phone?.includes(search);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">用户管理</h1>
        <p className="text-sm text-muted-foreground mt-1">查看和管理所有注册用户</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜索姓名、用户名、手机号..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-users" />
      </div>

      <Card className="border-card-border">
        {isLoading ? (
          <CardContent className="pt-4 space-y-3">
            {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>专业方向</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{roleLabels[u.role] || u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.role === "teacher" ? (
                        <div className="space-y-1">
                          <div className="text-sm">
                            {[u.education, u.degree, u.major].filter(Boolean).join(" · ") || "未填写"}
                          </div>
                          {(() => {
                            try {
                              const skills: string[] = JSON.parse(u.skills || "[]");
                              if (skills.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {skills.slice(0, 3).map((s: string) => (
                                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{s}</Badge>
                                  ))}
                                  {skills.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">+{skills.length - 3}</span>
                                  )}
                                </div>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.city || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusLabels[u.status]?.color || "default"}>
                        {statusLabels[u.status]?.label || u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {u.status === "active" && u.role !== "admin" && (
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => statusMutation.mutate({ id: u.id, status: "frozen" })}
                            data-testid={`btn-freeze-${u.id}`}>冻结</Button>
                        )}
                        {u.status === "frozen" && (
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => statusMutation.mutate({ id: u.id, status: "active" })}
                            data-testid={`btn-activate-${u.id}`}>解冻</Button>
                        )}
                        {u.status !== "banned" && u.role !== "admin" && (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive"
                            onClick={() => statusMutation.mutate({ id: u.id, status: "banned" })}
                            data-testid={`btn-ban-${u.id}`}>封禁</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
