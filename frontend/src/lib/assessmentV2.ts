/**
 * Оценочные средства v2 (шаг 6.1):
 * - уровни базовый / продвинутый / экспертный сохраняются;
 * - компоненты A (знания) — тесты в той же структуре, что шаг 6 (AssessmentTask / testing);
 * - B и C сначала компонуются в задания по дереву ТФ–ТД–У,
 *   затем для каждого задания заполняется практическая форма.
 * - число заданий можно считать завершённым, когда все B/C включены.
 */
import { FORMATION_LEVELS, type FormationLevel } from "@/lib/competenceMappers";
import type { StructureABC, StructureItem } from "@/lib/structureFromLaborFunctions";
import {
  assessmentMethodLabel,
  assessmentTaskHasContent,
  createAssessmentTaskId,
  emptyAssessmentTask,
  isAssessmentTaskComplete,
  isCustomAssessmentMethodId,
  normalizeAssessmentByLevel,
  normalizeAssessmentTask,
  type AssessmentByLevel,
  type AssessmentMethodId,
  type AssessmentTask,
} from "@/lib/assessmentConstructor";

/** Методы шага 6, которые переносятся в практические задания 6.1. */
const PRACTICAL_V1_METHODS = new Set<AssessmentMethodId | string>([
  "case",
  "practical",
  "business_game",
  "project",
]);

function isPracticalV1Method(method: AssessmentMethodId | string): boolean {
  return PRACTICAL_V1_METHODS.has(method) || isCustomAssessmentMethodId(String(method));
}

/** Тест шага 6.1 = то же задание testing, что и на шаге 6 (ровно одно знание A). */
export type AssessmentV2TestItem = AssessmentTask;

export type AssessmentV2PracticalTask = {
  id: string;
  /** Наименование задания («Задание 1») */
  name: string;
  prompt: string;
  instruction: string;
  description: string;
  location: string;
  /** id компонентов B/C, входящих в задание */
  componentIds: string[];
  criteria: string[];
};

export type AssessmentV2LevelBlock = {
  tests: AssessmentV2TestItem[];
  practicalTasks: AssessmentV2PracticalTask[];
  /** Компоновка B/C завершена (все компоненты распределены) */
  compositionDone: boolean;
};

export type AssessmentByLevelV2 = Record<FormationLevel, AssessmentV2LevelBlock>;

export type PracticalComponent = StructureItem & {
  category: "B" | "C";
  code: string;
};

export type TfTdTreeLeaf = PracticalComponent;

export type TfTdTreeTd = {
  key: string;
  tdText: string;
  items: TfTdTreeLeaf[];
};

export type TfTdTreeTf = {
  key: string;
  tfCode: string;
  tds: TfTdTreeTd[];
};

let seq = 0;
const nid = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

export function emptyAssessmentV2Level(): AssessmentV2LevelBlock {
  return { tests: [], practicalTasks: [], compositionDone: false };
}

export function emptyAssessmentByLevelV2(): AssessmentByLevelV2 {
  return {
    базовый: emptyAssessmentV2Level(),
    продвинутый: emptyAssessmentV2Level(),
    экспертный: emptyAssessmentV2Level(),
  };
}

export function normalizeAssessmentByLevelV2(raw: unknown): AssessmentByLevelV2 {
  const base = emptyAssessmentByLevelV2();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  for (const level of FORMATION_LEVELS) {
    const block = row[level];
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    base[level] = {
      tests: Array.isArray(b.tests) ? b.tests.map(normalizeTest) : [],
      practicalTasks: Array.isArray(b.practicalTasks)
        ? (b.practicalTasks as AssessmentV2PracticalTask[]).map(normalizePractical)
        : Array.isArray(b.practical_tasks)
          ? (b.practical_tasks as AssessmentV2PracticalTask[]).map(normalizePractical)
          : [],
      compositionDone: Boolean(b.compositionDone ?? b.composition_done),
    };
  }
  return base;
}

