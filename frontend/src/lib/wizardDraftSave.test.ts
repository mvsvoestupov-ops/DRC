import { describe, expect, it } from "vitest";
import {
  buildWizardPersistPayload,
  emptyWizardDraft,
  reloadWizardDraftFromPayload,
  saveAndReloadWizardDraft,
} from "@/lib/wizardDraftSave";
import {
  buildStructureFromLaborFunctions,
  createStructureItemId,
  structureFromPayload,
  structureToPayload,
  type LaborFunctionDetail,
  type StructureABC,
} from "@/lib/structureFromLaborFunctions";
import {
  flattenDisciplineMapping,
  syncDisciplineMapping,
  type DisciplineMappingRow,
} from "@/app/components/DisciplineMappingEditor";
import {
  emptyAssessmentByLevel,
  flattenAssessmentTools,
  syncAssessmentByLevel,
} from "@/lib/assessmentConstructor";

const SAMPLE_TF: LaborFunctionDetail = {
  id: 101,
  code: "A/02.3",
  name: "Организация тушения пожаров",
  otf_level: "3",
  labor_actions: [
    {
      text: "Подготовка средств тушения",
      knowledges: [
        "Особенности эксплуатации пожарных водоемов",
        "Правила охраны труда при тушении",
      ],
      skills: [
        "Применять приборы спутниковой навигации",
        "Оценивать обстановку на месте пожара",
      ],
    },
  ],
};

function structureFromTf(previous: StructureABC = { A: [], B: [], C: [] }) {
  return buildStructureFromLaborFunctions([SAMPLE_TF], previous);
}

function mapDisciplines(structure: StructureABC): DisciplineMappingRow[] {
  return syncDisciplineMapping(structure, []).map((row, index) => ({
    ...row,
    importance: ((index % 10) + 1) as DisciplineMappingRow["importance"],
    volume: ((((index + 3) % 10) + 1) as DisciplineMappingRow["volume"]),
    bindings: [
      {
        discipline: `Дисциплина для ${row.component}`,
        control: "экзамен",
      },
    ],
  }));
}

function withAssessment(structure: StructureABC) {
  const base = emptyAssessmentByLevel();
  const firstId = structure.A[0]?.id;
  if (!firstId) return base;
  base["базовый"].plan[firstId] = ["testing"];
  base["базовый"].tasks = [
    {
      id: "task-1",
      method: "testing",
      itemType: "single",
      prompt: "Вопрос по знаниям",
      context: "",
      roles: "",
      product: "",
      options: [
        { id: "o1", text: "Верно", isCorrect: true },
        { id: "o2", text: "Неверно", isCorrect: false },
      ],
      criteria: "Правильный ответ",
      componentIds: [firstId],
      forNok: false,
      attachments: [],
    },
  ];
  return syncAssessmentByLevel(structure, base);
}

