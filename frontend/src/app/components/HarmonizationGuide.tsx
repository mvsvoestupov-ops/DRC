import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  Ban,
  BookOpen,
  Briefcase,
  Check,
  Equal,
  FileBadge,
  GitCompare,
  Globe2,
  GraduationCap,
  Hash,
  Landmark,
  Layers,
  Link2,
  Network,
  Scale,
  ShieldOff,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";

function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-semibold text-primary hover:underline">
        {summary}
      </summary>
      <div className="mt-2 text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </details>
  );
}

function FlowNode({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-[4.75rem] shrink-0">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tone}`}>
        <Icon className="w-7 h-7" strokeWidth={1.75} />
      </div>
      <div className="text-[11px] font-semibold text-gray-800 text-center leading-tight max-w-[5.5rem]">
        {label}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <>
      <ArrowRight className="hidden md:block w-5 h-5 text-gray-300 shrink-0" />
      <div className="md:hidden w-px h-4 bg-gray-200" />
    </>
  );
}

function TypeGlyph({ kind }: { kind: "eq" | "br" | "na" | "rel" | "none" }) {
  if (kind === "eq") {
    return (
      <svg viewBox="0 0 72 48" className="w-16 h-10" aria-hidden>
        <circle cx="28" cy="24" r="14" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
        <circle cx="44" cy="24" r="14" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "br") {
    return (
      <svg viewBox="0 0 72 48" className="w-16 h-10" aria-hidden>
        <circle cx="36" cy="24" r="18" fill="#e0e7ff" stroke="#4338ca" strokeWidth="2" />
        <circle cx="36" cy="24" r="8" fill="#fff" stroke="#4338ca" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "na") {
    return (
      <svg viewBox="0 0 72 48" className="w-16 h-10" aria-hidden>
        <circle cx="36" cy="24" r="18" fill="#ecfeff" stroke="#0f766e" strokeWidth="2" />
        <path d="M24 24h24" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "rel") {
    return (
      <svg viewBox="0 0 72 48" className="w-16 h-10" aria-hidden>
        <circle cx="22" cy="24" r="11" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
        <circle cx="50" cy="24" r="11" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
        <path d="M33 24h6" stroke="#d97706" strokeWidth="2" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 72 48" className="w-16 h-10" aria-hidden>
      <circle cx="24" cy="24" r="12" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
      <circle cx="50" cy="24" r="10" fill="none" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M44 18l12 12M56 18L44 30" stroke="#ef4444" strokeWidth="2" />
    </svg>
  );
}

export function HarmonizationGuide() {
  const { t } = useI18n();

  const chain = [
    { icon: FileBadge, label: t("harmonization.vizPassport"), tone: "bg-sky-100 text-sky-800" },
    { icon: Scale, label: t("harmonization.vizTf"), tone: "bg-blue-100 text-blue-800" },
    { icon: Hash, label: t("harmonization.vizOkz"), tone: "bg-indigo-100 text-indigo-800" },
    { icon: Waypoints, label: t("harmonization.vizIsco"), tone: "bg-violet-100 text-violet-800" },
    { icon: Briefcase, label: t("harmonization.vizEscoOcc"), tone: "bg-fuchsia-100 text-fuchsia-800" },
    { icon: Layers, label: t("harmonization.vizEscoSkill"), tone: "bg-rose-100 text-rose-800" },
    { icon: Award, label: t("harmonization.vizEqf"), tone: "bg-amber-100 text-amber-800" },
  ] as const;

  const layers = [
    { n: "ly1n", dest: "vizLy1", ru: "ly1r", intl: "ly1i", icon: Briefcase, tone: "bg-blue-50 border-blue-200" },
    { n: "ly2n", dest: "vizLy2", ru: "ly2r", intl: "ly2i", icon: Layers, tone: "bg-indigo-50 border-indigo-200" },
    { n: "ly3n", dest: "vizLy3", ru: "ly3r", intl: "ly3i", icon: Award, tone: "bg-amber-50 border-amber-200" },
    { n: "ly4n", dest: "vizLy4", ru: "ly4r", intl: "ly4i", icon: GraduationCap, tone: "bg-emerald-50 border-emerald-200" },
    { n: "ly5n", dest: "vizLy5", ru: "ly5r", intl: "ly5i", icon: BookOpen, tone: "bg-slate-50 border-slate-200" },
  ] as const;

  const eqfBars = [
    { n: 1, eqf: 1, hint: "" },
    { n: 2, eqf: 2, hint: "" },
    { n: 3, eqf: 3, hint: "" },
    { n: 4, eqf: 4, hint: t("harmonization.vizSpo") },
    { n: 5, eqf: 5, hint: t("harmonization.vizSpo") },
    { n: 6, eqf: 6, hint: t("harmonization.vizBa") },
    { n: 7, eqf: 7, hint: t("harmonization.vizMa") },
    { n: 8, eqf: 8, hint: t("harmonization.vizHi") },
    { n: 9, eqf: 8, hint: t("harmonization.vizHi") },
  ];

  const steps = [
    ["1", "st1t", "st1", FileBadge],
    ["2", "st2t", "st2", Link2],
    ["3", "st3t", "st3", Layers],
    ["4", "st4t", "st4", Briefcase],
    ["5", "st5t", "st5", GitCompare],
    ["6", "st6t", "st6", Award],
    ["7", "st7t", "st7", GraduationCap],
    ["8", "st8t", "st8", Equal],
    ["9", "st9t", "st9", Check],
    ["10", "st10t", "st10", Hash],
  ] as const;

  const types = [
    { key: "tEq", ru: "tEqRu", rule: "tEqR", kind: "eq" as const },
    { key: "tBr", ru: "tBrRu", rule: "tBrR", kind: "br" as const },
    { key: "tNa", ru: "tNaRu", rule: "tNaR", kind: "na" as const },
    { key: "tRel", ru: "tRelRu", rule: "tRelR", kind: "rel" as const },
    { key: "tNone", ru: "tNoneRu", rule: "tNoneR", kind: "none" as const },
  ];

  const bans = [
    { key: "c1", short: "vizC1", icon: Ban },
    { key: "c2", short: "vizC2", icon: GraduationCap },
    { key: "c3", short: "vizC3", icon: Globe2 },
    { key: "c4", short: "vizC4", icon: GitCompare },
    { key: "c5", short: "vizC5", icon: Waypoints },
    { key: "c6", short: "vizC6", icon: Layers },
  ] as const;

  return (
    <article className="space-y-12">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-4">
          {t("harmonization.vizFlow")}
        </p>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-1">
          {chain.map((node, index) => (
            <div key={node.label} className="flex flex-col md:flex-row items-center gap-3 md:gap-1">
              {index > 0 ? <FlowArrow /> : null}
              <FlowNode icon={node.icon} label={node.label} tone={node.tone} />
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-gray-500">{t("harmonization.rIdV")} · {t("harmonization.rVerV")}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 flex gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-2">
              {t("harmonization.vizYes")}
            </div>
            <div className="flex flex-wrap gap-2">
              {["ПС", "ОТФ / ТФ", "148н", "ОКЗ", "ФГОС"].map((chip) => (
                <span key={chip} className="px-2.5 py-1 rounded-full bg-white text-xs font-semibold text-emerald-900 border border-emerald-200">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 flex gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
            <X className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-800 mb-2">
              {t("harmonization.vizNo")}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {["ТФ", "148н", "ОКЗ"].map((chip) => (
                <span key={chip} className="px-2.5 py-1 rounded-full bg-white text-xs font-semibold text-rose-900 border border-rose-200 line-through decoration-rose-400">
                  {chip}
                </span>
              ))}
            </div>
            <Details summary={t("harmonization.vizMore")}>
              <p>{t("harmonization.s1p1")}</p>
              <p>{t("harmonization.s1p2")}</p>
            </Details>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s2title")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-blue-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-600 text-white text-sm font-semibold">{t("harmonization.ruTitle")}</div>
            <div className="grid grid-cols-2 gap-px bg-blue-100">
              {[
                { icon: Scale, label: "ПС · ТК РФ" },
                { icon: Hash, label: "148н" },
                { icon: GraduationCap, label: "ФГОС" },
                { icon: FileBadge, label: "A / B / C" },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4 flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-blue-700 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-200 overflow-hidden">
            <div className="px-4 py-3 bg-indigo-600 text-white text-sm font-semibold">{t("harmonization.euTitle")}</div>
            <div className="grid grid-cols-2 gap-px bg-indigo-100">
              {[
                { icon: Award, label: "EQF" },
                { icon: Briefcase, label: "ESCO" },
                { icon: Waypoints, label: "ISCO-08" },
                { icon: BookOpen, label: "ISCED · ECTS" },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4 flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-indigo-700 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Details summary={t("harmonization.vizMore")}>
          <p>{t("harmonization.s2p1")}</p>
        </Details>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s3title")}</h3>
        <div className="space-y-2">
          {layers.map((layer, index) => (
            <div
              key={layer.n}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${layer.tone}`}
            >
              <div className="w-10 h-10 rounded-full bg-white border border-white/80 flex items-center justify-center shrink-0">
                <layer.icon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {index + 1}. {t(`harmonization.${layer.n}`)}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block ml-auto" />
              <span className="hidden sm:inline-flex items-center rounded-full bg-white/80 border border-white px-2.5 py-1 text-[11px] font-bold text-gray-700">
                {t(`harmonization.${layer.dest}`)}
              </span>
            </div>
          ))}
        </div>
        <Details summary={t("harmonization.vizMore")}>
          <p>{t("harmonization.s3p1")}</p>
          <div className="space-y-2">
            {layers.map((layer) => (
              <p key={layer.n}>
                <span className="font-semibold">{t(`harmonization.${layer.n}`)}.</span>{" "}
                {t(`harmonization.${layer.ru}`)} → {t(`harmonization.${layer.intl}`)}
              </p>
            ))}
          </div>
        </Details>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s4title")}</h3>
          <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            {t("harmonization.vizMap")}
          </span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex gap-3">
            <div className="hidden sm:flex flex-col justify-between text-[10px] font-bold text-indigo-600 py-1 h-40 shrink-0">
              <span>EQF 8</span>
              <span>4</span>
              <span>1</span>
            </div>
            <div className="flex-1 flex items-end gap-1.5 sm:gap-2 h-40">
              {eqfBars.map((bar) => (
                <div key={bar.n} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-indigo-700">EQF {bar.eqf}</span>
                  <div
                    className={`w-full max-w-[3rem] rounded-t-lg ${bar.n === 9 ? "bg-amber-400" : "bg-primary"}`}
                    style={{ height: `${bar.eqf * 14}px` }}
                    title={`${t("harmonization.viz148")} ${bar.n} → EQF ${bar.eqf}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-1">
            <div className="hidden sm:block w-10 shrink-0" />
            <div className="flex-1 flex gap-1.5 sm:gap-2">
              {eqfBars.map((bar) => (
                <div key={bar.n} className="flex-1 text-center min-w-0">
                  <div className="text-sm font-bold text-gray-900">{bar.n}</div>
                  <div className="text-[9px] text-gray-500 truncate">{bar.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary" /> {t("harmonization.viz148")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400" /> 9 → EQF 8
            </span>
          </div>
        </div>
        <Details summary={t("harmonization.vizMore")}>
          <p>{t("harmonization.s4p1")}</p>
        </Details>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s5title")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { step: t("harmonization.br1"), from: t("harmonization.br1f"), to: t("harmonization.br1t"), icon: Hash },
            { step: t("harmonization.br2"), from: t("harmonization.br2f"), to: t("harmonization.br2t"), icon: Briefcase },
            { step: t("harmonization.br3"), from: t("harmonization.br3f"), to: t("harmonization.br3t"), icon: GitCompare },
            { step: t("harmonization.br4"), from: t("harmonization.br4f"), to: t("harmonization.br4t"), icon: ShieldOff },
          ].map((item, index) => (
            <div key={item.step} className="relative rounded-2xl border border-gray-200 bg-white p-4 pt-6">
              <div className="absolute -top-3 left-4 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <item.icon className="w-6 h-6 text-primary mb-2" />
              <div className="text-sm font-semibold text-gray-900 mb-3">{item.step}</div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-gray-500 leading-snug">{item.from}</div>
              <ArrowRight className="w-4 h-4 text-gray-300 my-2" />
              <div className="rounded-lg bg-indigo-50 px-2 py-1.5 text-[11px] font-medium text-indigo-900 leading-snug">{item.to}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s6title")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {steps.map(([n, titleKey, textKey, Icon]) => (
            <div key={n} className="rounded-2xl border border-gray-200 bg-white p-3 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  {n}
                </span>
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-xs font-semibold text-gray-900 leading-snug min-h-[2.5rem]">
                {t(`harmonization.${titleKey}`)}
              </div>
              <Details summary={t("harmonization.vizMore")}>
                <p>{t(`harmonization.${textKey}`)}</p>
              </Details>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s7title")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {types.map((item) => (
            <div key={item.key} className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col items-center text-center min-h-[8.5rem] justify-center">
              <TypeGlyph kind={item.kind} />
              <div className="mt-2 text-sm font-bold font-mono text-gray-900">{t(`harmonization.${item.key}`)}</div>
              <div className="mt-1 text-[11px] text-gray-500">({t(`harmonization.${item.ru}`)})</div>
            </div>
          ))}
        </div>
        <Details summary={t("harmonization.vizMore")}>
          {types.map((item) => (
            <p key={item.key}>
              <span className="font-mono font-semibold">{t(`harmonization.${item.key}`)}</span>
              {" "}({t(`harmonization.${item.ru}`)}). {t(`harmonization.${item.rule}`)}
            </p>
          ))}
        </Details>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s8title")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bans.map((item, index) => (
            <div key={item.key} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 flex flex-col items-center text-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-white border border-rose-200 text-rose-700 flex items-center justify-center">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
              <div className="text-sm font-semibold text-rose-900">{t(`harmonization.${item.short}`)}</div>
            </div>
          ))}
        </div>
        <Details summary={t("harmonization.vizMore")}>
          {bans.map((item, index) => (
            <p key={item.key}>
              {index + 1}. {t(`harmonization.${item.key}`)}
            </p>
          ))}
        </Details>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.s9title")}</h3>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-[640px]">
            {[
              { k: "09", v: t("areas.09") },
              { k: "ТФ", v: "6" },
              { k: "ОКЗ", v: "2611" },
              { k: "ISCO", v: "2611" },
              { k: "ESCO", v: "lawyer" },
              { k: "EQF", v: "6" },
            ].map((node, index) => (
              <div key={node.k} className="flex items-center gap-2">
                {index > 0 ? <ArrowRight className="w-4 h-4 text-violet-300 shrink-0" /> : null}
                <div className="rounded-xl bg-white border border-violet-200 px-3 py-2 text-center min-w-[5.5rem]">
                  <div className="text-[10px] uppercase tracking-wide text-violet-500 font-semibold">{node.k}</div>
                  <div className="text-sm font-bold text-gray-900">{node.v}</div>
                </div>
              </div>
            ))}
            <span className="ml-1 px-2.5 py-1 rounded-full bg-teal-600 text-white text-[11px] font-bold">
              {t("harmonization.tNa")} ({t("harmonization.tNaRu")})
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["interpret law", "draft legal documents", "review contracts"].map((skill) => (
            <span key={skill} className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-800">
              {skill}
            </span>
          ))}
          <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
            ГК РФ · {t("harmonization.vizNat")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {t("harmonization.vizConf")}
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((dot) => (
              <span key={dot} className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
            ))}
            <span className="ml-2 text-sm font-bold text-emerald-900">{t("harmonization.ex5v")}</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            {t("harmonization.gSpace")}
          </span>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900">{t("harmonization.gTitle")}</h4>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-3 py-1">
              {t("harmonization.gSpace")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Network, title: t("harmonization.gNet"), hint: t("harmonization.gNetS"), tone: "bg-sky-50 border-sky-200 text-sky-800" },
              { icon: Users, title: t("harmonization.gHr"), hint: t("harmonization.gHrS"), tone: "bg-indigo-50 border-indigo-200 text-indigo-800" },
              { icon: Globe2, title: t("harmonization.gExp"), hint: t("harmonization.gExpS"), tone: "bg-emerald-50 border-emerald-200 text-emerald-800" },
              { icon: Landmark, title: t("harmonization.gMig"), hint: t("harmonization.gMigS"), tone: "bg-amber-50 border-amber-200 text-amber-800" },
            ].map((goal) => (
              <div key={goal.title} className={`rounded-2xl border p-4 ${goal.tone}`}>
                <goal.icon className="w-6 h-6 mb-2" />
                <div className="text-sm font-bold">{goal.title}</div>
                <div className="mt-1 text-[11px] leading-snug opacity-80">{goal.hint}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{t("harmonization.s9p3")}</p>
        <Details summary={t("harmonization.vizMore")}>
          <p>{t("harmonization.s9p1")}</p>
          <p>{t("harmonization.s9p2")}</p>
          <p><span className="font-semibold">{t("harmonization.gNet")}.</span> {t("harmonization.gNetD")}</p>
          <p><span className="font-semibold">{t("harmonization.gHr")}.</span> {t("harmonization.gHrD")}</p>
          <p><span className="font-semibold">{t("harmonization.gExp")}.</span> {t("harmonization.gExpD")}</p>
          <p><span className="font-semibold">{t("harmonization.gMig")}.</span> {t("harmonization.gMigD")}</p>
          <p>{t("harmonization.closeP2")}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              [t("harmonization.ex1f"), t("harmonization.ex1v")],
              [t("harmonization.ex2f"), t("harmonization.ex2v")],
              [t("harmonization.ex3f"), t("harmonization.ex3v")],
              [t("harmonization.ex4f"), t("harmonization.ex4v")],
              [t("harmonization.ex5f"), t("harmonization.ex5v")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{label}</div>
                <div className="text-xs font-medium text-gray-800 leading-snug">{value}</div>
              </div>
            ))}
          </div>
        </Details>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{t("harmonization.vizOut")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { icon: Link2, label: t("harmonization.vizP1"), text: t("harmonization.s10l1") },
            { icon: Briefcase, label: t("harmonization.vizP2"), text: t("harmonization.s10l2") },
            { icon: Layers, label: t("harmonization.vizP3"), text: t("harmonization.s10l3") },
            { icon: Award, label: t("harmonization.vizP4"), text: t("harmonization.s10l4") },
            { icon: Check, label: t("harmonization.vizP5"), text: t("harmonization.s10l5") },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-gray-200 bg-slate-50 p-4 flex flex-col items-center text-center gap-2 min-h-[7.5rem] justify-center">
              <item.icon className="w-7 h-7 text-primary" />
              <p className="text-xs font-semibold text-gray-800 leading-snug">{item.label}</p>
            </div>
          ))}
        </div>
        <Details summary={t("harmonization.vizMore")}>
          <p>{t("harmonization.s10p1")}</p>
          {[
            t("harmonization.s10l1"),
            t("harmonization.s10l2"),
            t("harmonization.s10l3"),
            t("harmonization.s10l4"),
            t("harmonization.s10l5"),
          ].map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Details>
      </section>
    </article>
  );
}