function normalizeTest(raw: unknown): AssessmentV2TestItem {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  // Старый формат 6.1: { componentId, prompt, options, criteria }
  const legacyComponentId = String(row.componentId || row.component_id || "");
  const componentIds = Array.isArray(row.componentIds)
    ? row.componentIds.map((id) => String(id))
    : Array.isArray(row.component_ids)
      ? (row.component_ids as unknown[]).map((id) => String(id))
      : legacyComponentId
        ? [legacyComponentId]
        : [];
  // Как на шаге 6: один тест = ровно одно знание A
  const singleId = componentIds[0] ? [componentIds[0]] : [];
  return {
    ...normalizeAssessmentTask({ ...row, method: "testing", componentIds: singleId }, "testing"),
    method: "testing",
    componentIds: singleId,
    planKey: singleId[0] ? `testing:${singleId[0]}` : undefined,
  };
}

function isTestAuthored(test: AssessmentV2TestItem): boolean {
  if (test.prompt.trim()) return true;
  if (test.criteria.trim()) return true;
  if ((test.options || []).some((o) => o.text.trim())) return true;
  return false;
}

function knowledgeIdsOf(structure: StructureABC): Set<string> {
  return new Set(listKnowledgeComponents(structure).map((item) => item.id));
}

function rawTestKnowledgeIds(raw: unknown, knowledgeIds: Set<string>): string[] {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacy = String(row.componentId || row.component_id || "");
  if (Array.isArray(row.componentIds)) {
    return row.componentIds.map(String).filter((id) => knowledgeIds.has(id));
  }
  if (Array.isArray(row.component_ids)) {
    return (row.component_ids as unknown[]).map(String).filter((id) => knowledgeIds.has(id));
  }
  return legacy && knowledgeIds.has(legacy) ? [legacy] : [];
}

/**
 * Как buildPlanSlots(testing) на шаге 6: ровно один тест на каждый компонент A.
 * Мультипривязки разрезаются; при дублях остаётся более заполненный вариант.
 */
export function oneTestPerKnowledge(
  structure: StructureABC,
  tests: AssessmentV2TestItem[],
): AssessmentV2TestItem[] {
  const knowledge = listKnowledgeComponents(structure);
  const knowledgeIds = new Set(knowledge.map((item) => item.id));
  const byComponent = new Map<string, AssessmentV2TestItem>();

  const prefer = (next: AssessmentV2TestItem, prev: AssessmentV2TestItem | undefined) => {
    if (!prev) return next;
    if (isTestAuthored(next) && !isTestAuthored(prev)) return next;
    if (isTestAuthored(prev) && !isTestAuthored(next)) return prev;
    return prev;
  };

  for (const raw of tests || []) {
    const base = normalizeTest(raw);
    const sourceIds = rawTestKnowledgeIds(raw, knowledgeIds);
    if (!sourceIds.length) continue;

    sourceIds.forEach((componentId, index) => {
      const task: AssessmentV2TestItem = {
        ...base,
        id: index === 0 ? base.id : createAssessmentTaskId(),
        method: "testing",
        componentIds: [componentId],
        planKey: `testing:${componentId}`,
      };
      byComponent.set(componentId, prefer(task, byComponent.get(componentId)));
    });
  }

  return knowledge.map(
    (item) =>
      byComponent.get(item.id) || emptyAssessmentTask("testing", [item.id], `testing:${item.id}`),
  );
}

function isPracticalAuthored(task: AssessmentV2PracticalTask): boolean {
  if (task.prompt.trim() || task.description.trim() || task.instruction.trim()) return true;
  if (task.location.trim()) return true;
  return (task.criteria || []).some((item) => String(item || "").trim());
}

