import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"textarea">, "rows"> & {
  /** Минимальное число видимых строк. */
  minRows?: number;
  /** Максимум строк до появления прокрутки. */
  maxRows?: number;
};

function AutoTextarea({
  className,
  minRows = 2,
  maxRows = 20,
  value,
  onChange,
  onInput,
  style,
  ...props
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const lineHeight = Number.parseFloat(cs.lineHeight) || 20;
    const padY =
      (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
    const borderY =
      (Number.parseFloat(cs.borderTopWidth) || 0) + (Number.parseFloat(cs.borderBottomWidth) || 0);
    const minH = lineHeight * minRows + padY + borderY;
    const maxH = lineHeight * maxRows + padY + borderY;

    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH + 1 ? "auto" : "hidden";
  };

  useLayoutEffect(() => {
    fit();
  }, [value, minRows, maxRows]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [minRows, maxRows]);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={minRows}
      className={cn("resize-none overflow-hidden field-sizing-content", className)}
      style={style}
      onChange={(e) => {
        onChange?.(e);
        requestAnimationFrame(fit);
      }}
      onInput={(e) => {
        onInput?.(e);
        requestAnimationFrame(fit);
      }}
    />
  );
}

export { AutoTextarea };
