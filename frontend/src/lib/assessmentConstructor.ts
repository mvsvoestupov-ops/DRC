import type { FormationLevel } from "@/api/types";
import {
  DESCRIPTOR_CATEGORIES,
  FORMATION_LEVELS,
  type DescriptorCategory,
} from "@/lib/competenceMappers";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";

export type AssessmentMethodId =
  | "testing"
  | "practical"
  | "case"
  | "business_game"
  | "project";

export type TestItemType = "single" | "multiple" | "match" | "sequence" | "open";

export type AssessmentOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type AssessmentMediaKind = "image" | "pdf" | "video" | "audio";

export type AssessmentAttachment = {
  id: string;
  kind: AssessmentMediaKind;
  name: string;
  mime: string;
  url: string;
  size: number;
};

export const ASSESSMENT_MEDIA_KIND_LABELS: Record<AssessmentMediaKind, string> = {
  image: "Изображение",
  pdf: "PDF",
  video: "Видео",
  audio: "Аудио",
};

export type AssessmentTask = {
  id: string;
  method: AssessmentMethodId;
  prompt: string;
  itemType: TestItemType;
  options: AssessmentOption[];
  context: string;
  roles: string;
  product: string;
  criteria: string;
  componentIds: string[];
  forNok: boolean;
  planKey?: string;
  attachments: AssessmentAttachment[];
};

export type ComponentMethodPlan = Record<string, AssessmentMethodId[]>;

export type AssessmentLevelBlock = {
  tasks: AssessmentTask[];
  forNok: boolean;
  plan: ComponentMethodPlan;
};

export type PlanSlot = {
  planKey: string;
  method: AssessmentMethodId;
  componentIds: string[];
};

export type AssessmentByLevel = Record<FormationLevel, AssessmentLevelBlock>;

export type StructureComponent = {
  id: string;
  category: DescriptorCategory;
  code: string;
  text: string;
};

export type AssessmentMethodDef = {
  id: AssessmentMethodId;
  label: string;
  miller: string;
  recommended: DescriptorCategory[];
  suitable: DescriptorCategory[];
  short: string;
};

export const ASSESSMENT_METHODS: AssessmentMethodDef[] = [
  {
    id: "testing",
    label: "Тестирование",
    miller: "Знает",
    recommended: ["A"],
    suitable: ["A", "B"],
    short: "Закрытые и открытые вопросы к знаниям и отдельным интеллектуальным умениям.",
  },
  {
    id: "case",
    label: "Кейс-метод",
    miller: "Знает как",
    recommended: ["B"],
    suitable: ["A", "B", "C"],
    short: "Разбор профессиональной ситуации с вопросами и критериями решения.",
  },
  {
    id: "practical",
    label: "Практические задания",
    miller: "Показывает",
    recommended: ["C"],
    suitable: ["B", "C"],
    short: "Выполнение действия и оценка наблюдаемого продукта или результата.",
  },
  {
    id: "business_game",
    label: "Деловая игра",
    miller: "Показывает",
    recommended: ["B", "C"],
    suitable: ["B", "C"],
    short: "Ролевое взаимодействие в сценарии с критериями наблюдения.",
  },
  {
    id: "project",
    label: "Проектная работа",
    miller: "Делает",
    recommended: ["C"],
    suitable: ["B", "C"],
    short: "Комплексное задание в аутентичном контексте с защищаемым результатом.",
  },
];

export const TEST_ITEM_TYPES: Array<{ value: TestItemType; label: string }> = [
  { value: "single", label: "Одиночный выбор" },
  { value: "multiple", label: "Множественный выбор" },
  { value: "match", label: "Соответствие" },
  { value: "sequence", label: "Упорядочивание" },
  { value: "open", label: "Открытый вопрос" },
];

const METHOD_BY_ID = new Map(ASSESSMENT_METHODS.map((item) => [item.id, item]));
const METHOD_BY_LABEL = new Map(
  ASSESSMENT_METHODS.map((item) => [item.label.toLowerCase(), item]),
);

const LEGACY_TYPE_TO_METHOD: Record<string, AssessmentMethodId> = {
  test: "testing",
  testing: "testing",
  practical: "practical",
  case: "case",
  business_game: "business_game",
  game: "business_game",
  project: "project",
};

