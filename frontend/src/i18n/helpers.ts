export const API_STATUS_KEYS: Record<string, string> = {
  действует: "status.active",
  active: "status.active",
  проект: "status.draft",
  draft: "status.draft",
  "на экспертизе": "status.review",
  review: "status.review",
  архив: "status.archived",
  archived: "status.archived",
  утверждена: "status.approved",
};

export const FORMATION_I18N_KEYS: Record<string, string> = {
  базовый: "formation.basic",
  продвинутый: "formation.advanced",
  экспертный: "formation.expert",
};

export const EDUCATION_KIND_I18N_KEYS: Record<string, string> = {
  "профессиональное образование": "education.kindProfessional",
  "профессиональное обучение": "education.kindTraining",
  "дополнительное образование": "education.kindAdditional",
};

export const EDUCATION_LEVEL_I18N_KEYS: Record<string, string> = {
  "среднее профессиональное образование": "education.levelSpoFull",
  "высшее образование - бакалавриат": "education.levelBachelorFull",
  "высшее образование - специалитет, магистратура": "education.levelSpecialistFull",
  "высшее образование - подготовка кадров высшей квалификации": "education.levelHighestFull",
};

export const DESCRIPTOR_I18N_KEYS: Record<string, string> = {
  A: "descriptor.a",
  B: "descriptor.b",
  C: "descriptor.c",
};

export function translateAreaName(
  t: (key: string) => string,
  code?: string | null,
  fallback?: string | null,
) {
  const digits = String(code || "").replace(/\D/g, "").slice(0, 2);
  const normalized = digits ? digits.padStart(2, "0") : "";
  if (!normalized) return (fallback || "").trim();
  const key = `areas.${normalized}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return (fallback || "").trim();
}

export function translateKeyed(
  t: (key: string) => string,
  map: Record<string, string>,
  value: string | null | undefined,
  fallback?: string,
) {
  if (!value) return fallback ?? "";
  const key = map[value];
  return key ? t(key) : fallback ?? value;
}
