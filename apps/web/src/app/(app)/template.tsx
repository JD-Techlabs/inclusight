import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each page eases in (instantly with reduced motion). */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