export function assessmentMethodDef(id: AssessmentMethodId): AssessmentMethodDef {
  return METHOD_BY_ID.get(id) || ASSESSMENT_METHODS[0];
}

export function assessmentMethodLabel(id: AssessmentMethodId): string {
  return assessmentMethodDef(id).label;
}

export function resolveAssessmentMethod(value: unknown): AssessmentMethodId | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (METHOD_BY_ID.has(raw as AssessmentMethodId)) return raw as AssessmentMethodId;
  const byType = LEGACY_TYPE_TO_METHOD[raw.toLowerCase()];
  if (byType) return byType;
  return METHOD_BY_LABEL.get(raw.toLowerCase())?.id ?? null;
}

export function recommendedMethodFor(category: DescriptorCategory): AssessmentMethodId {
  if (category === "A") return "testing";
  if (category === "B") return "case";
  return "practical";
}

export function methodFitsCategory(method: AssessmentMethodId, category: DescriptorCategory): "recommended" | "suitable" | "weak" {
  const def = assessmentMethodDef(method);
  if (def.recommended.includes(category)) return "recommended";
  if (def.suitable.includes(category)) return "suitable";
  return "weak";
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAssessmentTaskId(): string {
  return uid("at");
}

export function createAssessmentOptionId(): string {
  return uid("ao");
}

export function emptyAssessmentOption(): AssessmentOption {
  return { id: createAssessmentOptionId(), text: "", isCorrect: false };
}

export function emptyAssessmentTask(
  method: AssessmentMethodId,
  componentIds: string[] = [],
  planKey?: string,
): AssessmentTask {
  return {
    id: createAssessmentTaskId(),
    method,
    prompt: "",
    itemType: "single",
    options: method === "testing" ? [emptyAssessmentOption(), emptyAssessmentOption()] : [],
    context: "",
    roles: "",
    product: "",
    criteria: "",
    componentIds: [...componentIds],
    forNok: false,
    planKey,
    attachments: [],
  };
}

export function emptyAssessmentLevelBlock(): AssessmentLevelBlock {
  return { tasks: [], forNok: false, plan: {} };
}

export function emptyAssessmentByLevel(): AssessmentByLevel {
  return {
    базовый: emptyAssessmentLevelBlock(),
    продвинутый: emptyAssessmentLevelBlock(),
    экспертный: emptyAssessmentLevelBlock(),
  };
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

const MEDIA_KINDS = new Set<AssessmentMediaKind>(["image", "pdf", "video", "audio"]);

export function createAssessmentAttachmentId(): string {
  return uid("am");
}

function inferMediaKind(mime: string, name: string): AssessmentMediaKind | null {
  const type = mime.toLowerCase();
  const ext = name.toLowerCase().replace(/^.*\./, ".");
  if (type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === ".pdf") return "pdf";
  if (type.startsWith("video/") || [".mp4", ".webm", ".mov", ".ogg"].includes(ext)) return "video";
  if (type.startsWith("audio/") || [".mp3", ".wav", ".m4a", ".aac", ".oga"].includes(ext)) return "audio";
  return null;
}

export function normalizeAttachments(raw: unknown): AssessmentAttachment[] {
  if (!Array.isArray(raw)) return [];
  const items: AssessmentAttachment[] = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const name = asString(row.name || row.filename || row.original_name);
    const url = asString(row.url || row.href || row.path);
    if (!url) return;
    const mime = asString(row.mime || row.content_type || row.type);
    const kindRaw = asString(row.kind);
    const kind = MEDIA_KINDS.has(kindRaw as AssessmentMediaKind)
      ? (kindRaw as AssessmentMediaKind)
      : inferMediaKind(mime, name);
    if (!kind) return;
    items.push({
      id: asString(row.id) || createAssessmentAttachmentId(),
      kind,
      name: name || `${kind}-файл`,
      mime,
      url,
      size: Number(row.size) > 0 ? Number(row.size) : 0,
    });
  });
  return items;
}

export function assessmentMediaUrl(url: string): string {
  const value = asString(url);
  if (!value) return "";
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  const base = String(import.meta.env.VITE_API_URL || "http://localhost:10000").replace(/\/$/, "");
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

export function formatAttachmentSize(size: number): string {
  if (!size || size < 0) return "";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function normalizeOptions(raw: unknown): AssessmentOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { id: createAssessmentOptionId(), text: item, isCorrect: false };
    }
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: asString(row.id) || createAssessmentOptionId(),
      text: asString(row.text),
      isCorrect: Boolean(row.isCorrect ?? row.is_correct),
    };
  });
}