function splitCriteriaLines(raw: string): string[] {
  const text = String(raw || "").trim();
  if (!text) return [""];
  const parts = text
    .split(/\n+|;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}

/** Одно задание шага 6 (кейс/практика/игра/проект) → карточка практики 6.1. */
export function mapV1TaskToV2Practical(
  task: AssessmentTask,
  index: number,
  practicalIds: Set<string>,
): AssessmentV2PracticalTask | null {
  const componentIds = (task.componentIds || []).filter((id) => practicalIds.has(id));
  if (!componentIds.length) return null;
  const methodLabel = assessmentMethodLabel(task.method);
  const name =
    methodLabel && methodLabel !== task.method
      ? `${methodLabel} ${index}`
      : `Задание ${index}`;
  const description = String(task.context || "").trim();
  const prompt = String(task.prompt || "").trim();
  const instruction =
    String(task.roles || "").trim() || String(task.product || "").trim();
  return {
    id: String(task.id || nid("p")),
    name,
    prompt,
    instruction,
    description,
    location: "",
    componentIds,
    criteria: splitCriteriaLines(task.criteria),
  };
}

/**
 * Жадный импорт практики шага 6 → 6.1:
 * 1 задание v1 = 1 задание v2; B/C без пересечений (первый забирает компонент).
 * Незатронутые B/C остаются для ручной компоновки; compositionDone не выставляем в true.
 */
export function importPracticalTasksFromV1(
  structure: StructureABC,
  v1Tasks: AssessmentTask[],
): AssessmentV2PracticalTask[] {
  const practicalIds = new Set(listPracticalComponents(structure).map((item) => item.id));
  const candidates = (v1Tasks || [])
    .filter((task) => isPracticalV1Method(task.method))
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => (task.componentIds || []).some((id) => practicalIds.has(id)))
    .sort((left, right) => {
      const completeL = isAssessmentTaskComplete(left.task) ? 1 : 0;
      const completeR = isAssessmentTaskComplete(right.task) ? 1 : 0;
      if (completeL !== completeR) return completeR - completeL;
      const contentL = assessmentTaskHasContent(left.task) ? 1 : 0;
      const contentR = assessmentTaskHasContent(right.task) ? 1 : 0;
      if (contentL !== contentR) return contentR - contentL;
      const sizeL = left.task.componentIds.filter((id) => practicalIds.has(id)).length;
      const sizeR = right.task.componentIds.filter((id) => practicalIds.has(id)).length;
      if (sizeL !== sizeR) return sizeR - sizeL;
      return left.index - right.index;
    });

  const used = new Set<string>();
  const out: AssessmentV2PracticalTask[] = [];
  let seq = 0;
  for (const { task } of candidates) {
    const freeIds = task.componentIds.filter((id) => practicalIds.has(id) && !used.has(id));
    if (!freeIds.length) continue;
    if (!assessmentTaskHasContent(task) && !isAssessmentTaskComplete(task)) continue;
    seq += 1;
    const mapped = mapV1TaskToV2Practical({ ...task, componentIds: freeIds }, seq, practicalIds);
    if (!mapped) continue;
    freeIds.forEach((id) => used.add(id));
    out.push(mapped);
  }
  return out;
}

/** Импорт testing-заданий шага 6 → тесты 6.1 (если в 6.1 ещё нет заполненных тестов). */
export function seedAssessmentV2TestsFromV1(
  structure: StructureABC,
  assessmentByLevel: AssessmentByLevel,
  existingV2: AssessmentByLevelV2,
): AssessmentByLevelV2 {
  const v1 = normalizeAssessmentByLevel(assessmentByLevel);
  const synced = syncAssessmentByLevelV2(structure, existingV2);
  const next = emptyAssessmentByLevelV2();

  for (const level of FORMATION_LEVELS) {
    const current = synced[level];
    if (current.tests.some(isTestAuthored)) {
      next[level] = current;
      continue;
    }
    const imported = (v1[level]?.tasks || []).filter((task) => task.method === "testing");
    if (!imported.length) {
      next[level] = current;
      continue;
    }

    next[level] = {
      ...current,
      tests: oneTestPerKnowledge(structure, imported),
    };
  }
  return next;
}

