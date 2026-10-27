import { describe, expect, it } from "vitest";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";
import {
  emptyAssessmentByLevel,
  emptyAssessmentTask,
  type AssessmentByLevel,
} from "@/lib/assessmentConstructor";
import {
  applyV2TestsToAssessmentByLevel,
  assessmentToolsV2ToByLevel,
  assignComponentsToTask,
  buildPracticalTree,
  createPracticalTask,
  emptyAssessmentByLevelV2,
  flattenAssessmentToolsV2,
  importPracticalTasksFromV1,
  listKnowledgeComponents,
  listPracticalComponents,
  practicalCoverage,
  seedAssessmentV2FromV1,
  seedAssessmentV2PracticalFromV1,
  seedAssessmentV2TestsFromV1,
  syncAssessmentByLevelV2,
  toggleComponentInTask,
} from "@/lib/assessmentV2";

const structure: StructureABC = {
  A: [{ id: "a1", text: "Знание норм", tfCode: "A/01.4", tdText: "ТД1" }],
  B: [
    { id: "b1", text: "Умение 1", tfCode: "A/01.4", tdText: "ТД1" },
    { id: "b2", text: "Умение 2", tfCode: "A/01.4", tdText: "ТД2" },
  ],
  C: [{ id: "c1", text: "Навык 1", tfCode: "A/01.4", tdText: "ТД1" }],
};