export function normalizeAssessmentTask(raw: unknown, fallbackMethod: AssessmentMethodId = "practical"): AssessmentTask {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const method =
    resolveAssessmentMethod(row.method) ||
    resolveAssessmentMethod(row.tool) ||
    resolveAssessmentMethod(row.type) ||
    fallbackMethod;
  const componentIds = Array.isArray(row.componentIds)
    ? row.componentIds.map((id) => String(id))
    : Array.isArray(row.component_ids)
      ? (row.component_ids as unknown[]).map((id) => String(id))
      : [];
  return {
    id: asString(row.id) || createAssessmentTaskId(),
    method,
    prompt: asString(row.prompt ?? row.taskText ?? row.title),
    itemType: (TEST_ITEM_TYPES.some((item) => item.value === row.itemType || item.value === row.item_type)
      ? ((row.itemType || row.item_type) as TestItemType)
      : "single"),
    options: normalizeOptions(row.options),
    context: asString(row.context),
    roles: asString(row.roles),
    product: asString(row.product),
    criteria: asString(row.criteria),
    componentIds,
    forNok: Boolean(row.forNok ?? row.for_nok),
    planKey: asString(row.planKey || row.plan_key) || undefined,
    attachments: normalizeAttachments(row.attachments),
  };
}

export function normalizeAssessmentByLevel(raw: unknown): AssessmentByLevel {
  const next = emptyAssessmentByLevel();
  if (!raw || typeof raw !== "object") return next;
  const source = raw as Record<string, unknown>;
  for (const level of FORMATION_LEVELS) {
    const block = source[level];
    if (!block || typeof block !== "object") continue;
    const row = block as Record<string, unknown>;
    const tasks = Array.isArray(row.tasks)
      ? row.tasks.map((task) => normalizeAssessmentTask(task))
      : [];
    if (tasks.length === 0 && Array.isArray(row.methods)) {
      const criteria = asString(row.criteria);
      (row.methods as unknown[]).forEach((method) => {
        const resolved = resolveAssessmentMethod(method);
        if (!resolved) return;
        tasks.push({
          ...emptyAssessmentTask(resolved),
          criteria,
        });
      });
    }
    next[level] = {
      tasks,
      forNok: Boolean(row.forNok ?? row.for_nok),
      plan: normalizeComponentPlan(row.plan, tasks),
    };
  }
  return next;
}

export function listStructureComponents(structure: StructureABC): StructureComponent[] {
  const items: StructureComponent[] = [];
  DESCRIPTOR_CATEGORIES.forEach((category) => {
    (structure?.[category] || [])
      .filter((item) => item.text.trim())
      .forEach((item, index) => {
        items.push({
          id: item.id,
          category,
          code: `${category}${index + 1}`,
          text: item.text.trim(),
        });
      });
  });
  return items;
}

function testingComplete(task: AssessmentTask): boolean {
  if (!task.prompt.trim()) return false;
  if (task.itemType === "open") return true;
  const filled = task.options.filter((opt) => opt.text.trim());
  if (filled.length < 2) return false;
  if (task.itemType === "single" || task.itemType === "multiple") {
    return filled.some((opt) => opt.isCorrect);
  }
  return true;
}

export function isAssessmentTaskComplete(task: AssessmentTask): boolean {
  if (task.componentIds.length === 0 || !task.criteria.trim()) return false;
  switch (task.method) {
    case "testing":
      return testingComplete(task);
    case "practical":
      return Boolean(task.prompt.trim() && task.product.trim());
    case "case":
      return Boolean(task.context.trim() && task.prompt.trim());
    case "business_game":
      return Boolean(task.context.trim() && task.roles.trim());
    case "project":
      return Boolean(task.context.trim() && task.product.trim() && task.prompt.trim());
    default:
      return Boolean(task.prompt.trim());
  }
}

export function coveredIdsInBlock(block: AssessmentLevelBlock | undefined): Set<string> {
  const ids = new Set<string>();
  (block?.tasks || []).forEach((task) => {
    if (!isAssessmentTaskComplete(task)) return;
    task.componentIds.forEach((id) => ids.add(id));
  });
  return ids;
}

