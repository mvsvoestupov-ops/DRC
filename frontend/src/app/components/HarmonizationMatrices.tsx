import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, EyeOff, GitCompare, Info, Layers, MapPin, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/app/components/AutoTextarea";
import { useI18n } from "@/context/I18nContext";

export type RegistrySystemRef = {
  code: string;
  name: string;
  region: string;
};

type Props = {
  step: number;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Системы из шага 1 (реестры-аналоги) — для матрицы уровней. */
  step1Registries?: Array<Record<string, unknown>>;
};

const COMPAT_KEYS = [
  "levels",
  "labor_functions",
  "machine_readable",
  "multilingual",
  "open_api",
  "blockchain",
] as const;

/** Шкала приоритета интеграции с ЦРК: 1 = высший. */
const PRIORITY_LEVELS = [1, 2, 3, 4, 5] as const;
type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

function asPriorityLevel(value: unknown): PriorityLevel {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  if (Number.isFinite(n) && n > 5) return 5;
  return 3;
}

function priorityOptionLabel(t: (key: string) => string, level: number): string {
  const key = `intl.priority${level}` as const;
  const labeled = t(key);
  return labeled === key ? `${level}` : labeled;
}

const COMPAT_LABELS: Record<(typeof COMPAT_KEYS)[number], string> = {
  levels: "Уровневая структура",
  labor_functions: "Трудовые функции",
  machine_readable: "Машиночитаемость",
  multilingual: "Многоязычность",
  open_api: "Открытый API",
  blockchain: "Блокчейн",
};

const FALLBACK_BRIDGE_CODES = ["IN", "AE", "ZA", "VN", "AM"] as const;

function asList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function systemsFromRegistries(registries: Array<Record<string, unknown>> | undefined): RegistrySystemRef[] {
  const out: RegistrySystemRef[] = [];
  const seen = new Set<string>();
  for (const row of registries || []) {
    const code = str(row.code).trim();
    if (!code) continue;
    const key = code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code,
      name: str(row.name).trim() || code,
      region: str(row.region).trim(),
    });
  }
  return out;
}

function syncBridgesWithSystems(
  payload: Record<string, unknown>,
  systems: RegistrySystemRef[],
): Record<string, unknown> {
  const codes = systems.map((s) => s.code);
  const bridges = asList(payload.bridges);
  const nextBridges =
    bridges.length > 0
      ? bridges.map((row) => {
          const targets =
            row.targets && typeof row.targets === "object"
              ? { ...(row.targets as Record<string, unknown>) }
              : {};
          for (const code of codes) {
            if (!(code in targets)) targets[code] = "";
          }
          const pruned = codes.length
            ? Object.fromEntries(Object.entries(targets).filter(([k]) => codes.includes(k)))
            : targets;
          return { ...row, targets: pruned };
        })
      : Array.from({ length: 9 }, (_, i) => {
          const n = i + 1;
          return {
            nsk_level: n,
            eqf: n === 9 ? 8 : n,
            targets: Object.fromEntries(codes.map((c) => [c, ""])),
            source: "seed",
            confidence: "medium",
          };
        });
  return { ...payload, systems, bridges: nextBridges, gaps: asList(payload.gaps) };
}

function legacyTargetsFromRow(row: Record<string, unknown>): Record<string, string> {
  const targets: Record<string, string> = {};
  if (row.targets && typeof row.targets === "object") {
    for (const [k, v] of Object.entries(row.targets as Record<string, unknown>)) {
      if (k.trim()) targets[k] = str(v);
    }
  }
  if (str(row.esco).trim()) targets.ESCO = targets.ESCO || str(row.esco);
  if (str(row.onet).trim()) targets.ONET = targets.ONET || str(row.onet);
  if (str(row.ctdl).trim()) targets.CTDL = targets.CTDL || str(row.ctdl);
  return targets;
}

function syncComponentRulesWithSystems(
  payload: Record<string, unknown>,
  systems: RegistrySystemRef[],
): Record<string, unknown> {
  const codes = systems.map((s) => s.code);
  const rows = asList(payload.component_rules);
  const defaultComps = ["A", "B", "C", "soft"];
  const nextRows =
    rows.length > 0
      ? rows.map((row) => {
          const targets = legacyTargetsFromRow(row);
          for (const code of codes) {
            if (!(code in targets)) targets[code] = "";
          }
          const pruned = codes.length
            ? Object.fromEntries(Object.entries(targets).filter(([k]) => codes.includes(k)))
            : targets;
          return {
            crk_component: str(row.crk_component),
            targets: pruned,
            notes: str(row.notes),
          };
        })
      : defaultComps.map((comp) => ({
          crk_component: comp,
          targets: Object.fromEntries(codes.map((c) => [c, ""])),
          notes: "",
        }));
  const seen = new Set(nextRows.map((r) => str(r.crk_component)));
  for (const comp of defaultComps) {
    if (!seen.has(comp)) {
      nextRows.push({
        crk_component: comp,
        targets: Object.fromEntries(codes.map((c) => [c, ""])),
        notes: "",
      });
    }
  }
  return { ...payload, systems, component_rules: nextRows };
}

const COUNTRY_LABELS_RU: Record<string, string> = {
  IN: "Индия",
  AE: "ОАЭ",
  ZA: "ЮАР",
  VN: "Вьетнам",
  AM: "Армения",
  CN: "Китай",
  EG: "Египет",
  KZ: "Казахстан",
  BY: "Беларусь",
  RU: "Россия",
  BR: "Бразилия",
  US: "США",
  EU: "Европейский союз",
};

const REGION_PRESETS = [
  "Европейский союз",
  "США",
  "Австралия",
  "Индия",
  "ОАЭ",
  "ЮАР",
  "Вьетнам",
  "Китай",
  "Казахстан",
  "Египет",
  "Беларусь",
  "Армения",
  "Бразилия",
  "Международный / глобальный",
] as const;

