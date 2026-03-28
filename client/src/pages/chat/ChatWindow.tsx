import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Send, Wifi, WifiOff } from "lucide-react";

interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  type: string;
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: number;
  parentId: number;
  teacherId: number;
}

export default function ChatWindow() {
  const [, paramsParent] = useRoute("/parent/messages/:id");
  const [, paramsTeacher] = useRoute("/teacher/messages/:id");
  const convId = parseInt(paramsParent?.id || paramsTeacher?.id || "0");
  const { user } = useAuth();
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const prefix = user?.role === "parent" ? "/parent" : "/teacher";

  const { data: conv } = useQuery<ConversationDetail>({
    queryKey: [`/api/conversations/${convId}/detail`],
    queryFn: async () => {
      const res = await fetch(`/api/conversations`, { credentials: "include" });
      const list = await res.json();
      return list.find((c: any) => c.id === convId) || null;
    },
    enabled: !!convId,
  });

  const otherId = conv ? (conv.parentId === user?.id ? conv.teacherId : conv.parentId) : null;
  const { data: otherUser } = useQuery<any>({
    queryKey: ["/api/users", otherId],
    queryFn: async () => {
      if (!otherId) return null;
      const res = await fetch(`/api/teachers/${otherId}`, { credentials: "include" });
      if (res.ok) return res.json();
      return null;
    },
    enabled: !!otherId,
  });

  const { data: initialMessages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: [`/api/conversations/${convId}/messages`],
    enabled: !!convId,
  });

  useEffect(() => {
    if (initialMessages) {
      setLocalMessages(initialMessages);
    }
  }, [initialMessages]);

  const onWsMessage = useCallback((data: any) => {
    if (data.type === "message" && data.conversationId === convId) {
      setLocalMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [convId]);

  const { connected, sendRead } = useWebSocket(onWsMessage);

  useEffect(() => {
    if (convId) {
      apiRequest("PUT", `/api/conversations/${convId}/read`).catch(() => {});
      sendRead(convId);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
    }
  }, [convId, sendRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/conversations/${convId}/messages`, { content: text });
      const msg = await res.json();
      setLocalMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setInputText("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = otherUser?.name || "对方";

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b shrink-0">
        <Link href={`${prefix}/messages`}>
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="btn-back-messages">
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {displayName[0]}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm">{displayName}</span>
        <span className="ml-auto">
          {connected ? (
            <Wifi size={14} className="text-green-500" />
          ) : (
            <WifiOff size={14} className="text-muted-foreground" />
          )}
        </span>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto py-4 space-y-3" data-testid="messages-container">
        {localMessages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">开始对话吧</p>
        )}
        {localMessages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          const isSystem = msg.type === "system";
          const showDate = idx === 0 || shouldShowDate(localMessages[idx - 1]?.createdAt, msg.createdAt);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center text-xs text-muted-foreground py-2">
                  {formatMessageDate(msg.createdAt)}
                </div>
              )}
              {isSystem ? (
                <div className="flex justify-center" data-testid={`msg-system-${msg.id}`}>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              ) : (
                <div className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.id}`}>
                  <div className={`max-w-[75%] ${isMe ? "order-1" : ""}`}>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className={`text-xs text-muted-foreground mt-0.5 ${isMe ? "text-right" : ""}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t shrink-0">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="flex-1"
          maxLength={1000}
          data-testid="input-chat-message"
        />
        <Button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          size="icon"
          data-testid="btn-send-message"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

function shouldShowDate(prev: string | undefined, curr: string): boolean {
  if (!prev) return true;
  const diff = new Date(curr).getTime() - new Date(prev).getTime();
  return diff > 300000; // 5 minutes gap
}

function formatMessageDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