/** Импорт кейсов/практики/игр/проектов шага 6 → практика 6.1 (если практика 6.1 пуста). */
export function seedAssessmentV2PracticalFromV1(
  structure: StructureABC,
  assessmentByLevel: AssessmentByLevel,
  existingV2: AssessmentByLevelV2,
): AssessmentByLevelV2 {
  const v1 = normalizeAssessmentByLevel(assessmentByLevel);
  const synced = syncAssessmentByLevelV2(structure, existingV2);
  const next = emptyAssessmentByLevelV2();

  for (const level of FORMATION_LEVELS) {
    const current = synced[level];
    if (current.practicalTasks.some(isPracticalAuthored)) {
      next[level] = current;
      continue;
    }
    const imported = importPracticalTasksFromV1(structure, v1[level]?.tasks || []);
    if (!imported.length) {
      next[level] = current;
      continue;
    }
    const coverage = practicalCoverage(structure, imported);
    next[level] = {
      ...current,
      practicalTasks: imported,
      // Даже при 100% охвате не форсим «готово» — пользователь подтверждает компоновку
      compositionDone: Boolean(current.compositionDone) && coverage.complete,
    };
  }
  return next;
}

/** Полный сид 6 → 6.1: тесты A и практика B/C. */
export function seedAssessmentV2FromV1(
  structure: StructureABC,
  assessmentByLevel: AssessmentByLevel,
  existingV2: AssessmentByLevelV2,
): AssessmentByLevelV2 {
  const withTests = seedAssessmentV2TestsFromV1(structure, assessmentByLevel, existingV2);
  return seedAssessmentV2PracticalFromV1(structure, assessmentByLevel, withTests);
}

/**
 * Обратная синхронизация: тесты 6.1 подставляются в шаг 6 как method=testing,
 * не затрагивая кейсы/практику и testing по B.
 */
export function applyV2TestsToAssessmentByLevel(
  structure: StructureABC,
  assessmentByLevel: AssessmentByLevel,
  assessmentV2: AssessmentByLevelV2,
): AssessmentByLevel {
  const knowledgeIds = knowledgeIdsOf(structure);
  const v1 = normalizeAssessmentByLevel(assessmentByLevel);
  const v2 = normalizeAssessmentByLevelV2(assessmentV2);
  const next = emptyAssessmentByLevelFrom(v1);

  for (const level of FORMATION_LEVELS) {
    const block = v1[level];
    const fromV2 = oneTestPerKnowledge(structure, v2[level]?.tests || []).filter(
      (task) => isTestAuthored(task) && task.componentIds.some((id) => knowledgeIds.has(id)),
    );
    // Пустые заготовки 6.1 не затирают уже заполненные тесты шага 6
    if (!fromV2.length) {
      next[level] = block;
      continue;
    }
    const keep = block.tasks.filter((task) => {
      if (task.method !== "testing") return true;
      // testing по знаниям A заменяется пакетом из 6.1
      return !task.componentIds.some((id) => knowledgeIds.has(id));
    });
    next[level] = {
      ...block,
      tasks: [...keep, ...fromV2],
    };
  }
  return next;
}

function emptyAssessmentByLevelFrom(source: AssessmentByLevel): AssessmentByLevel {
  return {
    базовый: { ...source.базовый, tasks: [...source.базовый.tasks] },
    продвинутый: { ...source.продвинутый, tasks: [...source.продвинутый.tasks] },
    экспертный: { ...source.экспертный, tasks: [...source.экспертный.tasks] },
  };
}

function normalizePractical(raw: AssessmentV2PracticalTask & { groupKey?: string; tfCode?: string; tdText?: string }): AssessmentV2PracticalTask {
  const criteria = Array.isArray(raw?.criteria)
    ? raw.criteria.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  const name = String(raw?.name || "").trim();
  return {
    id: String(raw?.id || nid("p")),
    name: name || "Задание",
    prompt: String(raw?.prompt || ""),
    instruction: String(raw?.instruction || ""),
    description: String(raw?.description || ""),
    location: String(raw?.location || ""),
    componentIds: Array.isArray(raw?.componentIds)
      ? raw.componentIds.map((id) => String(id))
      : [],
    criteria: criteria.length ? criteria : [""],
  };
}

export function listKnowledgeComponents(structure: StructureABC) {
  return structure.A.filter((item) => item.text.trim()).map((item, index) => ({
    ...item,
    category: "A" as const,
    code: `A${index + 1}`,
  }));
}

