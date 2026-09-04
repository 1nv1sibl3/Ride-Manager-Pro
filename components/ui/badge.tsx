import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "info" | "success" | "warn" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  info: "badge-info",
  success: "badge-success",
  warn: "badge-warn",
  danger: "badge-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("badge", TONES[tone], className)}>{children}</span>;
}