const REGION_ACCENTS: Record<string, string> = {
  "Европейский союз": "border-l-sky-500",
  "США": "border-l-indigo-500",
  "Индия": "border-l-orange-500",
  "ОАЭ": "border-l-teal-500",
  "ЮАР": "border-l-amber-600",
  "Вьетнам": "border-l-rose-500",
  "Китай": "border-l-red-500",
  "Казахстан": "border-l-cyan-600",
  "Египет": "border-l-yellow-600",
  "Австралия": "border-l-emerald-600",
  "Беларусь": "border-l-green-700",
  "Армения": "border-l-violet-500",
  "Бразилия": "border-l-lime-600",
  "Международный / глобальный": "border-l-slate-500",
};

const API_OPTIONS = ["open", "limited", "planned", "none", "unknown"] as const;
const API_LABELS_RU: Record<(typeof API_OPTIONS)[number], string> = {
  open: "Открытый",
  limited: "Ограниченный",
  planned: "Планируется",
  none: "Нет",
  unknown: "Неизвестно",
};

const YES_OPTIONS = ["yes", "partial", "no", "unknown"] as const;
const YES_LABELS_RU: Record<(typeof YES_OPTIONS)[number], string> = {
  yes: "Да",
  partial: "Частично",
  no: "Нет",
  unknown: "Неизвестно",
};

const CONFIDENCE_LABELS_RU: Record<string, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};

function normalizeApi(value: unknown): (typeof API_OPTIONS)[number] {
  const raw = str(value).toLowerCase();
  if (raw === "true" || raw === "open" || raw === "открытый") return "open";
  if (raw === "false" || raw === "none" || raw === "нет") return "none";
  if (raw === "limited" || raw === "ограниченный") return "limited";
  if (raw === "planned" || raw === "планируется") return "planned";
  if (API_OPTIONS.includes(raw as (typeof API_OPTIONS)[number])) return raw as (typeof API_OPTIONS)[number];
  return "unknown";
}

function normalizeYes(value: unknown): (typeof YES_OPTIONS)[number] {
  const raw = str(value).toLowerCase();
  if (raw === "true" || raw === "high" || raw === "yes" || raw === "да") return "yes";
  if (raw === "false" || raw === "no" || raw === "нет") return "no";
  if (raw === "partial" || raw === "частично") return "partial";
  if (YES_OPTIONS.includes(raw as (typeof YES_OPTIONS)[number])) return raw as (typeof YES_OPTIONS)[number];
  return "unknown";
}

function regionToRu(value: unknown): string {
  const raw = str(value).trim();
  if (!raw) return "";
  if (COUNTRY_LABELS_RU[raw.toUpperCase()]) return COUNTRY_LABELS_RU[raw.toUpperCase()];
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    eu: "Европейский союз",
    "european union": "Европейский союз",
    europe: "Европейский союз",
    usa: "США",
    "united states": "США",
    "u.s.": "США",
    "u.s.a.": "США",
    india: "Индия",
    uae: "ОАЭ",
    "united arab emirates": "ОАЭ",
    "south africa": "ЮАР",
    vietnam: "Вьетнам",
    china: "Китай",
    kazakhstan: "Казахстан",
    egypt: "Египет",
    australia: "Австралия",
    belarus: "Беларусь",
    armenia: "Армения",
    brazil: "Бразилия",
    global: "Международный / глобальный",
    international: "Международный / глобальный",
  };
  if (map[lower]) return map[lower];
  const preset = REGION_PRESETS.find((r) => r.toLowerCase() === lower);
  return preset || raw;
}

function regionAccent(regionRu: string): string {
  return REGION_ACCENTS[regionRu] || "border-l-slate-400";
}