export type AssessmentCoverage = {
  components: StructureComponent[];
  completeTaskCount: number;
  uncovered: StructureComponent[];
  byLevel: Record<
    FormationLevel,
    {
      coveredIds: string[];
      uncovered: StructureComponent[];
      completeCount: number;
    }
  >;
};

export function getAssessmentCoverage(
  structure: StructureABC,
  byLevel: AssessmentByLevel,
): AssessmentCoverage {
  const normalized = normalizeAssessmentByLevel(byLevel);
  const components = listStructureComponents(structure);
  const coveredAnywhere = new Set<string>();
  let completeTaskCount = 0;
  const byLevelResult = {} as AssessmentCoverage["byLevel"];

  for (const level of FORMATION_LEVELS) {
    const block = normalized[level];
    const complete = block.tasks.filter(isAssessmentTaskComplete);
    completeTaskCount += complete.length;
    const coveredIds = coveredIdsInBlock(block);
    coveredIds.forEach((id) => coveredAnywhere.add(id));
    byLevelResult[level] = {
      coveredIds: Array.from(coveredIds),
      uncovered: components.filter((item) => !coveredIds.has(item.id)),
      completeCount: complete.length,
    };
  }

  return {
    components,
    completeTaskCount,
    uncovered: components.filter((item) => !coveredAnywhere.has(item.id)),
    byLevel: byLevelResult,
  };
}

export function recommendedPlan(components: StructureComponent[]): ComponentMethodPlan {
  const plan: ComponentMethodPlan = {};
  components.forEach((item) => {
    plan[item.id] = [recommendedMethodFor(item.category)];
  });
  return plan;
}

export function normalizeComponentPlan(raw: unknown, tasks: AssessmentTask[] = []): ComponentMethodPlan {
  const plan: ComponentMethodPlan = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.entries(raw as Record<string, unknown>).forEach(([componentId, methods]) => {
      if (!componentId) return;
      const list = Array.isArray(methods)
        ? methods
            .map((item) => resolveAssessmentMethod(item))
            .filter((item): item is AssessmentMethodId => Boolean(item))
        : [];
      const unique: AssessmentMethodId[] = [];
      list.forEach((method) => {
        if (!unique.includes(method)) unique.push(method);
      });
      if (unique.length) plan[componentId] = unique;
    });
  }
  if (Object.keys(plan).length === 0 && tasks.length > 0) {
    tasks.forEach((task) => {
      task.componentIds.forEach((id) => {
        const current = plan[id] || [];
        if (!current.includes(task.method)) current.push(task.method);
        plan[id] = current;
      });
    });
  }
  return plan;
}

export function togglePlanMethod(
  plan: ComponentMethodPlan,
  componentId: string,
  method: AssessmentMethodId,
): ComponentMethodPlan {
  const current = plan[componentId] || [];
  const next = current.includes(method)
    ? current.filter((item) => item !== method)
    : [...current, method];
  const copy = { ...plan };
  if (next.length === 0) delete copy[componentId];
  else copy[componentId] = next;
  return copy;
}

export function unassignedComponents(
  components: StructureComponent[],
  plan: ComponentMethodPlan,
): StructureComponent[] {
  return components.filter((item) => !(plan[item.id] || []).length);
}

export function buildPlanSlots(
  components: StructureComponent[],
  plan: ComponentMethodPlan,
): PlanSlot[] {
  const testing: PlanSlot[] = [];
  const grouped = new Map<AssessmentMethodId, string[]>();
  components.forEach((component) => {
    (plan[component.id] || []).forEach((method) => {
      if (method === "testing") {
        testing.push({
          planKey: `testing:${component.id}`,
          method,
          componentIds: [component.id],
        });
        return;
      }
      const ids = grouped.get(method) || [];
      ids.push(component.id);
      grouped.set(method, ids);
    });
  });
  const other = Array.from(grouped.entries()).map(([method, componentIds]) => ({
    planKey: method,
    method,
    componentIds,
  }));
  return [...testing, ...other];
}

