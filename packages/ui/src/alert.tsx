import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

const styles = {
  error: {
    role: "alert",
    prefix: "Error",
    icon: CircleAlert,
    box: "border-destructive/35 bg-destructive-soft",
    tint: "text-destructive",
  },
  success: {
    role: "status",
    prefix: "Success",
    icon: CircleCheck,
    box: "border-success/35 bg-success-soft",
    tint: "text-success",
  },
  info: {
    role: "status",
    prefix: "Note",
    icon: Info,
    box: "border-info/35 bg-info-soft",
    tint: "text-info",
  },
} as const;

/**
 * Inline message. The meaning is carried by a text prefix and icon, never by colour alone.
 * Errors use role="alert" so screen readers announce them immediately.
 */
export function Alert(props: {
  variant: keyof typeof styles;
  children: ReactNode;
  className?: string;
}) {
  const style = styles[props.variant];
  const Icon = style.icon;
  return (
    <div
      role={style.role}
      className={cn(
        "flex animate-enter gap-3 rounded-lg border px-4 py-3 text-sm text-foreground",
        style.box,
        props.className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.tint)} />
      <div className="min-w-0">
        <strong className="font-semibold">{style.prefix}:</strong> {props.children}
      </div>
    </div>
  );
}
