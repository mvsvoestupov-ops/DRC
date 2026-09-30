import type { StructureABC } from "@/lib/structureFromLaborFunctions";

export type RelationType = "equivalent" | "broader" | "narrower" | "related" | "none";
export type MappingConfidence = "high" | "medium" | "low";
export type SkillCoverage = "full" | "partial" | "absent" | "national-only";

export type InternationalSkillRow = {
  id: string;
  component: string;
  text: string;
  escoTerm: string;
  escoUri: string;
  coverage: SkillCoverage;
};

export type InternationalMapping = {
  admitted: boolean;
  denyReason: string;
  okz: string;
  isco: string;
  escoOccupation: string;
  escoOccupationUri: string;
  occupationType: RelationType;
  eqfOccupational: number | null;
  eqfEducational: number | null;
  isced: string;
  aggregateType: RelationType;
  confidence: MappingConfidence;
  skills: InternationalSkillRow[];
  notes: string;
  escoVersion: string;
  analyzedAt: string;
};

export type MappingLaborFunction = {
  code?: string;
  name?: string;
  otf_code?: string;
  otf_level?: string | null;
  okz_codes?: string[] | string | null;
};

export type AnalyzeMappingInput = {
  competenceKind: "professional" | "general" | "universal";
  title: string;
  qualificationLevel: string;
  educationKind: string;
  educationLevel: string;
  professionalAreaCode: string;
  fgosCode: string;
  laborFunctions: MappingLaborFunction[];
  structure: StructureABC;
};

const OCCUPATION_BY_OKZ: Record<string, { term: string; uri: string }> = {
  "2611": {
    term: "lawyer",
    uri: "https://esco.ec.europa.eu/en/classification/occupation?search=lawyer",
  },
  "2612": {
    term: "judge",
    uri: "https://esco.ec.europa.eu/en/classification/occupation?search=judge",
  },
  "2619": {
    term: "legal professional",
    uri: "https://esco.ec.europa.eu/en/classification/occupation?search=legal%20professional",
  },
};

const SKILL_RULES: Array<{ re: RegExp; term: string; uri: string }> = [
  {
    re: /экспертиз|толкован\w*\s+прав|interpret law|правов\w+\s+оценк/i,
    term: "interpret law",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=interpret%20law",
  },
  {
    re: /нормативн\w*\s+акт|законопроект|draft legal|правов\w+\s+акт|локальн\w+\s+акт/i,
    term: "draft legal documents",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=draft%20legal%20documents",
  },
  {
    re: /договор|контракт|review contract/i,
    term: "review contracts",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=review%20contracts",
  },
  {
    re: /судебн|представ\w+\s+в\s+суд|hearings|процессуальн/i,
    term: "represent clients in courts",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=represent%20clients%20in%20courts",
  },
  {
    re: /стресс|самоконтроль|calm|stress|нагрузк\w+\s+судебн/i,
    term: "handle stressful situations",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=handle%20stressful%20situations",
  },
  {
    re: /принят\w+\s+решен|make decisions|обоснованн\w+\s+решен/i,
    term: "make decisions",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=make%20decisions",
  },
  {
    re: /консульт|advise on legal/i,
    term: "provide legal advice",
    uri: "https://esco.ec.europa.eu/en/classification/skill?search=provide%20legal%20advice",
  },
];

const NATIONAL_RE =
  /гк\s*рф|гпк\s*рф|апк\s*рф|ук\s*рф|кодекс|фз\s|приказ\s+мин|иерархи\w+\s+нпа|юридическ\w+\s+техник/i;

export const RELATION_TYPES: RelationType[] = [
  "equivalent",
  "broader",
  "narrower",
  "related",
  "none",
];

export const COVERAGE_TYPES: SkillCoverage[] = [
  "full",
  "partial",
  "absent",
  "national-only",
];

export function emptyInternationalMapping(): InternationalMapping {
  return {
    admitted: false,
    denyReason: "",
    okz: "",
    isco: "",
    escoOccupation: "",
    escoOccupationUri: "",
    occupationType: "none",
    eqfOccupational: null,
    eqfEducational: null,
    isced: "",
    aggregateType: "none",
    confidence: "low",
    skills: [],
    notes: "",
    escoVersion: "ESCO v1.2",
    analyzedAt: "",
  };
}

export function normalizeInternationalMapping(raw?: Partial<InternationalMapping> | null): InternationalMapping {
  const base = emptyInternationalMapping();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
  };
}

export function eqfFrom148n(level: string | number | null | undefined): number | null {
  const n = Number(level);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n >= 9) return 8;
  if (n > 8) return 8;
  return n;
}

export function eqfFromEducation(educationLevel: string, educationKind: string): number | null {
  const text = `${educationKind} ${educationLevel}`.toLowerCase();
  if (text.includes("высшей квалификации") || text.includes("аспирант") || text.includes("адъюнкт")) return 8;
  if (text.includes("магистратур") || text.includes("специалитет")) return 7;
  if (text.includes("бакалавр")) return 6;
  if (text.includes("среднее профессиональное") || text.includes("спо")) return 5;
  if (educationKind.includes("дополнительное")) return null;
  return null;
}

export function iscedFromEducation(educationLevel: string, educationKind: string): string {
  const eqf = eqfFromEducation(educationLevel, educationKind);
  if (eqf === 8) return "ISCED 8";
  if (eqf === 7) return "ISCED 7";
  if (eqf === 6) return "ISCED 6";
  if (eqf === 5) return "ISCED 5";
  return "";
}