export function syncTasksFromPlan(
  block: AssessmentLevelBlock,
  components: StructureComponent[],
): AssessmentLevelBlock {
  const slots = buildPlanSlots(components, block.plan || {});
  const remaining = [...(block.tasks || [])];
  const tasks: AssessmentTask[] = [];
  const sameIds = (left: string[], right: string[]) =>
    [...left].sort().join("\0") === [...right].sort().join("\0");

  const takeMatch = (slot: PlanSlot): AssessmentTask | undefined => {
    const byKey = remaining.findIndex((task) => task.planKey === slot.planKey);
    if (byKey >= 0) return remaining.splice(byKey, 1)[0];
    const byComponents = remaining.findIndex((task) => {
      if (task.method !== slot.method) return false;
      if (slot.method === "testing") {
        return task.componentIds.length === 1 && task.componentIds[0] === slot.componentIds[0];
      }
      return sameIds(task.componentIds, slot.componentIds);
    });
    if (byComponents >= 0) return remaining.splice(byComponents, 1)[0];
    return undefined;
  };

  slots.forEach((slot) => {
    const existing = takeMatch(slot);
    if (existing) {
      tasks.push({
        ...existing,
        method: slot.method,
        componentIds: slot.componentIds,
        planKey: slot.planKey,
      });
      return;
    }
    tasks.push(emptyAssessmentTask(slot.method, slot.componentIds, slot.planKey));
  });
  remaining.forEach((task) => {
    if (isAssessmentTaskComplete(task) && task.componentIds.length > 0) {
      tasks.push({ ...task, planKey: undefined });
    }
  });
  return { ...block, tasks };
}

export type MethodCounts = Record<AssessmentMethodId, { planned: number; complete: number }>;

export function emptyMethodCounts(): MethodCounts {
  return {
    testing: { planned: 0, complete: 0 },
    case: { planned: 0, complete: 0 },
    practical: { planned: 0, complete: 0 },
    business_game: { planned: 0, complete: 0 },
    project: { planned: 0, complete: 0 },
  };
}

export type IncompleteSlot = {
  taskId: string;
  planKey: string;
  method: AssessmentMethodId;
  componentCodes: string[];
};

export type DevelopmentProgress = {
  plannedSlots: number;
  completeSlots: number;
  unplanned: StructureComponent[];
  byMethod: MethodCounts;
  byLevel: Record<
    FormationLevel,
    {
      planned: number;
      complete: number;
      unassigned: StructureComponent[];
      byMethod: MethodCounts;
      incomplete: IncompleteSlot[];
    }
  >;
};

export function getDevelopmentProgress(
  structure: StructureABC,
  byLevel: AssessmentByLevel,
): DevelopmentProgress {
  const normalized = normalizeAssessmentByLevel(byLevel);
  const components = listStructureComponents(structure);
  const byId = new Map(components.map((item) => [item.id, item]));
  let plannedSlots = 0;
  let completeSlots = 0;
  const byMethod = emptyMethodCounts();
  const byLevelResult = {} as DevelopmentProgress["byLevel"];

  for (const level of FORMATION_LEVELS) {
    const block = normalized[level];
    const slots = buildPlanSlots(components, block.plan);
    const tasksByKey = new Map(
      block.tasks.filter((task) => task.planKey).map((task) => [task.planKey as string, task]),
    );
    const incomplete: IncompleteSlot[] = [];
    const levelMethods = emptyMethodCounts();
    let complete = 0;
    slots.forEach((slot) => {
      levelMethods[slot.method].planned += 1;
      byMethod[slot.method].planned += 1;
      const task =
        tasksByKey.get(slot.planKey) ||
        block.tasks.find(
          (item) =>
            item.method === slot.method &&
            slot.componentIds.every((id) => item.componentIds.includes(id)),
        );
      if (task && isAssessmentTaskComplete(task)) {
        complete += 1;
        levelMethods[slot.method].complete += 1;
        byMethod[slot.method].complete += 1;
        return;
      }
      incomplete.push({
        taskId: task?.id || slot.planKey,
        planKey: slot.planKey,
        method: slot.method,
        componentCodes: slot.componentIds.map((id) => byId.get(id)?.code || id),
      });
    });
    plannedSlots += slots.length;
    completeSlots += complete;
    byLevelResult[level] = {
      planned: slots.length,
      complete,
      unassigned: unassignedComponents(components, block.plan),
      byMethod: levelMethods,
      incomplete,
    };
  }

  const unplanned = components.filter((item) =>
    FORMATION_LEVELS.every((level) => !(normalized[level].plan[item.id] || []).length),
  );

  return { plannedSlots, completeSlots, unplanned, byMethod, byLevel: byLevelResult };
}

