export type TfLevelRange = { min: number; max: number };

const TF_CODE_LEVEL_RE = /[A-Za-zА-Яа-яЁё]\s*[/.]\s*\d{1,3}\.(\d)/;
const LEVEL_PHRASE_RE = /(?:уровен[ьяе]\s*(?:\(подуровень\))?\s*квалификации|квалификации)\s*[:\s]*([1-9])/i;

function firstQualificationDigit(text: string): number | null {
  const phrase = text.match(LEVEL_PHRASE_RE);
  if (phrase) {
    const level = Number(phrase[1]);
    if (Number.isInteger(level) && level >= 1 && level <= 9) return level;
  }
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isInteger(level) && level >= 1 && level <= 9 ? level : null;
}

export function parseTfLevel(otfLevel?: string | null, tfCode?: string | null): number | null {
  const fromCode = String(tfCode || "").match(TF_CODE_LEVEL_RE);
  if (fromCode) {
    const level = Number(fromCode[1]);
    if (Number.isInteger(level) && level >= 1 && level <= 9) return level;
  }
  return firstQualificationDigit(String(otfLevel || "")) ?? firstQualificationDigit(String(tfCode || ""));
}

export function formatTfLevel(otfLevel?: string | null, tfCode?: string | null): string | null {
  const level = parseTfLevel(otfLevel, tfCode);
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