describe("assessmentV2", () => {
  it("lists knowledge as A-only and builds TF–TD tree for B/C", () => {
    const knowledge = listKnowledgeComponents(structure);
    const practical = listPracticalComponents(structure);
    const tree = buildPracticalTree(structure);
    expect(knowledge.map((item) => item.code)).toEqual(["A1"]);
    expect(practical.map((item) => item.code).sort()).toEqual(["B1", "B2", "C1"]);
    expect(tree).toHaveLength(1);
    expect(tree[0].tds).toHaveLength(2);
  });

  it("syncs tests for A and keeps empty practical composition until authored", () => {
    const synced = syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
    expect(synced.базовый.tests).toHaveLength(1);
    expect(synced.базовый.tests[0].componentIds).toEqual(["a1"]);
    expect(synced.базовый.tests[0].method).toBe("testing");
    expect(synced.базовый.practicalTasks).toHaveLength(0);
    expect(synced.базовый.compositionDone).toBe(false);
  });

  it("requires all B/C components before composition is complete", () => {
    let tasks = [createPracticalTask(1), createPracticalTask(2)];
    tasks = toggleComponentInTask(tasks, tasks[0].id, "b1", true);
    tasks = toggleComponentInTask(tasks, tasks[0].id, "c1", true);
    expect(practicalCoverage(structure, tasks).complete).toBe(false);

    tasks = assignComponentsToTask(tasks, tasks[1].id, ["b2"]);
    expect(practicalCoverage(structure, tasks).complete).toBe(true);
    expect(tasks[0].componentIds.sort()).toEqual(["b1", "c1"]);
    expect(tasks[1].componentIds).toEqual(["b2"]);
  });

  it("preserves authored text across structure sync and round-trip", () => {
    const base = syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
    base.базовый.tests[0].prompt = "Вопрос A";
    base.базовый.tests[0].itemType = "multiple";
    const task = createPracticalTask(1);
    task.componentIds = ["b1", "b2", "c1"];
    task.prompt = "Практика";
    task.criteria = ["Критерий 1"];
    base.базовый.practicalTasks = [task];
    base.базовый.compositionDone = true;

    const payload = flattenAssessmentToolsV2(base);
    const restored = assessmentToolsV2ToByLevel(payload, structure);
    expect(restored.базовый.tests[0].prompt).toBe("Вопрос A");
    expect(restored.базовый.tests[0].itemType).toBe("multiple");
    expect(restored.базовый.practicalTasks[0].prompt).toBe("Практика");
    expect(restored.базовый.practicalTasks[0].componentIds.sort()).toEqual(["b1", "b2", "c1"]);
    expect(restored.базовый.compositionDone).toBe(true);
  });

  it("seeds testing tasks from step 6 into 6.1 when v2 tests are empty", () => {
    const v1: AssessmentByLevel = emptyAssessmentByLevel();
    const testing = emptyAssessmentTask("testing", ["a1"]);
    testing.prompt = "Вопрос из шага 6";
    testing.itemType = "open";
    testing.criteria = "Полный ответ";
    v1.базовый.tasks = [testing];

    const seeded = seedAssessmentV2TestsFromV1(structure, v1, emptyAssessmentByLevelV2());
    expect(seeded.базовый.tests).toHaveLength(1);
    expect(seeded.базовый.tests[0].prompt).toBe("Вопрос из шага 6");
    expect(seeded.базовый.tests[0].itemType).toBe("open");
    expect(seeded.базовый.tests[0].criteria).toBe("Полный ответ");
    expect(seeded.базовый.tests[0].componentIds).toEqual(["a1"]);
  });

  it("does not overwrite authored 6.1 tests when seeding from step 6", () => {
    const v1: AssessmentByLevel = emptyAssessmentByLevel();
    const testing = emptyAssessmentTask("testing", ["a1"]);
    testing.prompt = "Старый шаг 6";
    v1.базовый.tasks = [testing];

    const v2 = syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
    v2.базовый.tests[0].prompt = "Уже в 6.1";

    const seeded = seedAssessmentV2TestsFromV1(structure, v1, v2);
    expect(seeded.базовый.tests[0].prompt).toBe("Уже в 6.1");
  });

  it("writes 6.1 tests back into step 6 assessmentByLevel", () => {
    const v1 = emptyAssessmentByLevel();
    v1.базовый.tasks = [
      { ...emptyAssessmentTask("case", ["b1"]), prompt: "Кейс" },
      { ...emptyAssessmentTask("testing", ["a1"]), prompt: "Старый тест" },
    ];
    const v2 = syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
    v2.базовый.tests[0].prompt = "Новый тест 6.1";
    v2.базовый.tests[0].itemType = "match";

    const next = applyV2TestsToAssessmentByLevel(structure, v1, v2);
    const testing = next.базовый.tasks.filter((task) => task.method === "testing");
    const cases = next.базовый.tasks.filter((task) => task.method === "case");
    expect(cases).toHaveLength(1);
    expect(cases[0].prompt).toBe("Кейс");
    expect(testing).toHaveLength(1);
    expect(testing[0].prompt).toBe("Новый тест 6.1");
    expect(testing[0].itemType).toBe("match");
  });

  it("keeps step 6 tests when 6.1 only has empty stubs", () => {
    const v1 = emptyAssessmentByLevel();
    v1.базовый.tasks = [{ ...emptyAssessmentTask("testing", ["a1"]), prompt: "Из шага 6" }];
    const v2 = syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
    const next = applyV2TestsToAssessmentByLevel(structure, v1, v2);
    expect(next.базовый.tasks.filter((task) => task.method === "testing")[0].prompt).toBe(
      "Из шага 6",
    );
  });

  it("keeps exactly one test per knowledge component (splits multi-A tests)", () => {
    const structure2: StructureABC = {
      ...structure,
      A: [
        { id: "a1", text: "Знание 1", tfCode: "A/01.4", tdText: "ТД1" },
        { id: "a2", text: "Знание 2", tfCode: "A/01.4", tdText: "ТД1" },
      ],
    };
    const multiTwo = emptyAssessmentTask("testing", ["a1", "a2"]);
    multiTwo.prompt = "На два знания";
    multiTwo.componentIds = ["a1", "a2"];

    const synced = syncAssessmentByLevelV2(structure2, {
      ...emptyAssessmentByLevelV2(),
      базовый: {
        ...emptyAssessmentByLevelV2().базовый,
        tests: [multiTwo],
      },
    });
    expect(synced.базовый.tests).toHaveLength(2);
    expect(synced.базовый.tests.every((task) => task.componentIds.length === 1)).toBe(true);
    expect(synced.базовый.tests.map((task) => task.componentIds[0]).sort()).toEqual(["a1", "a2"]);
    expect(synced.базовый.tests.every((task) => task.prompt === "На два знания")).toBe(true);
  });

  it("imports practical tasks from step 6 with exclusive B/C ownership", () => {
    const caseTask = emptyAssessmentTask("case", ["b1", "c1"]);
    caseTask.context = "Ситуация";
    caseTask.prompt = "Вопросы по кейсу";
    caseTask.criteria = "Критерий 1\nКритерий 2";
    const practical = emptyAssessmentTask("practical", ["b1", "b2"]);
    practical.context = "Условие";
    practical.prompt = "Сделать";
    practical.product = "Протокол";
    practical.criteria = "Выполнено";

    const imported = importPracticalTasksFromV1(structure, [caseTask, practical]);
    expect(imported).toHaveLength(2);
    const ids = imported.flatMap((task) => task.componentIds).sort();
    expect(ids).toEqual(["b1", "b2", "c1"]);
    expect(new Set(ids).size).toBe(3);
    expect(imported[0].description).toBe("Ситуация");
    expect(imported[0].prompt).toBe("Вопросы по кейсу");
    expect(imported[0].criteria).toEqual(["Критерий 1", "Критерий 2"]);
  });

  it("seeds practical tasks from step 6 when 6.1 practice is empty", () => {
    const v1 = emptyAssessmentByLevel();
    const caseTask = emptyAssessmentTask("case", ["b1", "b2", "c1"]);
    caseTask.context = "Кейс";
    caseTask.prompt = "Решите";
    caseTask.criteria = "Верно";
    v1.базовый.tasks = [caseTask];

    const seeded = seedAssessmentV2PracticalFromV1(structure, v1, emptyAssessmentByLevelV2());
    expect(seeded.базовый.practicalTasks).toHaveLength(1);
    expect(seeded.базовый.practicalTasks[0].componentIds.sort()).toEqual(["b1", "b2", "c1"]);
    expect(seeded.базовый.practicalTasks[0].prompt).toBe("Решите");
    expect(seeded.базовый.compositionDone).toBe(false);
  });

  it("does not overwrite authored 6.1 practical tasks when seeding", () => {
    const v1 = emptyAssessmentByLevel();
    const caseTask = emptyAssessmentTask("case", ["b1"]);
    caseTask.prompt = "Из шага 6";
    caseTask.context = "ctx";
    caseTask.criteria = "c";
    v1.базовый.tasks = [caseTask];

    const v2 = emptyAssessmentByLevelV2();
    v2.базовый.practicalTasks = [
      {
        ...createPracticalTask(1),
        prompt: "Уже в 6.1",
        componentIds: ["b2"],
      },
    ];

    const seeded = seedAssessmentV2PracticalFromV1(structure, v1, v2);
    expect(seeded.базовый.practicalTasks).toHaveLength(1);
    expect(seeded.базовый.practicalTasks[0].prompt).toBe("Уже в 6.1");
  });

  it("seedAssessmentV2FromV1 fills both tests and practical", () => {
    const v1 = emptyAssessmentByLevel();
    const testing = emptyAssessmentTask("testing", ["a1"]);
    testing.prompt = "Тест";
    testing.criteria = "ок";
    const caseTask = emptyAssessmentTask("case", ["b1"]);
    caseTask.context = "Сит";
    caseTask.prompt = "Кейс";
    caseTask.criteria = "Крит";
    v1.базовый.tasks = [testing, caseTask];

    const seeded = seedAssessmentV2FromV1(structure, v1, emptyAssessmentByLevelV2());
    expect(seeded.базовый.tests[0].prompt).toBe("Тест");
    expect(seeded.базовый.practicalTasks).toHaveLength(1);
    expect(seeded.базовый.practicalTasks[0].prompt).toBe("Кейс");
  });

  it("migrates legacy componentId test shape", () => {
    const restored = assessmentToolsV2ToByLevel(
      {
        version: 2,
        by_level: {
          базовый: {
            tests: [
              {
                id: "legacy-1",
                componentId: "a1",
                prompt: "Legacy",
                options: [
                  { id: "o1", text: "Да", isCorrect: true },
                  { id: "o2", text: "Нет", isCorrect: false },
                ],
                criteria: "",
              },
            ],
            practicalTasks: [],
            compositionDone: false,
          },
          продвинутый: { tests: [], practicalTasks: [], compositionDone: false },
          экспертный: { tests: [], practicalTasks: [], compositionDone: false },
        },
      },
      structure,
    );
    expect(restored.базовый.tests[0].componentIds).toEqual(["a1"]);
    expect(restored.базовый.tests[0].prompt).toBe("Legacy");
    expect(restored.базовый.tests[0].method).toBe("testing");
  });
});
