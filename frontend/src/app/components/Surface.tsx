import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padded?: boolean;
  sticky?: boolean;
};

/** White panel matching SearchPage filters / result cards */
export function Surface({ children, className, padded, sticky, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        "surface bg-white",
        padded && "p-6",
        sticky && "sticky top-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
