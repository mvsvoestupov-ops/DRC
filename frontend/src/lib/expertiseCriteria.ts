export const EXPERTISE_CRITERIA = [
  "Соответствие трудовой функции (прямая ссылка на ТФ)",
  "Ясность формулировок компонентов (A/B/C)",
  "Наличие дескрипторов для всех уровней (базовый, продвинутый, экспертный)",
  "Наличие оценочных средств для каждого уровня",
  "Оценочные средства пригодны для НОК (отмечено)",
  "Отсутствие дублирования с существующими компетенциями",
  "Практическая значимость обоснована",
  "Материально-техническая база описана",
] as const;

export const NOK_CRITERION = "Оценочные средства пригодны для НОК (отмечено)";

export type ExpertiseCriterion = {
  value?: string;
  comment?: string;
};

export type ExpertiseChecklist = Record<string, ExpertiseCriterion>;

export function criterionKey(index: number) {
  return `criterion_${index}`;
}

export function getExpertiseDecision(expertise: ExpertiseChecklist) {
  const missingComments = EXPERTISE_CRITERIA.filter((_, index) => {
    const row = expertise[criterionKey(index)] || {};
    return row.value === "нет" && !(row.comment || "").trim();
  });

  const counted = EXPERTISE_CRITERIA.filter((text) => text !== NOK_CRITERION);
  const countedRows = counted.map((text) => expertise[criterionKey(EXPERTISE_CRITERIA.indexOf(text))] || {});
  const allYes = countedRows.every((row) => row.value === "да");
  const hasNo = countedRows.some((row) => row.value === "нет");
  const commentsComplete = missingComments.length === 0;

  return {
    allYes,
    hasNo,
    missingComments,
    commentsComplete,
    canApprove: allYes && commentsComplete,
    canReturn: hasNo && commentsComplete,
  };
}
