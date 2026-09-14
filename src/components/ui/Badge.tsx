import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  info: "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200",
};

export default function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

/**
 * Maps common status strings used across the app (visit requests, rewards,
 * subscriptions, memberships) to a badge visual variant.
 */
export function statusToVariant(status: string): BadgeVariant {
  const normalized = status.toUpperCase();
  if (["APPROVED", "AVAILABLE", "ACTIVE", "CLAIMED", "COMPLETED"].includes(normalized)) {
    return "success";
  }
  if (["PENDING", "IN_PROGRESS"].includes(normalized)) {
    return "warning";
  }
  if (["REJECTED", "EXPIRED", "INACTIVE", "CANCELLED"].includes(normalized)) {
    return "danger";
  }
  if (["REDEEMED"].includes(normalized)) {
    return "info";
  }
  return "neutral";
}