/** Компоненты B и C для компоновки практических заданий. */
export function listPracticalComponents(structure: StructureABC): PracticalComponent[] {
  const out: PracticalComponent[] = [];
  structure.B.forEach((item, index) => {
    if (!item.text.trim()) return;
    out.push({ ...item, category: "B", code: `B${index + 1}` });
  });
  structure.C.forEach((item, index) => {
    if (!item.text.trim()) return;
    out.push({ ...item, category: "C", code: `C${index + 1}` });
  });
  return out;
}

/** Дерево ТФ → ТД → умения/навыки (B/C) для шага компоновки. */
export function buildPracticalTree(structure: StructureABC): TfTdTreeTf[] {
  const components = listPracticalComponents(structure);
  const tfMap = new Map<string, Map<string, PracticalComponent[]>>();

  for (const item of components) {
    const tfCode = String(item.tfCode || "").trim() || "—";
    const tdText = String(item.tdText || "").trim() || "Без ТД";
    if (!tfMap.has(tfCode)) tfMap.set(tfCode, new Map());
    const tdMap = tfMap.get(tfCode)!;
    if (!tdMap.has(tdText)) tdMap.set(tdText, []);
    tdMap.get(tdText)!.push(item);
  }

  return [...tfMap.entries()].map(([tfCode, tdMap]) => ({
    key: tfCode,
    tfCode,
    tds: [...tdMap.entries()].map(([tdText, items]) => ({
      key: `${tfCode}||${tdText}`,
      tdText,
      items,
    })),
  }));
}

export function usedComponentIds(tasks: AssessmentV2PracticalTask[]): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    for (const id of task.componentIds) ids.add(id);
  }
  return ids;
}

export function practicalCoverage(structure: StructureABC, tasks: AssessmentV2PracticalTask[]) {
  const all = listPracticalComponents(structure);
  const used = usedComponentIds(tasks);
  const uncovered = all.filter((item) => !used.has(item.id));
  const covered = all.length - uncovered.length;
  return {
    total: all.length,
    covered,
    uncovered,
    complete: all.length > 0 && uncovered.length === 0,
    percent: all.length === 0 ? 0 : Math.round((100 * covered) / all.length),
  };
}

function testHasPrompt(test: AssessmentV2TestItem) {
  return Boolean(test.prompt?.trim());
}

function testHasAnswer(test: AssessmentV2TestItem) {
  if (test.itemType === "open") return testHasPrompt(test);
  return (test.options || []).some((o) => o.isCorrect && String(o.text || "").trim());
}

function testCoversComponent(test: AssessmentV2TestItem, componentId: string) {
  return (test.componentIds || []).includes(componentId);
}

/** Сводка панели «Теория» (только знания A → тесты). */
export function theoryDashboardStats(structure: StructureABC, tests: AssessmentV2TestItem[]) {
  const knowledge = listKnowledgeComponents(structure);
  const quantity = knowledge.length;
  const rows = knowledge.map((item) => {
    const covering = tests.filter((t) => testCoversComponent(t, item.id));
    const authored = covering.find((t) => testHasPrompt(t));
    return authored || covering[0] || null;
  });
  const created = rows.filter((t) => t && testHasPrompt(t)).length;
  const withAnswers = rows.filter((t) => t && testHasPrompt(t) && testHasAnswer(t)).length;
  const withoutAnswers = rows.filter((t) => t && testHasPrompt(t) && !testHasAnswer(t)).length;
  const incomplete = quantity - created;
  return {
    quantity,
    created,
    withAnswers,
    withoutAnswers,
    incomplete,
    percent: quantity === 0 ? 0 : Math.round((100 * created) / quantity),
  };
}

/** Сводка панели «Практика» (задания и охват B/C). */
export function practiceDashboardStats(structure: StructureABC, tasks: AssessmentV2PracticalTask[]) {
  const coverage = practicalCoverage(structure, tasks);
  return {
    tasks: tasks.map((task, index) => ({
      id: task.id,
      name: task.name?.trim() || `Задание ${index + 1}`,
      variants: 1,
      skills: task.componentIds.length,
    })),
    coverage,
  };
}