export function allocationErrorMessage(
  structure: StructureABC,
  byLevel: AssessmentByLevel,
): string | null {
  const progress = getDevelopmentProgress(structure, byLevel);
  if (progress.unplanned.length > 0) {
    return `На шаге 6 распределите методы оценки для ${progress.unplanned.map((item) => item.code).join(", ")}`;
  }
  return null;
}

export function syncAssessmentByLevel(
  structure: StructureABC,
  existing: AssessmentByLevel,
): AssessmentByLevel {
  const components = listStructureComponents(structure);
  const validIds = new Set(components.map((item) => item.id));
  const next = emptyAssessmentByLevel();
  for (const level of FORMATION_LEVELS) {
    const block = existing[level] || emptyAssessmentLevelBlock();
    const plan: ComponentMethodPlan = {};
    Object.entries(block.plan || {}).forEach(([id, methods]) => {
      if (validIds.has(id) && methods.length) plan[id] = methods;
    });
    const pruned: AssessmentLevelBlock = {
      forNok: Boolean(block.forNok),
      plan,
      tasks: (block.tasks || []).map((task) => ({
        ...normalizeAssessmentTask(task),
        componentIds: (task.componentIds || []).filter((id) => validIds.has(id)),
      })),
    };
    next[level] = syncTasksFromPlan(pruned, components);
  }
  return next;
}

export type AssessmentToolPayload = {
  id: string;
  level: FormationLevel;
  tool: string;
  method: AssessmentMethodId;
  item_type?: TestItemType;
  prompt: string;
  context?: string;
  roles?: string;
  product?: string;
  options?: AssessmentOption[];
  criteria: string;
  component_ids: string[];
  component_texts: string[];
  components: Array<{ id: string; code: string; category: DescriptorCategory; text: string }>;
  for_nok: boolean;
  attachments?: AssessmentAttachment[];
};

export function flattenAssessmentTools(
  byLevel: AssessmentByLevel,
  structure: StructureABC,
): AssessmentToolPayload[] {
  const normalized = normalizeAssessmentByLevel(byLevel);
  const byId = new Map(listStructureComponents(structure).map((item) => [item.id, item]));
  const tools: AssessmentToolPayload[] = [];
  for (const level of FORMATION_LEVELS) {
    const block = normalized[level];
    block.tasks.forEach((task) => {
      const components = task.componentIds
        .map((id) => byId.get(id))
        .filter((item): item is StructureComponent => Boolean(item));
      tools.push({
        id: task.id,
        level,
        tool: assessmentMethodLabel(task.method),
        method: task.method,
        item_type: task.method === "testing" ? task.itemType : undefined,
        prompt: task.prompt.trim(),
        context: task.context.trim() || undefined,
        roles: task.roles.trim() || undefined,
        product: task.product.trim() || undefined,
        options: task.method === "testing" ? task.options : undefined,
        criteria: task.criteria.trim(),
        component_ids: components.map((item) => item.id),
        component_texts: components.map((item) => item.text),
        components: components.map((item) => ({
          id: item.id,
          code: item.code,
          category: item.category,
          text: item.text,
        })),
        for_nok: Boolean(task.forNok || block.forNok),
        attachments: task.attachments,
      });
    });
  }
  return tools;
}

export function assessmentToolsToByLevel(raw: unknown, structure: StructureABC): AssessmentByLevel {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return syncAssessmentByLevel(structure, normalizeAssessmentByLevel(raw));
  }
  const next = emptyAssessmentByLevel();
  if (!Array.isArray(raw)) return next;
  const components = listStructureComponents(structure);
  const byId = new Map(components.map((item) => [item.id, item]));
  const byText = new Map(components.map((item) => [item.text.toLowerCase(), item]));
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const level = String(row.level || "") as FormationLevel;
    if (!FORMATION_LEVELS.includes(level)) return;
    const task = normalizeAssessmentTask(row);
    const texts = Array.isArray(row.component_texts)
      ? (row.component_texts as unknown[]).map((item) => String(item).toLowerCase())
      : [];
    const resolved = task.componentIds
      .map((id) => byId.get(id)?.id)
      .filter((id): id is string => Boolean(id));
    if (resolved.length === 0) {
      texts.forEach((text) => {
        const found = byText.get(text);
        if (found && !resolved.includes(found.id)) resolved.push(found.id);
      });
    }
    task.componentIds = resolved;
    next[level].tasks.push(task);
    if (task.forNok) next[level].forNok = true;
    task.componentIds.forEach((id) => {
      const methods = next[level].plan[id] || [];
      if (!methods.includes(task.method)) methods.push(task.method);
      next[level].plan[id] = methods;
    });
  });
  return syncAssessmentByLevel(structure, next);
}

