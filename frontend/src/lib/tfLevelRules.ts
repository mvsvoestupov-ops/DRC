export type TfLevelRange = { min: number; max: number };

export function parseTfLevel(otfLevel?: string | null): number | null {
  const match = String(otfLevel || "").match(/(\d+)/);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isFinite(level) ? level : null;
}

export function formatTfLevel(otfLevel?: string | null): string | null {
  const level = parseTfLevel(otfLevel);
  return level != null ? String(level) : null;
}

export function allowedTfLevelRange(
  educationKind: string,
  educationLevel: string,
): TfLevelRange | null {
  if (educationKind === "дополнительное образование") return null;
  if (educationKind === "профессиональное обучение") return { min: 1, max: 4 };
  if (educationKind === "профессиональное образование") {
    if (educationLevel === "среднее профессиональное образование") return { min: 1, max: 6 };
    if (educationLevel === "высшее образование - бакалавриат") return { min: 1, max: 6 };
    if (educationLevel === "высшее образование - специалитет, магистратура") return { min: 1, max: 8 };
    if (educationLevel === "высшее образование - подготовка кадров высшей квалификации") return null;
  }
  return null;
}

export function isTfLevelInRange(level: number | null, range: TfLevelRange | null): boolean {
  if (!range) return true;
  if (level == null) return false;
  return level >= range.min && level <= range.max;
}

export function tfLevelRangeHint(range: TfLevelRange | null): string {
  if (!range) return "Ограничений по уровню трудовых функций нет.";
  if (range.min === range.max) return `Доступны трудовые функции ${range.min} уровня.`;
  return `Доступны трудовые функции ${range.min}–${range.max} уровня.`;
}

export function tfDisabledReason(
  level: number | null,
  range: TfLevelRange | null,
  lockedLevel: number | null,
): string | null {
  if (!isTfLevelInRange(level, range)) {
    if (level == null) return "У трудовой функции не указан уровень квалификации.";
    return `${tfLevelRangeHint(range)} Эта ТФ — ${level} уровня.`;
  }
  if (lockedLevel != null && level != null && level !== lockedLevel) {
    return `Уже выбран ${lockedLevel} уровень. Одна компетенция разрабатывается на один уровень квалификации.`;
  }
  return null;
}