function firstOkz(laborFunctions: MappingLaborFunction[]): string {
  for (const lf of laborFunctions) {
    const raw = lf.okz_codes;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of list) {
      const digits = String(item).replace(/\D/g, "");
      if (digits.length >= 4) return digits.slice(0, 4);
    }
    const blob = `${lf.otf_code || ""} ${lf.otf_name || ""} ${lf.name || ""}`;
    const labeled = blob.match(/ОКЗ\s+(\d{4})/i);
    if (labeled) return labeled[1];
    const known = blob.match(/\b(2611|2612|2619|2613)\b/);
    if (known) return known[1];
  }
  return "";
}

function matchSkill(text: string): { term: string; uri: string; coverage: SkillCoverage } {
  if (NATIONAL_RE.test(text)) {
    return { term: "", uri: "", coverage: "national-only" };
  }
  const hit = SKILL_RULES.find((rule) => rule.re.test(text));
  if (hit) return { term: hit.term, uri: hit.uri, coverage: "full" };
  return { term: "", uri: "", coverage: "absent" };
}

function collectComponents(structure: StructureABC): Array<{ component: string; text: string }> {
  const rows: Array<{ component: string; text: string }> = [];
  (["A", "B", "C"] as const).forEach((cat) => {
    (structure[cat] || []).forEach((item, index) => {
      const text = (item.text || "").trim();
      if (!text) return;
      rows.push({ component: `${cat}${index + 1}`, text });
    });
  });
  return rows;
}

export function analyzeInternationalMapping(input: AnalyzeMappingInput): InternationalMapping {
  const mapping = emptyInternationalMapping();
  mapping.analyzedAt = new Date().toISOString();
  mapping.eqfOccupational = eqfFrom148n(input.qualificationLevel);
  mapping.eqfEducational = eqfFromEducation(input.educationLevel, input.educationKind);
  mapping.isced = iscedFromEducation(input.educationLevel, input.educationKind);

  const hasTf = input.laborFunctions.some((item) => (item.code || "").trim());
  const isProfessional = input.competenceKind === "professional";

  if (isProfessional && !hasTf) {
    mapping.admitted = false;
    mapping.denyReason = "no-tf";
    mapping.aggregateType = "none";
    mapping.occupationType = "none";
    mapping.confidence = "low";
    return mapping;
  }

  mapping.admitted = true;
  mapping.okz = firstOkz(input.laborFunctions);
  if (!mapping.okz && input.professionalAreaCode === "09" && isProfessional) {
    mapping.okz = "2611";
  }
  mapping.isco = mapping.okz;
  const occupation = mapping.okz ? OCCUPATION_BY_OKZ[mapping.okz] : undefined;

  const components = collectComponents(input.structure);
  mapping.skills = components.map((row, index) => {
    const hit = matchSkill(row.text);
    return {
      id: `imap-${index}-${row.component}`,
      component: row.component,
      text: row.text,
      escoTerm: hit.term,
      escoUri: hit.uri,
      coverage: hit.coverage,
    };
  });

  if (input.competenceKind === "universal" || input.competenceKind === "general") {
    mapping.escoOccupation = "";
    mapping.escoOccupationUri = "";
    mapping.occupationType = "none";
    const covered = mapping.skills.filter((row) => row.coverage === "full" || row.coverage === "partial").length;
    mapping.aggregateType = covered > 0 ? "related" : "none";
    mapping.confidence = covered > 0 ? "medium" : "low";
    if (!mapping.skills.length && /стресс|судебн|самоконтроль/i.test(input.title)) {
      mapping.skills.push({
        id: "imap-title",
        component: "U",
        text: input.title,
        escoTerm: "handle stressful situations",
        escoUri: "https://esco.ec.europa.eu/en/classification/skill?search=handle%20stressful%20situations",
        coverage: "partial",
      });
      mapping.aggregateType = "related";
      mapping.confidence = "medium";
    }
    return mapping;
  }

  if (occupation) {
    mapping.escoOccupation = occupation.term;
    mapping.escoOccupationUri = occupation.uri;
    mapping.occupationType = "narrower";
  } else {
    mapping.occupationType = "none";
  }

  const keyC = mapping.skills.filter((row) => row.component.startsWith("C"));
  const coveredC = keyC.filter((row) => row.coverage === "full" || row.coverage === "partial");
  const national = mapping.skills.filter((row) => row.coverage === "national-only").length;
  if (!occupation) {
    mapping.aggregateType = coveredC.length ? "related" : "none";
  } else if (keyC.length > 0 && coveredC.length / keyC.length >= 0.5) {
    mapping.aggregateType = "narrower";
  } else if (coveredC.length > 0) {
    mapping.aggregateType = "related";
  } else {
    mapping.aggregateType = national > 0 ? "none" : "related";
  }

  const eqfAligned =
    mapping.eqfOccupational != null &&
    (mapping.eqfEducational == null || mapping.eqfOccupational === mapping.eqfEducational);
  if (occupation && mapping.aggregateType === "narrower" && eqfAligned) {
    mapping.confidence = "high";
  } else if (occupation || coveredC.length) {
    mapping.confidence = "medium";
  } else {
    mapping.confidence = "low";
  }

  return mapping;
}
