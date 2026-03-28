import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, ShieldX, ShieldAlert } from "lucide-react";

interface CertificationStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof ShieldCheck; className: string }> = {
  certified: {
    label: "已认证",
    variant: "default",
    icon: ShieldCheck,
    className: "bg-amber-500 hover:bg-amber-500 text-white border-amber-500",
  },
  pending: {
    label: "审核中",
    variant: "secondary",
    icon: Clock,
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  rejected: {
    label: "未通过",
    variant: "destructive",
    icon: ShieldX,
    className: "",
  },
  uncertified: {
    label: "未认证",
    variant: "outline",
    icon: ShieldAlert,
    className: "text-muted-foreground",
  },
};

export default function CertificationStatusBadge({ status, size = "sm" }: CertificationStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.uncertified;
  const Icon = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1 ${config.className} ${size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1"}`}
      data-testid={`certification-badge-${status}`}
    >
      <Icon size={iconSize} />
      {config.label}
    </Badge>
  );
}
