import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon size={18} />
        </div>
      )}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-muted">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
