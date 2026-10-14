import { useEffect, useState, type RefObject, type SyntheticEvent } from "react";
import type { CompetencePresenceUser } from "@/api/types";
import { useI18n } from "@/context/I18nContext";
import { presenceFragmentLabel, presenceShortName } from "@/lib/collaborationPresence";

type Box = {
  userId: number;
  name: string;
  color: string;
  top: number;
  left: number;
  width: number;
  height: number;
  offset: number;
};

export function readPresenceFragment(event: SyntheticEvent, fallback: string) {
  const node = (event.target as HTMLElement | null)?.closest?.("[data-presence-fragment]");
  return node?.getAttribute("data-presence-fragment") || fallback;
}

function PresenceCursorLabel({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-end drop-shadow-sm">
      <svg width="14" height="18" viewBox="0 0 14 18" className="shrink-0" aria-hidden>
        <path
          d="M1.2 1.2 1.2 15.4 4.7 11.6 7.1 16.8 9.4 15.7 7 10.5 12.6 10.2Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="-ml-0.5 mb-1 max-w-[14rem] truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-white"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </span>
  );
}

export function CollaborationPresenceBar({
  peers,
  currentStep,
}: {
  peers: CompetencePresenceUser[];
  currentStep: number;
}) {
  const { t } = useI18n();
  if (peers.length === 0) return null;
  const others = peers.filter((row) => !row.self);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-primary/70">
        {t("presence.online")}
      </span>
      {peers.map((row) => {
        const label = presenceShortName(row.name);
        const where = presenceFragmentLabel(t, row.fragment, row.step);
        return (
          <span
            key={row.user_id}
            title={`${row.name} · ${t("presence.onStep", { n: row.step })} · ${where}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white/90 py-0.5 pl-1 pr-2 text-xs text-gray-800"
            style={{ borderColor: row.color }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="truncate font-medium">
              {label}
              {row.self ? ` (${t("presence.you")})` : ""}
            </span>
            <span className="truncate text-gray-500">
              {t("presence.onStep", { n: row.step })}
              {row.step === currentStep ? ` · ${where}` : ""}
            </span>
          </span>
        );
      })}
      {others.length === 0 ? (
        <span className="text-xs text-gray-500">{t("presence.alone")}</span>
      ) : null}
    </div>
  );
}

export function CollaborationStepDots({
  step,
  peers,
}: {
  step: number;
  peers: CompetencePresenceUser[];
}) {
  const here = peers.filter((row) => !row.self && row.step === step).slice(0, 4);
  if (here.length === 0) return null;
  return (
    <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
      {here.map((row) => (
        <span
          key={row.user_id}
          className="h-1.5 w-1.5 rounded-full ring-1 ring-white"
          style={{ backgroundColor: row.color }}
          title={row.name}
        />
      ))}
    </span>
  );
}

export function CollaborationCursors({
  peers,
  containerRef,
}: {
  peers: CompetencePresenceUser[];
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const cursorKey = peers
    .filter((row) => !row.self && row.fragment)
    .map((row) => `${row.user_id}:${row.fragment}:${row.color}:${row.name}`)
    .join("|");

  useEffect(() => {
    const container = containerRef.current;
    const others = peers.filter((row) => !row.self && row.fragment);
    if (!container) {
      setBoxes([]);
      return;
    }

    const measure = () => {
      const crect = container.getBoundingClientRect();
      const grouped = new Map<string, number>();
      const next: Box[] = [];
      for (const row of others) {
        const safe = row.fragment.replace(/"/g, "");
        const el = container.querySelector(`[data-presence-fragment="${safe}"]`) as HTMLElement | null;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const offset = grouped.get(row.fragment) || 0;
        grouped.set(row.fragment, offset + 1);
        next.push({
          userId: row.user_id,
          name: presenceShortName(row.name),
          color: row.color,
          top: rect.top - crect.top,
          left: rect.left - crect.left,
          width: rect.width,
          height: rect.height,
          offset,
        });
      }
      setBoxes(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    container.addEventListener("scroll", measure, true);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const timer = window.setInterval(measure, 700);
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", measure, true);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.clearInterval(timer);
    };
  }, [containerRef, cursorKey, peers]);

  if (boxes.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {boxes.map((box) => (
        <div key={box.userId}>
          <div
            className="absolute rounded-lg"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
              boxShadow: `inset 0 0 0 2px ${box.color}`,
            }}
          />
          <div
            className="absolute transition-[top,left] duration-200"
            style={{
              top: Math.max(0, box.top - 6 - box.offset * 22),
              left: box.left + 6 + box.offset * 10,
            }}
          >
            <PresenceCursorLabel name={box.name} color={box.color} />
          </div>
        </div>
      ))}
    </div>
  );
}