export function createPracticalTask(index: number): AssessmentV2PracticalTask {
  return {
    id: nid("p"),
    name: `Задание ${index}`,
    prompt: "",
    instruction: "",
    description: "",
    location: "",
    componentIds: [],
    criteria: [""],
  };
}

/** Назначить компоненты текущему заданию; убрать их из остальных (исключительное владение). */
export function assignComponentsToTask(
  tasks: AssessmentV2PracticalTask[],
  taskId: string,
  componentIds: string[],
): AssessmentV2PracticalTask[] {
  const selected = new Set(componentIds);
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, componentIds: [...selected] };
    }
    return {
      ...task,
      componentIds: task.componentIds.filter((id) => !selected.has(id)),
    };
  });
}

export function toggleComponentInTask(
  tasks: AssessmentV2PracticalTask[],
  taskId: string,
  componentId: string,
  checked: boolean,
): AssessmentV2PracticalTask[] {
  const current = tasks.find((t) => t.id === taskId);
  if (!current) return tasks;
  const nextIds = checked
    ? [...new Set([...current.componentIds, componentId])]
    : current.componentIds.filter((id) => id !== componentId);
  return assignComponentsToTask(tasks, taskId, nextIds);
}

/** Подтянуть тесты A; сохранить компоновку B/C, отбросив устаревшие id. */
export function syncAssessmentByLevelV2(
  structure: StructureABC,
  existing: AssessmentByLevelV2,
): AssessmentByLevelV2 {
  const validPracticalIds = new Set(listPracticalComponents(structure).map((item) => item.id));
  const next = emptyAssessmentByLevelV2();

  for (const level of FORMATION_LEVELS) {
    const prev = existing[level] || emptyAssessmentV2Level();
    const practicalTasks = (prev.practicalTasks || []).map((task, index) => ({
      ...normalizePractical(task),
      name: String(task.name || "").trim() || `Задание ${index + 1}`,
      componentIds: (task.componentIds || []).filter((id) => validPracticalIds.has(id)),
    }));
    const coverage = practicalCoverage(structure, practicalTasks);

    next[level] = {
      tests: oneTestPerKnowledge(structure, prev.tests || []),
      practicalTasks,
      compositionDone: Boolean(prev.compositionDone) && coverage.complete,
    };
  }
  return next;
}

export type AssessmentToolsV2Payload = {
  version: 2;
  by_level: AssessmentByLevelV2;
};

export function flattenAssessmentToolsV2(byLevel: AssessmentByLevelV2): AssessmentToolsV2Payload {
  return {
    version: 2,
    by_level: normalizeAssessmentByLevelV2(byLevel),
  };
}

export function assessmentToolsV2ToByLevel(raw: unknown, structure: StructureABC): AssessmentByLevelV2 {
  if (!raw) return syncAssessmentByLevelV2(structure, emptyAssessmentByLevelV2());
  if (typeof raw === "object" && raw && "by_level" in (raw as object)) {
    return syncAssessmentByLevelV2(
      structure,
      normalizeAssessmentByLevelV2((raw as AssessmentToolsV2Payload).by_level),
    );
  }
  return syncAssessmentByLevelV2(structure, normalizeAssessmentByLevelV2(raw));
}

export function createOption(isCorrect = false) {
  const opt = emptyAssessmentTask("testing").options[0];
  return { ...opt, id: nid("o"), text: "", isCorrect };
}

/** @deprecated kept for preview helpers that still reference TF–TD labels */
export function listTfTdGroups(structure: StructureABC) {
  const tree = buildPracticalTree(structure);
  return tree.flatMap((tf) =>
    tf.tds.map((td) => ({
      key: td.key,
      tfCode: tf.tfCode,
      tdText: td.tdText,
      label: tf.tfCode === "—" ? td.tdText : `${tf.tfCode} · ${td.tdText}`,
      items: td.items,
    })),
  );
}
