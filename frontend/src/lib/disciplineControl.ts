export type DisciplineControlKind = "current" | "interim" | "final";

export type DisciplineControlOption = {
  value: string;
  i18nKey: string;
};

export type DisciplineControlGroup = {
  kind: DisciplineControlKind;
  groupKey: string;
  options: DisciplineControlOption[];
};

export const DISCIPLINE_CONTROL_GROUPS: DisciplineControlGroup[] = [
  {
    kind: "current",
    groupKey: "discipline.groupCurrent",
    options: [
      { value: "устный опрос", i18nKey: "discipline.oralSurvey" },
      { value: "письменный опрос", i18nKey: "discipline.writtenSurvey" },
      { value: "контрольная работа", i18nKey: "discipline.testWork" },
      { value: "самостоятельная работа", i18nKey: "discipline.independentWork" },
      { value: "тестирование", i18nKey: "discipline.testing" },
      { value: "диктант", i18nKey: "discipline.dictation" },
      { value: "эссе", i18nKey: "discipline.essay" },
      { value: "реферат", i18nKey: "discipline.abstract" },
      { value: "доклад", i18nKey: "discipline.report" },
      { value: "коллоквиум", i18nKey: "discipline.colloquium" },
      { value: "собеседование", i18nKey: "discipline.interview" },
      { value: "проверка тетради / конспекта", i18nKey: "discipline.notebookCheck" },
      { value: "расчётная работа", i18nKey: "discipline.calculationWork" },
      { value: "расчётно-графическая работа", i18nKey: "discipline.graphicCalcWork" },
      { value: "лабораторная работа", i18nKey: "discipline.labWork" },
      { value: "практическая работа", i18nKey: "discipline.practicalWork" },
      { value: "кейс", i18nKey: "discipline.case" },
      { value: "ситуационная задача", i18nKey: "discipline.situationalTask" },
      { value: "деловая игра", i18nKey: "discipline.businessGame" },
      { value: "ролевая игра", i18nKey: "discipline.rolePlay" },
      { value: "круглый стол", i18nKey: "discipline.roundTable" },
      { value: "дискуссия", i18nKey: "discipline.discussion" },
      { value: "портфолио", i18nKey: "discipline.portfolio" },
      { value: "взаимная оценка", i18nKey: "discipline.peerAssessment" },
      { value: "самооценка", i18nKey: "discipline.selfAssessment" },
      { value: "наблюдение / чек-лист", i18nKey: "discipline.observation" },
      { value: "домашнее задание", i18nKey: "discipline.homework" },
    ],
  },
  {
    kind: "interim",
    groupKey: "discipline.groupInterim",
    options: [
      { value: "зачёт", i18nKey: "discipline.credit" },
      { value: "дифференцированный зачёт", i18nKey: "discipline.diffCredit" },
      { value: "экзамен", i18nKey: "discipline.exam" },
      { value: "экзамен квалификационный", i18nKey: "discipline.qualExam" },
      { value: "демонстрационный экзамен", i18nKey: "discipline.demoExam" },
      { value: "курсовая работа", i18nKey: "discipline.coursework" },
      { value: "курсовой проект", i18nKey: "discipline.courseProject" },
      { value: "защита проекта", i18nKey: "discipline.project" },
      { value: "отчёт по практике", i18nKey: "discipline.practiceReport" },
      { value: "контрольная по заочной форме", i18nKey: "discipline.correspondenceTest" },
      { value: "комплексный зачёт", i18nKey: "discipline.complexCredit" },
      { value: "комплексный экзамен", i18nKey: "discipline.complexExam" },
    ],
  },
  {
    kind: "final",
    groupKey: "discipline.groupFinal",
    options: [
      { value: "государственная итоговая аттестация", i18nKey: "discipline.gia" },
      { value: "государственный экзамен", i18nKey: "discipline.stateExam" },
      { value: "защита ВКР", i18nKey: "discipline.vkrDefense" },
      { value: "защита дипломной работы", i18nKey: "discipline.diplomaWork" },
      { value: "защита дипломного проекта", i18nKey: "discipline.diplomaProject" },
      { value: "демонстрационный экзамен (ГИА)", i18nKey: "discipline.demoExamGia" },
      { value: "итоговый экзамен", i18nKey: "discipline.finalExam" },
    ],
  },
];

export const DISCIPLINE_CONTROL_OPTIONS = DISCIPLINE_CONTROL_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value),
);

export const DISCIPLINE_CONTROL_I18N_KEYS: Record<string, string> = Object.fromEntries(
  DISCIPLINE_CONTROL_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.value, option.i18nKey]),
  ),
);
