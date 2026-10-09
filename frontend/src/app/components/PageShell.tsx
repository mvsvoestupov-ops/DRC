import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** max-w-6xl for detail / wizard forms */
  narrow?: boolean;
  /** skip vertical padding (e.g. full-bleed hero pages) */
  flush?: boolean;
};

export function PageShell({ children, className, narrow, flush }: PageShellProps) {
  return (
    <div
      className={cn(
        "site-wrap",
        flush ? "" : "py-8",
        className
      )}
    >
      {children}
    </div>
  );
}