describe("сохранение черновика конструктора (шаги 1–7)", () => {
  it("шаг 1: общая информация переживает save→reload", () => {
    const draft = emptyWizardDraft({
      wizard_step: 1,
      name: "RUS-PK-0044 Тестовая компетенция",
      description: "Краткое описание результата",
      professional_area_code: "14",
      education_kind: "профессиональное образование",
      education_level: "высшее образование - бакалавриат",
    });

    const reloaded = saveAndReloadWizardDraft(draft);

    expect(reloaded.wizard_step).toBe(1);
    expect(reloaded.name).toBe(draft.name);
    expect(reloaded.description).toBe(draft.description);
    expect(reloaded.professional_area_code).toBe("14");
    expect(reloaded.education_level).toContain("бакалавриат");
  });

  it("шаг 2–3: структура A/B/C и стабильные id после пересборки", () => {
    const structure = structureFromTf();
    expect(structure.A.length).toBeGreaterThan(0);
    expect(structure.B.length).toBeGreaterThan(0);

    const idsBefore = [...structure.A, ...structure.B].map((item) => item.id);
    const rebuilt = structureFromTf(structure);
    const idsAfter = [...rebuilt.A, ...rebuilt.B].map((item) => item.id);

    expect(idsAfter).toEqual(idsBefore);

    const payload = structureToPayload(structure);
    const hydrated = structureFromPayload(payload as Record<string, unknown>);
    expect(hydrated.A.map((item) => item.id)).toEqual(structure.A.map((item) => item.id));
    expect(hydrated.A.map((item) => item.text)).toEqual(structure.A.map((item) => item.text));
  });

  it("шаг 4: дескрипторы сохраняются целиком", () => {
    const draft = emptyWizardDraft({
      wizard_step: 4,
      descriptors: {
        A: { базовый: "Знает базово", продвинутый: "Знает углублённо", экспертный: "Знает экспертно" },
        B: { базовый: "Умеет базово", продвинутый: "Умеет углублённо", экспертный: "Умеет экспертно" },
        C: { базовый: "Делает базово", продвинутый: "Делает углублённо", экспертный: "Делает экспертно" },
      },
    });

    const reloaded = saveAndReloadWizardDraft(draft);
    expect(reloaded.descriptors).toEqual(draft.descriptors);
  });

  it("шаг 5: привязки к дисциплинам не теряются после save→rebuild→sync", () => {
    const structure = structureFromTf();
    const disciplineMapping = mapDisciplines(structure);
    const filledBefore = flattenDisciplineMapping(disciplineMapping).filter((row) =>
      String(row.discipline || "").trim(),
    );
    expect(filledBefore.length).toBeGreaterThan(0);

    const draft = emptyWizardDraft({
      wizard_step: 5,
      structure,
      disciplineMapping,
      laborFunctions: [SAMPLE_TF],
    });

    const reloaded = saveAndReloadWizardDraft(draft);
    const filledAfter = flattenDisciplineMapping(reloaded.disciplineMapping).filter((row) =>
      String(row.discipline || "").trim(),
    );

    expect(filledAfter.length).toBe(filledBefore.length);
    for (const row of filledBefore) {
      const match = filledAfter.find(
        (item) =>
          item.text === row.text &&
          item.category === row.category &&
          item.discipline === row.discipline,
      );
      expect(match, `потеряна привязка: ${row.component} → ${row.discipline}`).toBeTruthy();
      expect(match?.importance).toBe(row.importance);
      expect(match?.volume).toBe(row.volume);
      expect(match?.control).toBe(row.control);
    }
  });

  it("шаг 5 (регрессия): привязки живут даже если id компонентов сменились", () => {
    const structure = structureFromTf();
    const disciplineMapping = mapDisciplines(structure);

    // Имитация старого бага: в payload id не было / пришли новые si-*
    const payload = buildWizardPersistPayload(
      emptyWizardDraft({
        wizard_step: 5,
        structure,
        disciplineMapping,
        laborFunctions: [SAMPLE_TF],
      }),
    );
    const structureWithoutStableIds = {
      A: (payload.structure.A || []).map((row) => {
        const r = row as { text?: string; tfCode?: string; tdText?: string; origin?: string };
        return { text: r.text, tfCode: r.tfCode, tdText: r.tdText, origin: r.origin };
      }),
      B: (payload.structure.B || []).map((row) => {
        const r = row as { text?: string; tfCode?: string; tdText?: string; origin?: string };
        return { text: r.text, tfCode: r.tfCode, tdText: r.tdText, origin: r.origin };
      }),
      C: [],
    };
    payload.structure = structureWithoutStableIds as typeof payload.structure;
    // discipline rows тоже с «чужими» id
    payload.discipline_mapping = payload.discipline_mapping.map((row) => ({
      ...row,
      id: createStructureItemId(),
    }));

    const reloaded = reloadWizardDraftFromPayload(payload, [SAMPLE_TF]);
    const filled = flattenDisciplineMapping(reloaded.disciplineMapping).filter((row) =>
      String(row.discipline || "").trim(),
    );
    expect(filled.length).toBe(disciplineMapping.filter((row) => row.bindings[0]?.discipline).length);
  });

  it("шаг 6: оценочные средства привязаны к компонентам после reload", () => {
    const structure = structureFromTf();
    const assessmentByLevel = withAssessment(structure);
    const draft = emptyWizardDraft({
      wizard_step: 6,
      structure,
      assessmentByLevel,
      laborFunctions: [SAMPLE_TF],
    });

    const before = flattenAssessmentTools(assessmentByLevel, structure);
    expect(before.length).toBe(1);

    const reloaded = saveAndReloadWizardDraft(draft);
    const after = flattenAssessmentTools(reloaded.assessmentByLevel, reloaded.structure);

    expect(after.length).toBe(1);
    expect(after[0].prompt).toBe("Вопрос по знаниям");
    expect(after[0].component_texts).toContain(structure.A[0].text);
    expect(after[0].component_ids.length).toBe(1);
  });

  it("шаг 7: МТО по блокам A/B/C сохраняется", () => {
    const draft = emptyWizardDraft({
      wizard_step: 7,
      resources: {
        A: ["Учебник по охране труда"],
        B: ["Навигатор Garmin"],
        C: ["Пожарный водоём (учебный полигон)"],
      },
    });

    const reloaded = saveAndReloadWizardDraft(draft);
    expect(reloaded.resources.A).toEqual(["Учебник по охране труда"]);
    expect(reloaded.resources.B).toEqual(["Навигатор Garmin"]);
    expect(reloaded.resources.C).toEqual(["Пожарный водоём (учебный полигон)"]);
  });

  it("сквозной прогон: последовательное сохранение шагов 1→7 не затирает данные предыдущих", () => {
    let draft = emptyWizardDraft({
      wizard_step: 1,
      name: "Компетенция сквозного теста",
      description: "Описание",
      professional_area_code: "14",
      laborFunctions: [SAMPLE_TF],
    });
    draft = saveAndReloadWizardDraft(draft);

    const structure = structureFromTf();
    draft = saveAndReloadWizardDraft({
      ...draft,
      wizard_step: 3,
      structure,
    });
    expect(draft.structure.A.map((item) => item.text)).toEqual(structure.A.map((item) => item.text));

    draft = saveAndReloadWizardDraft({
      ...draft,
      wizard_step: 4,
      descriptors: {
        A: { базовый: "A1", продвинутый: "A2", экспертный: "A3" },
        B: { базовый: "B1", продвинутый: "B2", экспертный: "B3" },
        C: { базовый: "C1", продвинутый: "C2", экспертный: "C3" },
      },
    });

    const disciplineMapping = mapDisciplines(draft.structure);
    draft = saveAndReloadWizardDraft({
      ...draft,
      wizard_step: 5,
      disciplineMapping,
    });
    expect(flattenDisciplineMapping(draft.disciplineMapping).filter((r) => r.discipline).length).toBeGreaterThan(0);

    draft = saveAndReloadWizardDraft({
      ...draft,
      wizard_step: 6,
      assessmentByLevel: withAssessment(draft.structure),
    });
    expect(flattenAssessmentTools(draft.assessmentByLevel, draft.structure).length).toBe(1);

    draft = saveAndReloadWizardDraft({
      ...draft,
      wizard_step: 7,
      resources: { A: ["Ресурс A"], B: ["Ресурс B"], C: ["Ресурс C"] },
    });

    // Финальная проверка: всё ещё на месте после последнего save
    expect(draft.name).toBe("Компетенция сквозного теста");
    expect(draft.descriptors.A.базовый).toBe("A1");
    expect(flattenDisciplineMapping(draft.disciplineMapping).some((r) => r.discipline)).toBe(true);
    expect(flattenAssessmentTools(draft.assessmentByLevel, draft.structure)[0]?.prompt).toBe(
      "Вопрос по знаниям",
    );
    expect(draft.resources).toEqual({ A: ["Ресурс A"], B: ["Ресурс B"], C: ["Ресурс C"] });
    expect(draft.wizard_step).toBe(7);
  });
});
