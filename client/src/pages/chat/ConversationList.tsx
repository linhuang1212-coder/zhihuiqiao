import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface ConversationItem {
  id: number;
  parentId: number;
  teacherId: number;
  unreadCount: number;
  updatedAt: string | null;
  otherUser: { id: number; name: string; avatar: string | null; role: string } | null;
  lastMessage: { content: string; type: string; createdAt: string } | null;
}

export default function ConversationList() {
  const { user } = useAuth();

  const { data: conversations, isLoading } = useQuery<ConversationItem[]>({
    queryKey: ["/api/conversations"],
  });

  useWebSocket((data) => {
    if (data.type === "message") {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
    }
  });

  const prefix = user?.role === "parent" ? "/parent" : "/teacher";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">消息</h1>
        <p className="text-sm text-muted-foreground mt-1">与老师/家长的对话</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p>暂无消息</p>
            <p className="text-xs mt-1">解锁老师后即可发起对话</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`${prefix}/messages/${c.id}`}
              className="block"
              data-testid={`conv-item-${c.id}`}
            >
              <Card className="border-card-border hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {c.otherUser?.name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{c.otherUser?.name || "未知用户"}</span>
                        {c.lastMessage?.createdAt && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate pr-2">
                          {c.lastMessage?.type === "system"
                            ? `[系统] ${c.lastMessage.content}`
                            : c.lastMessage?.content || "暂无消息"}
                        </p>
                        {c.unreadCount > 0 && (
                          <Badge className="shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs px-1.5">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 172800000) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
