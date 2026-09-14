import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** max-w-5xl for detail / wizard forms */
  narrow?: boolean;
  /** skip vertical padding (e.g. full-bleed hero pages) */
  flush?: boolean;
};

export function PageShell({ children, className, narrow, flush }: PageShellProps) {
  return (
    <div
      className={cn(
        narrow ? "max-w-5xl" : "max-w-[1440px]",
        "mx-auto px-8",
        flush ? "" : "py-8",
        className
      )}
    >
      {children}
    </div>
  );
}