function selectCompat(value: unknown, onChange: (v: string) => void) {
  const normalized = normalizeYes(value);
  return (
    <select
      className="form-control px-2 py-1.5 text-sm min-w-[7.5rem] bg-white"
      value={normalized}
      onChange={(e) => onChange(e.target.value)}
    >
      {YES_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {YES_LABELS_RU[opt]}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{children}</span>;
}

function Step1Registries({ payload, onChange }: Omit<Props, "step">) {
  const { t } = useI18n();
  const rows = asList(payload.registries);

  const patchRow = (index: number, patch: Record<string, unknown>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...payload, registries: next });
  };

  const patchCompat = (index: number, key: string, value: string) => {
    const row = rows[index] || {};
    const compat =
      row.compatibility && typeof row.compatibility === "object"
        ? { ...(row.compatibility as Record<string, unknown>) }
        : {};
    compat[key] = value;
    patchRow(index, { compatibility: compat });
  };

  const addRow = () => {
    onChange({
      ...payload,
      registries: [
        ...rows,
        {
          code: "",
          name: "",
          region: "Международный / глобальный",
          unit_type: "",
          data_format: "",
          api_availability: "limited",
          priority: 3,
          compatibility: {
            levels: "unknown",
            labor_functions: "unknown",
            machine_readable: "unknown",
            multilingual: "unknown",
            open_api: "unknown",
            blockchain: "no",
          },
          description: "",
          notes: "",
        },
      ],
    });
  };

  const removeRow = (index: number) => {
    onChange({ ...payload, registries: rows.filter((_, i) => i !== index) });
  };

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Array<{ row: Record<string, unknown>; index: number }>>();
    rows.forEach((row, index) => {
      const region = regionToRu(row.region) || "Регион не указан";
      if (!map.has(region)) {
        map.set(region, []);
        order.push(region);
      }
      map.get(region)!.push({ row, index });
    });
    const priorityNum = (row: Record<string, unknown>) => {
      const n = Number(row.priority);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    let seq = 0;
    return order.map((region) => {
      const items = [...(map.get(region) || [])].sort(
        (a, b) => priorityNum(a.row) - priorityNum(b.row) || a.index - b.index,
      );
      return {
        region,
        items: items.map((item) => {
          seq += 1;
          return { ...item, displayNo: seq };
        }),
      };
    });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-3 text-sm text-sky-950">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" aria-hidden />
          <p>{t("intl.priorityHint")}</p>
        </div>
        <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
          {t("intl.matrixEmpty")}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="w-4 h-4 mr-1.5" />
          {t("intl.addRow")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-3 text-sm text-sky-950">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" aria-hidden />
        <p>{t("intl.priorityHint")}</p>
      </div>
      {grouped.map(({ region, items }) => (
        <section key={region} className="space-y-3">
          <div className="sticky top-0 z-10 -mx-1 px-1 py-2.5 bg-white/95 backdrop-blur-sm border-b-2 border-gray-200">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex h-9 w-1.5 rounded-full shrink-0 ${regionAccent(region).replace("border-l-", "bg-")}`}
                aria-hidden
              />
              <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">{region}</h3>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {items.length}{" "}
                {items.length === 1 ? "реестр" : items.length < 5 ? "реестра" : "реестров"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {items.map(({ row, index, displayNo }) => {
              const compat =
                row.compatibility && typeof row.compatibility === "object"
                  ? (row.compatibility as Record<string, unknown>)
                  : {};
              const apiVal = normalizeApi(row.api_availability);
              const description = str(row.description || row.summary || "");
              const regionValue = regionToRu(row.region);
              const regionInPresets = REGION_PRESETS.includes(regionValue as (typeof REGION_PRESETS)[number]);

              return (
                <article
                  key={index}
                  className={`rounded-2xl border border-gray-200 border-l-4 ${regionAccent(regionValue)} bg-white shadow-sm overflow-hidden`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                      <span
                        className="inline-flex items-center justify-center min-w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold"
                        title={`№ ${displayNo}`}
                      >
                        {displayNo}
                      </span>
                      <Input
                        className="w-28 font-mono text-sm font-semibold bg-white"
                        value={str(row.code)}
                        onChange={(e) => patchRow(index, { code: e.target.value })}
                        placeholder="Код"
                        title="Код системы (имя собственное)"
                      />
                      <Input
                        className="min-w-[14rem] flex-1 font-medium bg-white"
                        value={str(row.name)}
                        onChange={(e) => patchRow(index, { name: e.target.value })}
                        placeholder={t("intl.registryName")}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                        <span className="inline-flex items-center gap-1 shrink-0">
                          {t("intl.priority")}
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] font-bold text-gray-500 cursor-help hover:border-sky-400 hover:text-sky-600"
                            title={t("intl.priorityHint")}
                            aria-label={t("intl.priorityHint")}
                          >
                            i
                          </span>
                        </span>
                        <select
                          className="form-control text-sm bg-white max-w-[18rem] sm:max-w-[22rem]"
                          value={asPriorityLevel(row.priority)}
                          title={t("intl.priorityHint")}
                          onChange={(e) =>
                            patchRow(index, { priority: Number(e.target.value) })
                          }
                        >
                          {PRIORITY_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {priorityOptionLabel(t, level)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                        onClick={() => removeRow(index)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </header>

                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <label className="block">
                        <FieldLabel>{t("intl.region")}</FieldLabel>
                        <select
                          className="form-control w-full bg-white"
                          value={regionInPresets ? regionValue : "__custom__"}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") return;
                            patchRow(index, { region: e.target.value });
                          }}
                        >
                          {REGION_PRESETS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="__custom__">Другое…</option>
                        </select>
                        {!regionInPresets ? (
                          <Input
                            className="mt-2 bg-white"
                            value={regionValue}
                            onChange={(e) => patchRow(index, { region: e.target.value })}
                            placeholder="Укажите регион на русском"
                          />
                        ) : null}
                      </label>
                      <label className="block">
                        <FieldLabel>{t("intl.unitType")}</FieldLabel>
                        <Input
                          className="bg-white"
                          value={str(row.unit_type)}
                          onChange={(e) => patchRow(index, { unit_type: e.target.value })}
                          placeholder="навык, занятие, квалификация…"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>{t("intl.dataFormat")}</FieldLabel>
                        <Input
                          className="bg-white"
                          value={str(row.data_format)}
                          onChange={(e) => patchRow(index, { data_format: e.target.value })}
                          placeholder="RDF, JSON-LD, API…"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Доступность API</FieldLabel>
                        <select
                          className="form-control w-full bg-white"
                          value={apiVal}
                          onChange={(e) => patchRow(index, { api_availability: e.target.value })}
                        >
                          {API_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {API_LABELS_RU[opt]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <FieldLabel>{t("intl.compatibility")}</FieldLabel>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {COMPAT_KEYS.map((key) => (
                          <label key={key} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                            <span className="text-sm text-gray-700">{COMPAT_LABELS[key]}</span>
                            {selectCompat(compat[key], (v) => patchCompat(index, key, v))}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <label className="block">
                        <FieldLabel>{t("intl.description")}</FieldLabel>
                        <AutoTextarea
                          className="form-control w-full text-sm leading-relaxed bg-white"
                          minRows={3}
                          maxRows={16}
                          value={description}
                          onChange={(e) => patchRow(index, { description: e.target.value })}
                          placeholder={t("intl.descriptionPh")}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>{t("intl.notes")}</FieldLabel>
                        <AutoTextarea
                          className="form-control w-full text-sm leading-relaxed bg-white"
                          minRows={3}
                          maxRows={16}
                          value={str(row.notes)}
                          onChange={(e) => patchRow(index, { notes: e.target.value })}
                          placeholder={t("intl.notesPh")}
                        />
                      </label>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-4 h-4 mr-1.5" />
        {t("intl.addRow")}
      </Button>
    </div>
  );
}

function SectionBanner({
  icon: Icon,
  title,
  count,
  accent = "bg-sky-500",
  action,
}: {
  icon: typeof Scale;
  title: string;
  count?: number;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 py-2.5 bg-white/95 backdrop-blur-sm border-b-2 border-gray-200">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`inline-flex h-9 w-1.5 rounded-full shrink-0 ${accent}`} aria-hidden />
        <Icon className="w-4 h-4 text-gray-500 shrink-0" />
        <h3 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h3>
        {count != null ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {count}
          </span>
        ) : null}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
    </div>
  );
}

const SOURCE_OPTIONS = [
  { value: "seed", label: "Базовый seed" },
  { value: "ai", label: "Черновик ИИ" },
  { value: "expert", label: "Эксперт" },
  { value: "official_doc", label: "Официальный документ" },
] as const;

const COMPONENT_META: Record<string, { title: string; accent: string; hint: string }> = {
  A: { title: "A — Знания", accent: "border-l-sky-500", hint: "Knowledge / Competency" },
  B: { title: "B — Умения", accent: "border-l-violet-500", hint: "Skills / Competences" },
  C: { title: "C — Практические навыки", accent: "border-l-amber-500", hint: "Skills / Abilities" },
  soft: { title: "Софт-скилы", accent: "border-l-emerald-500", hint: "Transversal / Work styles" },
};

function gapMatchesSystem(gap: Record<string, unknown>, sys: RegistrySystemRef): boolean {
  const code = str(gap.system_code).trim().toUpperCase();
  if (code) return code === sys.code.toUpperCase();
  const country = str(gap.country).trim().toLowerCase();
  if (!country) return false;
  const region = sys.region.toLowerCase();
  const name = sys.name.toLowerCase();
  return (
    (region && (region.includes(country) || country.includes(region))) ||
    country.includes(sys.code.toLowerCase()) ||
    (name && country.includes(name))
  );
}

function levelCellTone(value: string): string {
  const v = value.trim();
  if (!v || v === "—" || v === "-") return "border-amber-200 bg-amber-50/70";
  if (v.startsWith("≈") || v.toLowerCase().includes("job zone")) return "border-sky-200 bg-sky-50/60";
  return "border-emerald-100 bg-white";
}

function Step2Bridges({
  payload,
  onChange,
  step1Registries,
}: Omit<Props, "step">) {
  const { t } = useI18n();
  const bridges = asList(payload.bridges);
  const gaps = asList(payload.gaps);
  /** Коды систем, скрытых в матрице сравнения (данные сохраняются). */
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => new Set());
  const [confidenceHelpOpen, setConfidenceHelpOpen] = useState(true);

  const systems = useMemo(() => {
    const fromStep1 = systemsFromRegistries(step1Registries);
    if (fromStep1.length) return fromStep1;
    const fromPayload = systemsFromRegistries(asList(payload.systems));
    if (fromPayload.length) return fromPayload;
    return FALLBACK_BRIDGE_CODES.map((code) => ({
      code,
      name: code,
      region: COUNTRY_LABELS_RU[code] || "",
    }));
  }, [step1Registries, payload.systems]);

  const visibleSystems = useMemo(
    () => systems.filter((s) => !hiddenCodes.has(s.code)),
    [systems, hiddenCodes],
  );

  useEffect(() => {
    const codes = systems.map((s) => s.code);
    if (!codes.length) return;
    const needSync =
      JSON.stringify(asList(payload.systems).map((s) => str(s.code))) !== JSON.stringify(codes) ||
      bridges.some((row) => {
        const targets =
          row.targets && typeof row.targets === "object"
            ? (row.targets as Record<string, unknown>)
            : {};
        return codes.some((c) => !(c in targets)) || Object.keys(targets).some((k) => !codes.includes(k));
      });
    if (!needSync && bridges.length > 0) return;
    onChange(syncBridgesWithSystems(payload, systems));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when systems set changes
  }, [systems]);

  // Убираем из hidden коды, которых больше нет в каталоге
  useEffect(() => {
    const alive = new Set(systems.map((s) => s.code));
    setHiddenCodes((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((code) => {
        if (alive.has(code)) next.add(code);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [systems]);

  const toggleSystemVisible = (code: string) => {
    setHiddenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const showAllSystems = () => setHiddenCodes(new Set());
  const hideAllSystems = () => setHiddenCodes(new Set(systems.map((s) => s.code)));

  const gapsBySystem = useMemo(() => {
    const assigned = new Set<number>();
    const map = new Map<string, Array<{ gap: Record<string, unknown>; index: number }>>();
    for (const sys of systems) {
      const items: Array<{ gap: Record<string, unknown>; index: number }> = [];
      gaps.forEach((gap, index) => {
        if (gapMatchesSystem(gap, sys)) {
          items.push({ gap, index });
          assigned.add(index);
        }
      });
      map.set(sys.code, items);
    }
    const orphan: Array<{ gap: Record<string, unknown>; index: number }> = [];
    gaps.forEach((gap, index) => {
      if (!assigned.has(index)) orphan.push({ gap, index });
    });
    return { map, orphan };
  }, [gaps, systems]);

  const patchBridge = (index: number, patch: Record<string, unknown>) => {
    const next = bridges.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...payload, systems, bridges: next });
  };

  const patchTarget = (index: number, systemCode: string, value: string) => {
    const row = bridges[index] || {};
    const targets =
      row.targets && typeof row.targets === "object"
        ? { ...(row.targets as Record<string, unknown>) }
        : {};
    targets[systemCode] = value;
    patchBridge(index, { targets });
  };

  const patchGap = (index: number, patch: Record<string, unknown>) => {
    const next = gaps.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...payload, gaps: next });
  };

  const addGapForSystem = (sys: RegistrySystemRef) => {
    onChange({
      ...payload,
      gaps: [
        ...gaps,
        {
          nsk_level: "",
          system_code: sys.code,
          country: sys.region || sys.name,
          reason: "",
          approach: "",
        },
      ],
    });
  };

  const filledCount = bridges.reduce((acc, row) => {
    const targets =
      row.targets && typeof row.targets === "object"
        ? (row.targets as Record<string, unknown>)
        : {};
    return (
      acc +
      visibleSystems.filter((s) => {
        const v = str(targets[s.code]).trim();
        return v && v !== "—";
      }).length
    );
  }, 0);
  const totalCells = bridges.length * visibleSystems.length;
  const hiddenCount = hiddenCodes.size;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionBanner
          icon={GitCompare}
          title={t("intl.matrixLevels")}
          count={bridges.length}
          accent="bg-indigo-500"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...payload,
                  systems,
                  bridges: [
                    ...bridges,
                    {
                      nsk_level: bridges.length + 1,
                      eqf: Math.min(bridges.length + 1, 8),
                      targets: Object.fromEntries(systems.map((s) => [s.code, ""])),
                      source: "expert",
                      confidence: "medium",
                    },
                  ],
                })
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("intl.addRow")}
            </Button>
          }
        />

        <div className="flex gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-3 text-sm text-indigo-950">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" aria-hidden />
          <p>{t("intl.step2CompareHint")}</p>
        </div>

        {systems.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("intl.matrixColumns")}
              </span>
              <span className="text-xs text-gray-400">
                {t("intl.visibleOf", {
                  visible: String(visibleSystems.length),
                  total: String(systems.length),
                })}
              </span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={showAllSystems}>
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  {t("intl.showAll")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={hideAllSystems}
                  disabled={!systems.length}
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1" />
                  {t("intl.hideAll")}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {systems.map((sys) => {
                const hidden = hiddenCodes.has(sys.code);
                return (
                  <button
                    key={sys.code}
                    type="button"
                    onClick={() => toggleSystemVisible(sys.code)}
                    title={hidden ? t("intl.showSystem") : t("intl.hideSystem")}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      hidden
                        ? "border-dashed border-gray-300 bg-gray-50 text-gray-400"
                        : "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                    }`}
                  >
                    {hidden ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                    <span className="font-mono">{sys.code}</span>
                    <span className="max-w-[9rem] truncate font-normal opacity-80">{sys.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
            {visibleSystems.length}/{systems.length} {t("intl.systemsShort")}
          </span>
          {hiddenCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1 font-medium text-amber-800">
              {t("intl.hiddenCount")}: {hiddenCount}
            </span>
          ) : null}
          {totalCells > 0 ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 border border-emerald-100">
              {t("intl.filledCells")}: {filledCount}/{totalCells}
            </span>
          ) : null}
        </div>

        {bridges.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
            {t("intl.matrixEmpty")}
          </p>
        ) : visibleSystems.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
            {t("intl.allSystemsHidden")}{" "}
            <button type="button" className="text-indigo-700 font-medium underline-offset-2 hover:underline" onClick={showAllSystems}>
              {t("intl.showAll")}
            </button>
          </p>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="sticky left-0 z-20 bg-slate-50 px-3 py-3 text-left font-semibold text-gray-700 min-w-[5.5rem] border-r border-gray-200">
                      НСК
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-indigo-800 min-w-[4.5rem] bg-indigo-50/80">
                      EQF
                    </th>
                    {visibleSystems.map((sys) => (
                      <th
                        key={sys.code}
                        className="px-3 py-3 text-left font-semibold text-gray-800 min-w-[8.5rem] align-bottom"
                      >
                        <div className="flex items-start gap-1 leading-tight">
                          <div className="min-w-0 flex-1">
                            <div className="truncate" title={sys.name}>
                              {sys.name || sys.code}
                            </div>
                            <div className="text-[11px] font-normal text-gray-400 font-mono">{sys.code}</div>
                            {sys.region ? (
                              <div className="text-[11px] font-normal text-gray-500 truncate">{sys.region}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
                            title={t("intl.hideSystem")}
                            onClick={() => toggleSystemVisible(sys.code)}
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left font-semibold text-gray-500 min-w-[11rem]">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {t("intl.confidence")}
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[11px] font-bold shrink-0 transition-colors ${
                            confidenceHelpOpen
                              ? "border-sky-500 bg-sky-100 text-sky-800"
                              : "border-gray-300 text-gray-600 hover:border-sky-400 hover:text-sky-700 hover:bg-sky-50"
                          }`}
                          aria-expanded={confidenceHelpOpen}
                          aria-controls="confidence-help-panel"
                          title={t("intl.confidenceHelpToggle")}
                          onClick={() => setConfidenceHelpOpen((v) => !v)}
                        >
                          i
                        </button>
                      </span>
                    </th>
                    <th className="px-2 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {bridges.map((row, index) => {
                    const targets =
                      row.targets && typeof row.targets === "object"
                        ? (row.targets as Record<string, unknown>)
                        : {};
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-slate-50/60">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-100">
                          <Input
                            className="w-14 h-9 text-center font-bold bg-indigo-50 border-indigo-100"
                            value={str(row.nsk_level)}
                            onChange={(e) =>
                              patchBridge(index, {
                                nsk_level: Number(e.target.value) || e.target.value,
                              })
                            }
                            aria-label="НСК"
                          />
                        </td>
                        <td className="px-3 py-2 bg-indigo-50/30">
                          <Input
                            className="w-14 h-9 text-center bg-white"
                            value={str(row.eqf)}
                            onChange={(e) =>
                              patchBridge(index, { eqf: Number(e.target.value) || e.target.value })
                            }
                            aria-label="EQF"
                          />
                        </td>
                        {visibleSystems.map((sys) => {
                          const val = str(targets[sys.code]);
                          return (
                            <td key={sys.code} className="px-2 py-2">
                              <Input
                                className={`h-9 text-center font-medium ${levelCellTone(val)}`}
                                value={val}
                                onChange={(e) => patchTarget(index, sys.code, e.target.value)}
                                placeholder="—"
                                title={`${sys.name}: уровень при НСК ${str(row.nsk_level)}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 min-w-[11rem]">
                          <select
                            className="w-full min-w-[10rem] rounded-lg border border-gray-300 bg-white px-2.5 py-2 pr-8 text-sm leading-5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            value={str(row.confidence) || "medium"}
                            onChange={(e) => patchBridge(index, { confidence: e.target.value })}
                            aria-label={t("intl.confidence")}
                          >
                            <option value="high">{CONFIDENCE_LABELS_RU.high}</option>
                            <option value="medium">{CONFIDENCE_LABELS_RU.medium}</option>
                            <option value="low">{CONFIDENCE_LABELS_RU.low}</option>
                          </select>
                        </td>
                        <td className="px-1 py-2">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            onClick={() =>
                              onChange({
                                ...payload,
                                systems,
                                bridges: bridges.filter((_, i) => i !== index),
                              })
                            }
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-gray-100 bg-slate-50/80 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-emerald-100 bg-white" />
                {t("intl.cellFilled")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-sky-200 bg-sky-50" />
                {t("intl.cellApprox")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-amber-200 bg-amber-50" />
                {t("intl.cellEmpty")}
              </span>
            </div>
            {confidenceHelpOpen ? (
              <div
                id="confidence-help-panel"
                className="border-t border-sky-100 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" aria-hidden />
                  <div className="space-y-2 min-w-0">
                    <p className="font-semibold text-sky-900">{t("intl.confidenceHelpTitle")}</p>
                    <p>{t("intl.confidenceHintWhyLevel")}</p>
                    <p>{t("intl.confidenceHintWhyBatch")}</p>
                    <p className="text-sky-800/90">{t("intl.confidenceHintGaps")}</p>
                  </div>
                  <button
                    type="button"
                    className="ml-auto shrink-0 text-xs text-sky-700 hover:underline"
                    onClick={() => setConfidenceHelpOpen(false)}
                  >
                    {t("intl.hideHelp")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionBanner
          icon={Scale}
          title={t("intl.gapsBySystem")}
          count={gaps.length}
          accent="bg-amber-500"
        />
        <p className="text-sm text-gray-600">{t("intl.gapsBySystemHint")}</p>

        {!systems.length ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
            {t("intl.noSystemsYet")}
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {systems.map((sys) => {
              const items = gapsBySystem.map.get(sys.code) || [];
              return (
                <article
                  key={sys.code}
                  className={`rounded-2xl border border-gray-200 border-l-4 ${regionAccent(sys.region)} bg-white shadow-sm overflow-hidden`}
                >
                  <header className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 bg-gradient-to-r from-amber-50/50 to-white border-b border-gray-100">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {sys.name || sys.code}
                        </h4>
                        <span className="font-mono text-[11px] text-gray-400">{sys.code}</span>
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {items.length}
                        </span>
                      </div>
                      {sys.region ? <p className="text-xs text-gray-500 mt-0.5">{sys.region}</p> : null}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => addGapForSystem(sys)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {t("intl.addGap")}
                    </Button>
                  </header>

                  <div className="px-4 py-3 space-y-3">
                    {/* Сводка уровней по системе — быстрое сравнение с НСК */}
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 overflow-x-auto">
                      <div className="flex gap-1.5 min-w-max">
                        {bridges.map((row, bi) => {
                          const targets =
                            row.targets && typeof row.targets === "object"
                              ? (row.targets as Record<string, unknown>)
                              : {};
                          const val = str(targets[sys.code]);
                          return (
                            <div
                              key={bi}
                              className={`flex flex-col items-center rounded-lg border px-2 py-1.5 min-w-[3.25rem] ${levelCellTone(val)}`}
                              title={`НСК ${str(row.nsk_level)} → ${val || "—"}`}
                            >
                              <span className="text-[10px] text-gray-400">Н{str(row.nsk_level)}</span>
                              <span className="text-xs font-semibold text-gray-800 tabular-nums">
                                {val || "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">{t("intl.noGaps")}</p>
                    ) : (
                      items.map(({ gap, index }) => (
                        <div
                          key={index}
                          className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              className="h-8 max-w-[8rem] text-xs bg-white"
                              value={str(gap.nsk_level)}
                              onChange={(e) => patchGap(index, { nsk_level: e.target.value })}
                              placeholder="НСК / диапазон"
                            />
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                              onClick={() =>
                                onChange({ ...payload, gaps: gaps.filter((_, i) => i !== index) })
                              }
                              aria-label={t("common.delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <AutoTextarea
                            className="form-control w-full text-xs leading-relaxed bg-white"
                            minRows={2}
                            maxRows={12}
                            value={str(gap.reason)}
                            onChange={(e) => patchGap(index, { reason: e.target.value })}
                            placeholder={t("intl.gapReasonPh")}
                          />
                          <AutoTextarea
                            className="form-control w-full text-xs leading-relaxed bg-white"
                            minRows={2}
                            maxRows={12}
                            value={str(gap.approach)}
                            onChange={(e) => patchGap(index, { approach: e.target.value })}
                            placeholder={t("intl.gapApproachPh")}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {gapsBySystem.orphan.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">{t("intl.gapsOrphan")}</h4>
            {gapsBySystem.orphan.map(({ gap, index }) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-gray-100 p-3">
                <Input
                  className="bg-white text-sm"
                  value={str(gap.system_code)}
                  onChange={(e) => patchGap(index, { system_code: e.target.value })}
                  placeholder="system_code"
                />
                <Input
                  className="bg-white text-sm"
                  value={str(gap.country)}
                  onChange={(e) => patchGap(index, { country: e.target.value })}
                  placeholder={t("intl.region")}
                />
                <AutoTextarea
                  className="form-control w-full text-xs sm:col-span-2 bg-white"
                  minRows={2}
                  maxRows={12}
                  value={str(gap.reason)}
                  onChange={(e) => patchGap(index, { reason: e.target.value })}
                />
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    onClick={() => onChange({ ...payload, gaps: gaps.filter((_, i) => i !== index) })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function isProfessionalTrainingRow(row: Record<string, unknown>): boolean {
  return str(row.ru_level).toLowerCase().includes("профессиональное обучение");
}

function Step4Education({ payload, onChange }: Omit<Props, "step">) {
  const { t } = useI18n();
  const educationMap = asList(payload.education_map);
  const partners = asList(payload.partner_education);

  const patchList = (key: string, rows: Array<Record<string, unknown>>) => {
    const next = { ...payload, [key]: rows };
    delete next.qual_formation;
    onChange(next);
  };

  const patchRow = (
    key: string,
    rows: Array<Record<string, unknown>>,
    index: number,
    patch: Record<string, unknown>,
  ) => {
    patchList(
      key,
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionBanner
          icon={BookOpen}
          title={t("intl.matrixEducation")}
          count={educationMap.length}
          accent="bg-sky-500"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patchList("education_map", [
                  ...educationMap,
                  {
                    ru_level: "",
                    isced: "",
                    eqf_range: "",
                    qualification_doc: "",
                    nsk_levels: "",
                    notes: "",
                  },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("intl.addRow")}
            </Button>
          }
        />
        <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-3 text-sm text-sky-950">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" aria-hidden />
          <p>{t("intl.education273Hint")}</p>
        </div>
        {educationMap.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
            {t("intl.matrixEmpty")}
          </p>
        ) : (
          <div className="space-y-4">
            {educationMap.map((row, index) => {
              const isPt = isProfessionalTrainingRow(row);
              return (
                <article
                  key={index}
                  className={`rounded-2xl border border-gray-200 border-l-4 bg-white shadow-sm overflow-hidden ${
                    isPt ? "border-l-amber-500" : "border-l-sky-500"
                  }`}
                >
                  <header
                    className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 ${
                      isPt
                        ? "bg-gradient-to-r from-amber-50/90 to-white"
                        : "bg-gradient-to-r from-sky-50/80 to-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Input
                        className="font-semibold bg-white w-full"
                        value={str(row.ru_level)}
                        onChange={(e) =>
                          patchRow("education_map", educationMap, index, { ru_level: e.target.value })
                        }
                        placeholder="Уровень образования РФ"
                      />
                      {isPt ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
                          273-ФЗ · до 5 ур. НСК
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      onClick={() => patchList("education_map", educationMap.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </header>
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block w-[4.75rem] shrink-0">
                        <FieldLabel>ISCED</FieldLabel>
                        <Input
                          className="bg-white text-center px-2"
                          value={str(row.isced)}
                          onChange={(e) =>
                            patchRow("education_map", educationMap, index, { isced: e.target.value })
                          }
                          title="ISCED"
                        />
                      </label>
                      <label className="block w-[4.75rem] shrink-0">
                        <FieldLabel>EQF</FieldLabel>
                        <Input
                          className="bg-white text-center px-2"
                          value={str(row.eqf_range)}
                          onChange={(e) =>
                            patchRow("education_map", educationMap, index, { eqf_range: e.target.value })
                          }
                          title="EQF"
                        />
                      </label>
                      <label className="block w-[6.5rem] shrink-0">
                        <FieldLabel>{t("intl.nskLevels")}</FieldLabel>
                        <Input
                          className="bg-white text-center px-2"
                          value={str(row.nsk_levels)}
                          onChange={(e) =>
                            patchRow("education_map", educationMap, index, { nsk_levels: e.target.value })
                          }
                          placeholder="1–5"
                          title={t("intl.nskLevels")}
                        />
                      </label>
                    </div>
                    <label className="block">
                      <FieldLabel>Документ о квалификации</FieldLabel>
                      <AutoTextarea
                        className="form-control w-full text-sm leading-snug bg-white py-2"
                        minRows={2}
                        maxRows={8}
                        value={str(row.qualification_doc)}
                        onChange={(e) =>
                          patchRow("education_map", educationMap, index, {
                            qualification_doc: e.target.value,
                          })
                        }
                        placeholder="Диплом / свидетельство…"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>{t("intl.notes")}</FieldLabel>
                      <AutoTextarea
                        className="form-control w-full text-sm leading-relaxed bg-white"
                        minRows={2}
                        maxRows={14}
                        value={str(row.notes)}
                        onChange={(e) =>
                          patchRow("education_map", educationMap, index, { notes: e.target.value })
                        }
                        placeholder={t("intl.educationNotesPh")}
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionBanner
          icon={MapPin}
          title={t("intl.matrixPartnerEdu")}
          count={partners.length}
          accent="bg-teal-500"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patchList("partner_education", [
                  ...partners,
                  { country: "", bachelor_eq: "", master_eq: "", doctoral_eq: "" },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("intl.addRow")}
            </Button>
          }
        />
        {partners.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
            {t("intl.matrixEmpty")}
          </p>
        ) : (
          <div className="space-y-4">
            {partners.map((row, index) => {
              const code = str(row.country).toUpperCase();
              const countryRu = COUNTRY_LABELS_RU[code] || str(row.country) || "Страна не указана";
              return (
                <article
                  key={index}
                  className={`rounded-2xl border border-gray-200 border-l-4 ${regionAccent(countryRu)} bg-white shadow-sm overflow-hidden`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-teal-50/70 to-white border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                      <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-900 px-3 py-1 text-sm font-semibold">
                        {countryRu}
                      </span>
                      <Input
                        className="w-24 font-mono bg-white"
                        value={str(row.country)}
                        onChange={(e) =>
                          patchRow("partner_education", partners, index, { country: e.target.value })
                        }
                        placeholder="Код"
                        title="Код страны (IN, CN…)"
                      />
                    </div>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      onClick={() => patchList("partner_education", partners.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </header>
                  <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="block">
                      <FieldLabel>≈ российскому бакалавриату</FieldLabel>
                      <Input
                        className="bg-white"
                        value={str(row.bachelor_eq)}
                        onChange={(e) =>
                          patchRow("partner_education", partners, index, { bachelor_eq: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>≈ специалитету / магистратуре</FieldLabel>
                      <Input
                        className="bg-white"
                        value={str(row.master_eq)}
                        onChange={(e) =>
                          patchRow("partner_education", partners, index, { master_eq: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>≈ аспирантуре</FieldLabel>
                      <Input
                        className="bg-white"
                        value={str(row.doctoral_eq)}
                        onChange={(e) =>
                          patchRow("partner_education", partners, index, { doctoral_eq: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Step5Components({
  payload,
  onChange,
  step1Registries,
}: Omit<Props, "step">) {
  const { t } = useI18n();
  const rows = asList(payload.component_rules);

  const systems = useMemo(() => {
    const fromStep1 = systemsFromRegistries(step1Registries);
    if (fromStep1.length) return fromStep1;
    const fromPayload = systemsFromRegistries(asList(payload.systems));
    if (fromPayload.length) return fromPayload;
    return [
      { code: "ESCO", name: "ESCO", region: "Европейский союз" },
      { code: "ONET", name: "O*NET", region: "США" },
      { code: "CTDL", name: "CTDL / Credential Registry", region: "США" },
    ];
  }, [step1Registries, payload.systems]);

  useEffect(() => {
    const codes = systems.map((s) => s.code);
    if (!codes.length) return;
    const needSync =
      JSON.stringify(asList(payload.systems).map((s) => str(s.code))) !== JSON.stringify(codes) ||
      rows.length === 0 ||
      rows.some((row) => {
        const targets = legacyTargetsFromRow(row);
        return codes.some((c) => !(c in targets)) || Object.keys(targets).some((k) => !codes.includes(k));
      });
    if (!needSync) return;
    onChange(syncComponentRulesWithSystems(payload, systems));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when systems set changes
  }, [systems]);

  const patchRow = (index: number, patch: Record<string, unknown>) => {
    onChange({
      ...payload,
      systems,
      component_rules: rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  const patchTarget = (index: number, systemCode: string, value: string) => {
    const row = rows[index] || {};
    const targets = legacyTargetsFromRow(row);
    targets[systemCode] = value;
    patchRow(index, { targets });
  };

  return (
    <div className="space-y-3">
      <SectionBanner
        icon={Layers}
        title={t("intl.matrixComponents")}
        count={rows.length}
        accent="bg-emerald-500"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...payload,
                systems,
                component_rules: [
                  ...rows,
                  {
                    crk_component: "",
                    targets: Object.fromEntries(systems.map((s) => [s.code, ""])),
                    notes: "",
                  },
                ],
              })
            }
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t("intl.addRow")}
          </Button>
        }
      />

      <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 text-sm text-emerald-950">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" aria-hidden />
        <p>{t("intl.step5SystemsHint")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
          {systems.length} {t("intl.systemsShort")}
        </span>
        <span className="text-gray-400 truncate max-w-full">
          {systems.length
            ? systems.map((s) => s.code).join(" · ")
            : t("intl.noSystemsYet")}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-2xl bg-white">
          {t("intl.matrixEmpty")}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => {
            const key = str(row.crk_component).trim();
            const meta = COMPONENT_META[key] || {
              title: key || `Компонент #${index + 1}`,
              accent: "border-l-slate-400",
              hint: "Правило пересчёта",
            };
            const targets = legacyTargetsFromRow(row);
            return (
              <article
                key={index}
                className={`rounded-2xl border border-gray-200 border-l-4 ${meta.accent} bg-white shadow-sm overflow-hidden`}
              >
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-emerald-50/60 to-white border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                    <select
                      className="form-control w-auto bg-white font-semibold"
                      value={COMPONENT_META[key] ? key : "__custom__"}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") return;
                        patchRow(index, { crk_component: e.target.value });
                      }}
                    >
                      {Object.entries(COMPONENT_META).map(([code, info]) => (
                        <option key={code} value={code}>
                          {info.title}
                        </option>
                      ))}
                      <option value="__custom__">Другой…</option>
                    </select>
                    {!COMPONENT_META[key] ? (
                      <Input
                        className="w-40 bg-white"
                        value={key}
                        onChange={(e) => patchRow(index, { crk_component: e.target.value })}
                        placeholder="Код компонента"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{meta.hint}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                    onClick={() =>
                      onChange({
                        ...payload,
                        systems,
                        component_rules: rows.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </header>

                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {systems.map((sys) => (
                      <label
                        key={sys.code}
                        className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-slate-50/80 px-3 py-2.5"
                      >
                        <span className="text-sm font-medium text-gray-800 leading-tight">
                          {sys.name || sys.code}
                          <span className="ml-1 font-mono text-[11px] font-normal text-gray-400">
                            {sys.code}
                          </span>
                        </span>
                        {sys.region ? (
                          <span className="text-[11px] text-gray-500">{sys.region}</span>
                        ) : null}
                        <AutoTextarea
                          className="form-control w-full text-sm leading-relaxed bg-white mt-1"
                          minRows={2}
                          maxRows={14}
                          value={str(targets[sys.code])}
                          onChange={(e) => patchTarget(index, sys.code, e.target.value)}
                          placeholder={t("intl.componentRulePh")}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <FieldLabel>Примечание</FieldLabel>
                    <AutoTextarea
                      className="form-control w-full text-sm leading-relaxed bg-white"
                      minRows={2}
                      maxRows={14}
                      value={str(row.notes)}
                      onChange={(e) => patchRow(index, { notes: e.target.value })}
                      placeholder="Степень соответствия, ограничения, комментарий методиста"
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HarmonizationStepMatrix({ step, payload, onChange, step1Registries }: Props) {
  if (step === 1) return <Step1Registries payload={payload} onChange={onChange} />;
  if (step === 2) {
    return (
      <Step2Bridges payload={payload} onChange={onChange} step1Registries={step1Registries} />
    );
  }
  if (step === 4) return <Step4Education payload={payload} onChange={onChange} />;
  if (step === 5) {
    return (
      <Step5Components payload={payload} onChange={onChange} step1Registries={step1Registries} />
    );
  }
  return null;
}
