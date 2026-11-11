/** Цвета квадрантов SWOT — общие для столов и итогов. */
export type SwotField = "strengths" | "weaknesses" | "opportunities" | "threats";

export const SWOT_FIELD_STYLES: Record<
  SwotField,
  {
    /** Контейнер блока */
    panel: string;
    /** Заголовок / подпись */
    title: string;
    /** Поле ввода */
    input: string;
    /** Буква-маркер S/W/O/T */
    badge: string;
    letter: string;
  }
> = {
  strengths: {
    panel:
      "rounded-xl border border-emerald-200 bg-emerald-50/80 border-l-4 border-l-emerald-500 p-4 sm:p-5",
    title: "text-emerald-950",
    input:
      "form-control w-full min-h-[8rem] border-emerald-200 bg-white/90 focus:border-emerald-400 focus:ring-emerald-300/40",
    badge: "bg-emerald-600 text-white",
    letter: "S",
  },
  weaknesses: {
    panel:
      "rounded-xl border border-amber-200 bg-amber-50/80 border-l-4 border-l-amber-500 p-4 sm:p-5",
    title: "text-amber-950",
    input:
      "form-control w-full min-h-[8rem] border-amber-200 bg-white/90 focus:border-amber-400 focus:ring-amber-300/40",
    badge: "bg-amber-500 text-amber-950",
    letter: "W",
  },
  opportunities: {
    panel:
      "rounded-xl border border-sky-200 bg-sky-50/80 border-l-4 border-l-sky-500 p-4 sm:p-5",
    title: "text-sky-950",
    input:
      "form-control w-full min-h-[8rem] border-sky-200 bg-white/90 focus:border-sky-400 focus:ring-sky-300/40",
    badge: "bg-sky-600 text-white",
    letter: "O",
  },
  threats: {
    panel:
      "rounded-xl border border-rose-200 bg-rose-50/80 border-l-4 border-l-rose-500 p-4 sm:p-5",
    title: "text-rose-950",
    input:
      "form-control w-full min-h-[8rem] border-rose-200 bg-white/90 focus:border-rose-400 focus:ring-rose-300/40",
    badge: "bg-rose-600 text-white",
    letter: "T",
  },
};

export const SWOT_FIELD_ORDER: SwotField[] = [
  "strengths",
  "weaknesses",
  "opportunities",
  "threats",
];
