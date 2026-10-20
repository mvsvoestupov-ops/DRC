export type HarmonizationStepStatus = "empty" | "ai_draft" | "edited" | "verified";
export type HarmonizationVersionStatus = "draft" | "in_review" | "archived";
export type HarmonizationPurpose =
  | "network_programs"
  | "graduate_matching"
  | "education_export"
  | "migration";

export const GLOBAL_HARMONIZATION_STEPS = [1, 2, 4, 5] as const;
export const PASSPORT_HARMONIZATION_STEPS = [3, 6] as const;

export type HarmonizationStepState = {
  step: number;
  status: HarmonizationStepStatus;
  payload: Record<string, unknown>;
  ai_meta?: Record<string, unknown>;
  verified_by_id?: number | null;
  verified_at?: string | null;
  updated_at?: string | null;
};

export type HarmonizationVersion = {
  id: number;
  title: string;
  status: HarmonizationVersionStatus;
  ready_for_apply: boolean;
  notes?: string;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  steps_summary?: Record<string, HarmonizationStepStatus>;
  steps?: HarmonizationStepState[];
};

export type PassportStepBlock = {
  status: HarmonizationStepStatus;
  payload: Record<string, unknown>;
  ai_meta?: Record<string, unknown>;
  verified_by_id?: number | null;
  verified_at?: string | null;
};

export type BridgeSystem = {
  code: string;
  name: string;
  region?: string;
  level_target?: string;
};

export type BridgeContext = {
  version_id?: number | null;
  version_title?: string;
  ready_for_apply?: boolean;
  systems?: BridgeSystem[];
  selected_system_codes?: string[];
  nsk_level?: number | null;
  level_bridge?: {
    nsk_level?: number | null;
    eqf?: string | number | null;
    targets?: Record<string, string>;
    confidence?: string;
  } | null;
  education_bridge?: Record<string, unknown> | null;
  component_rules_esco?: Record<string, string>;
  component_rules_by_system?: Record<string, Record<string, string>>;
  component_rules?: Array<Record<string, unknown>>;
};

export type EscoLocalStatus = {
  version?: string;
  occupations?: number;
  skills?: number;
  relations?: number;
  source?: string;
  local_ready?: boolean;
  imported_at?: string | null;
};

export type PassportHarmonization = {
  id: number;
  competence_id: number;
  version_id: number;
  step3: PassportStepBlock;
  step6: PassportStepBlock;
  version?: HarmonizationVersion;
  ai_agent?: { configured?: boolean; model?: string };
  bridge_context?: BridgeContext;
  esco?: EscoLocalStatus;
  updated_by_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const STEP_LABELS_RU: Record<number, string> = {
  1: "Реестры-аналоги",
  2: "Матрица уровней НРК",
  3: "ТФ/ТД ↔ системы моста",
  4: "Образование / ISCED",
  5: "Компоненты A/B/C",
  6: "Цель сопряжения",
};

export const STATUS_LABELS_RU: Record<HarmonizationStepStatus, string> = {
  empty: "Пусто",
  ai_draft: "Черновик ИИ",
  edited: "Отредактировано",
  verified: "Подтверждено",
};

export const PURPOSE_LABELS_RU: Record<HarmonizationPurpose, string> = {
  network_programs: "Сетевые образовательные программы",
  graduate_matching: "Подбор выпускников",
  education_export: "Экспорт образования",
  migration: "Регулирование миграции",
};

export function asRows(payload: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  const rows = payload?.rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}
