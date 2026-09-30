import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES, type Locale } from "@/i18n/locales";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

function Flag({ locale, className }: { locale: Locale; className?: string }) {
  const cls = cn("h-4 w-6 rounded-[2px] overflow-hidden shadow-sm shrink-0", className);
  if (locale === "ru") {
    return (
      <svg viewBox="0 0 60 42" className={cls} aria-hidden>
        <rect width="60" height="14" fill="#fff" />
        <rect y="14" width="60" height="14" fill="#0039a6" />
        <rect y="28" width="60" height="14" fill="#d52b1e" />
      </svg>
    );
  }
  if (locale === "en") {
    return (
      <svg viewBox="0 0 60 42" className={cls} aria-hidden>
        <rect width="60" height="42" fill="#012169" />
        <path d="M0,0 60,42 M60,0 0,42" stroke="#fff" strokeWidth="9" />
        <path d="M0,0 60,42 M60,0 0,42" stroke="#c8102e" strokeWidth="5" />
        <path d="M30,0 V42 M0,21 H60" stroke="#fff" strokeWidth="15" />
        <path d="M30,0 V42 M0,21 H60" stroke="#c8102e" strokeWidth="9" />
      </svg>
    );
  }
  if (locale === "hi") {
    return (
      <svg viewBox="0 0 60 42" className={cls} aria-hidden>
        <rect width="60" height="14" fill="#ff9933" />
        <rect y="14" width="60" height="14" fill="#fff" />
        <rect y="28" width="60" height="14" fill="#138808" />
        <circle cx="30" cy="21" r="5.5" fill="none" stroke="#000080" strokeWidth="1.4" />
        <circle cx="30" cy="21" r="1.2" fill="#000080" />
      </svg>
    );
  }
  if (locale === "zh") {
    return (
      <svg viewBox="0 0 60 42" className={cls} aria-hidden>
        <rect width="60" height="42" fill="#de2910" />
        <polygon fill="#ffde00" points="12,8 13.9,13.8 20,13.8 15.1,17.4 16.9,23.2 12,19.6 7.1,23.2 8.9,17.4 4,13.8 10.1,13.8" />
        <polygon fill="#ffde00" points="24,6 25.1,9.2 28.5,9.2 25.8,11.2 26.8,14.4 24,12.4 21.2,14.4 22.2,11.2 19.5,9.2 22.9,9.2" />
        <polygon fill="#ffde00" points="28,12 29.1,15.2 32.5,15.2 29.8,17.2 30.8,20.4 28,18.4 25.2,20.4 26.2,17.2 23.5,15.2 26.9,15.2" />
        <polygon fill="#ffde00" points="28,20 29.1,23.2 32.5,23.2 29.8,25.2 30.8,28.4 28,26.4 25.2,28.4 26.2,25.2 23.5,23.2 26.9,23.2" />
        <polygon fill="#ffde00" points="24,26 25.1,29.2 28.5,29.2 25.8,31.2 26.8,34.4 24,32.4 21.2,34.4 22.2,31.2 19.5,29.2 22.9,29.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 42" className={cls} aria-hidden>
      <rect width="60" height="42" fill="#da251d" />
      <polygon fill="#ff0" points="30,8 32.4,15.5 40.4,15.5 34,20.1 36.4,27.6 30,23 23.6,27.6 26,20.1 19.6,15.5 27.6,15.5" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((item) => item.id === locale) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 h-10 px-2.5 rounded-md border border-gray-300 bg-white text-base font-medium text-gray-800 hover:bg-gray-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag locale={current.id} />
        <span className="uppercase tracking-wide">{current.id}</span>
        <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 z-50 min-w-[13rem] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {LANGUAGES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === locale}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-base text-left hover:bg-gray-50",
                  item.id === locale && "bg-blue-50 text-primary font-medium",
                )}
                onClick={() => {
                  setLocale(item.id);
                  setOpen(false);
                }}
              >
                <Flag locale={item.id} />
                <span>{item.native}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