export function uniqueAssessmentMethodLabels(byLevel: AssessmentByLevel): string[] {
  const normalized = normalizeAssessmentByLevel(byLevel);
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const level of FORMATION_LEVELS) {
    (normalized[level]?.tasks || []).forEach((task) => {
      const label = assessmentMethodLabel(task.method);
      if (seen.has(label)) return;
      seen.add(label);
      labels.push(label);
    });
  }
  return labels;
}

export type DisplayAssessmentTask = {
  id: string;
  level: FormationLevel | string;
  tool: string;
  method: AssessmentMethodId | null;
  itemType?: string;
  prompt: string;
  context?: string;
  roles?: string;
  product?: string;
  options: AssessmentOption[];
  criteria: string;
  components: Array<{ code?: string; text: string }>;
  forNok: boolean;
  attachments: AssessmentAttachment[];
};

export function displayAssessmentTools(
  tools: Array<Record<string, unknown>> | undefined | null,
): DisplayAssessmentTask[] {
  if (!Array.isArray(tools) || tools.length === 0) return [];
  return tools.map((raw, index) => {
    const method =
      resolveAssessmentMethod(raw.method) ||
      resolveAssessmentMethod(raw.tool) ||
      resolveAssessmentMethod(raw.type);
    const componentsRaw = Array.isArray(raw.components) ? raw.components : [];
    const texts = Array.isArray(raw.component_texts) ? raw.component_texts : [];
    const components =
      componentsRaw.length > 0
        ? componentsRaw.map((item) => {
            const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            return {
              code: asString(row.code) || undefined,
              text: asString(row.text),
            };
          })
        : texts.map((text) => ({ text: String(text) }));
    return {
      id: asString(raw.id) || `tool-${index}`,
      level: asString(raw.level),
      tool: asString(raw.tool) || (method ? assessmentMethodLabel(method) : asString(raw.type) || "Задание"),
      method,
      itemType: asString(raw.item_type || raw.itemType) || undefined,
      prompt: asString(raw.prompt ?? raw.taskText ?? raw.title),
      context: asString(raw.context) || undefined,
      roles: asString(raw.roles) || undefined,
      product: asString(raw.product) || undefined,
      options: normalizeOptions(raw.options),
      criteria: asString(raw.criteria),
      components: components.filter((item) => item.text),
      forNok: Boolean(raw.for_nok ?? raw.forNok),
      attachments: normalizeAttachments(raw.attachments),
    };
  });
}

export function coverageErrorMessage(coverage: AssessmentCoverage): string | null {
  if (coverage.components.length === 0) {
    return "Добавьте знания и умения в структуру A/B/C, затем сформируйте оценочные задания";
  }
  if (coverage.completeTaskCount === 0) {
    return "Добавьте хотя бы одно заполненное оценочное задание";
  }
  if (coverage.uncovered.length > 0) {
    const codes = coverage.uncovered.map((item) => item.code).join(", ");
    return `Не покрыты компоненты ${codes}. Каждое знание, умение и навык должно войти хотя бы в одно заполненное задание`;
  }
  return null;
}

export function assessmentWizardErrorMessage(
  structure: StructureABC,
  byLevel: AssessmentByLevel,
): string | null {
  const allocation = allocationErrorMessage(structure, byLevel);
  if (allocation) return allocation;
  const progress = getDevelopmentProgress(structure, byLevel);
  if (progress.plannedSlots === 0) {
    return "На шаге 6 распределите З/У/Н по методам оценки хотя бы для одного уровня";
  }
  if (progress.completeSlots < progress.plannedSlots) {
    return `Заполните задания конструктора: готово ${progress.completeSlots} из ${progress.plannedSlots}`;
  }
  return coverageErrorMessage(getAssessmentCoverage(structure, byLevel));
}
