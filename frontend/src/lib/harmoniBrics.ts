export type HarmoniRelationType = "equivalent" | "broader" | "narrower" | "related" | "none";
export type HarmoniConfidence = "high" | "medium" | "low";
export type MobilityRegime = "notify" | "adapt" | "refuse";

export type HarmoniBricsMapping = {
  admitted: boolean;
  denyReason: string;
  targetCountry: string;
  partnerNqfName: string;
  partnerNqfLevel: string;
  partnerOccupationCode: string;
  partnerOccupationTitle: string;
  isco: string;
  eqfMeta: number | null;
  relationType: HarmoniRelationType;
  mobilityRegime: MobilityRegime;
  confidence: HarmoniConfidence;
  nationalOnly: string[];
  rationale: string;
  assistant: string;
  model: string;
  expertConfirmed: boolean;
  notes: string;
  analyzedAt: string;
};

export type HarmoniBricsCountry = {
  code: string;
  name_ru: string;
  name_en: string;
  nqf: string;
  nqf_levels: string;
  bridge: string;
};

export type HarmoniBricsSuggestResponse = {
  admitted?: boolean;
  deny_reason?: string;
  target_country?: string;
  partner_nqf_name?: string;
  partner_nqf_level?: string;
  partner_occupation_code?: string;
  partner_occupation_title?: string;
  isco?: string;
  eqf_meta?: number | null;
  relation_type?: HarmoniRelationType;
  mobility_regime?: MobilityRegime;
  confidence?: HarmoniConfidence;
  national_only?: string[];
  rationale?: string;
  assistant?: string;
  model?: string | null;
  disclaimer?: string;
  status?: { configured?: boolean; model?: string; base_url?: string };
};

export const HARMONI_RELATION_TYPES: HarmoniRelationType[] = [
  "equivalent",
  "broader",
  "narrower",
  "related",
  "none",
];

export const MOBILITY_REGIMES: MobilityRegime[] = ["notify", "adapt", "refuse"];

export function emptyHarmoniBricsMapping(): HarmoniBricsMapping {
  return {
    admitted: false,
    denyReason: "",
    targetCountry: "",
    partnerNqfName: "",
    partnerNqfLevel: "",
    partnerOccupationCode: "",
    partnerOccupationTitle: "",
    isco: "",
    eqfMeta: null,
    relationType: "related",
    mobilityRegime: "adapt",
    confidence: "low",
    nationalOnly: [],
    rationale: "",
    assistant: "",
    model: "",
    expertConfirmed: false,
    notes: "",
    analyzedAt: "",
  };
}

export function normalizeHarmoniBricsMapping(raw: unknown): HarmoniBricsMapping {
  const base = emptyHarmoniBricsMapping();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const relation = String(data.relationType || data.relation_type || base.relationType);
  const regime = String(data.mobilityRegime || data.mobility_regime || base.mobilityRegime);
  const confidence = String(data.confidence || base.confidence);
  const national = data.nationalOnly ?? data.national_only;
  return {
    ...base,
    admitted: Boolean(data.admitted),
    denyReason: String(data.denyReason || data.deny_reason || ""),
    targetCountry: String(data.targetCountry || data.target_country || ""),
    partnerNqfName: String(data.partnerNqfName || data.partner_nqf_name || ""),
    partnerNqfLevel: String(data.partnerNqfLevel || data.partner_nqf_level || ""),
    partnerOccupationCode: String(data.partnerOccupationCode || data.partner_occupation_code || ""),
    partnerOccupationTitle: String(data.partnerOccupationTitle || data.partner_occupation_title || ""),
    isco: String(data.isco || ""),
    eqfMeta:
      data.eqfMeta != null || data.eqf_meta != null
        ? Number(data.eqfMeta ?? data.eqf_meta)
        : null,
    relationType: (HARMONI_RELATION_TYPES.includes(relation as HarmoniRelationType)
      ? relation
      : base.relationType) as HarmoniRelationType,
    mobilityRegime: (MOBILITY_REGIMES.includes(regime as MobilityRegime)
      ? regime
      : base.mobilityRegime) as MobilityRegime,
    confidence: (["high", "medium", "low"].includes(confidence)
      ? confidence
      : base.confidence) as HarmoniConfidence,
    nationalOnly: Array.isArray(national) ? national.map((item) => String(item)).filter(Boolean) : [],
    rationale: String(data.rationale || ""),
    assistant: String(data.assistant || ""),
    model: String(data.model || ""),
    expertConfirmed: Boolean(data.expertConfirmed ?? data.expert_confirmed),
    notes: String(data.notes || ""),
    analyzedAt: String(data.analyzedAt || data.analyzed_at || ""),
  };
}

export function applySuggestToMapping(
  prev: HarmoniBricsMapping,
  suggest: HarmoniBricsSuggestResponse,
): HarmoniBricsMapping {
  return normalizeHarmoniBricsMapping({
    ...prev,
    admitted: suggest.admitted ?? prev.admitted,
    denyReason: suggest.deny_reason ?? prev.denyReason,
    targetCountry: suggest.target_country || prev.targetCountry,
    partnerNqfName: suggest.partner_nqf_name || prev.partnerNqfName,
    partnerNqfLevel: suggest.partner_nqf_level || prev.partnerNqfLevel,
    partnerOccupationCode: suggest.partner_occupation_code || prev.partnerOccupationCode,
    partnerOccupationTitle: suggest.partner_occupation_title || prev.partnerOccupationTitle,
    isco: suggest.isco || prev.isco,
    eqfMeta: suggest.eqf_meta ?? prev.eqfMeta,
    relationType: suggest.relation_type || prev.relationType,
    mobilityRegime: suggest.mobility_regime || prev.mobilityRegime,
    confidence: suggest.confidence || prev.confidence,
    nationalOnly: suggest.national_only || prev.nationalOnly,
    rationale: suggest.rationale || prev.rationale,
    assistant: suggest.assistant || prev.assistant,
    model: suggest.model || suggest.status?.model || prev.model,
    expertConfirmed: false,
    analyzedAt: new Date().toISOString(),
  });
}
