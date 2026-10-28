import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FORMATION_LEVELS, FORMATION_LEVEL_LABELS } from "@/lib/competenceMappers";
import type { FormationLevel } from "@/api/types";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";
import { AssessmentFosPreview } from "@/app/components/AssessmentFosPreview";
import { AssessmentTaskAttachments } from "@/app/components/AssessmentTaskAttachments";
import { AssessmentTestingFields } from "@/app/components/AssessmentTestingFields";
import { useI18n } from "@/context/I18nContext";
import { FORMATION_I18N_KEYS, translateKeyed } from "@/i18n/helpers";
import {
  ASSESSMENT_METHODS,
  assessmentMethodDef,
  assessmentMethodLabel,
  collectExtraMethods,
  createCustomAssessmentMethodId,
  getAssessmentCoverage,
  getDevelopmentProgress,
  isAssessmentTaskComplete,
  isCustomAssessmentMethodId,
  listStructureComponents,
  methodFitsCategory,
  normalizeAssessmentByLevel,
  recommendedPlan,
  syncTasksFromPlan,
  togglePlanMethod,
  unassignedComponents,
  withSharedExtraMethods,
  type AssessmentByLevel,
  type AssessmentMethodId,
  type AssessmentTask,
  type CustomAssessmentMethod,
  type StructureComponent,
} from "@/lib/assessmentConstructor";

const CATEGORY_STYLE: Record<"A" | "B" | "C", string> = {
  A: "bg-blue-50 text-primary border-blue-100",
  B: "bg-green-50 text-green-700 border-green-100",
  C: "bg-purple-50 text-purple-700 border-purple-100",
};

const WORKFLOW_STEP_IDS = [1, 2, 3, 4] as const;

type WorkflowStep = (typeof WORKFLOW_STEP_IDS)[number];

const METHOD_SHORT_KEYS = {
  testing: "assessment.testingShort",
  case: "assessment.caseShort",
  practical: "assessment.practicalShort",
  business_game: "assessment.gameShort",
  project: "assessment.projectShort",
} as const;

type Props = {
  structure: StructureABC;
  value: AssessmentByLevel;
  onChange: (next: AssessmentByLevel | ((prev: AssessmentByLevel) => AssessmentByLevel)) => void;
};

export function AssessmentConstructor({ structure, value, onChange }: Props) {
  const { t } = useI18n();
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [level, setLevel] = useState<FormationLevel>("базовый");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [editorStage, setEditorStage] = useState<"content" | "criteria">("content");

  const components = useMemo(() => listStructureComponents(structure), [structure]);
  const byLevel = useMemo(() => normalizeAssessmentByLevel(value), [value]);
  const coverage = useMemo(() => getAssessmentCoverage(structure, byLevel), [structure, byLevel]);
  const progress = useMemo(() => getDevelopmentProgress(structure, byLevel), [structure, byLevel]);
  const block = byLevel[level];
  const extraMethods = useMemo(() => collectExtraMethods(byLevel), [byLevel]);
  const activeTask = block.tasks.find((task) => task.id === activeTaskId) || null;

  useEffect(() => {
    if (activeTaskId && !block.tasks.some((task) => task.id === activeTaskId)) {
      setActiveTaskId(block.tasks[0]?.id ?? null);
      return;
    }
    if (workflowStep === 2 && !activeTaskId && block.tasks[0]) {
      setActiveTaskId(block.tasks[0].id);
      setEditorStage("content");
    }
  }, [activeTaskId, block.tasks, workflowStep]);

  const commit = (updater: (current: AssessmentByLevel) => AssessmentByLevel) => {
    onChange((prev) => {
      const current = normalizeAssessmentByLevel(prev);
      const next = updater(current);
      const synced = { ...next };
      FORMATION_LEVELS.forEach((item) => {
        synced[item] = syncTasksFromPlan(next[item], components);
      });
      return synced;
    });
  };

  const setLevelPlan = (nextPlan: typeof block.plan) => {
    commit((current) => ({
      ...current,
      [level]: { ...current[level], plan: nextPlan },
    }));
  };

  const updateTask = (taskId: string, patch: Partial<AssessmentTask>) => {
    commit((current) => ({
      ...current,
      [level]: {
        ...current[level],
        tasks: current[level].tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      },
    }));
  };

  const openTask = (taskId: string, targetLevel: FormationLevel = level) => {
    setLevel(targetLevel);
    setActiveTaskId(taskId);
    setEditorStage("content");
    setWorkflowStep(2);
  };

  const goWorkflow = (step: WorkflowStep) => {
    if (step >= 2) {
      commit((current) => current);
    }
    if (step === 2 && !activeTaskId && block.tasks[0]) {
      setActiveTaskId(block.tasks[0].id);
      setEditorStage("content");
    }
    setWorkflowStep(step);
  };

  const workflowSteps = [
    { id: 1 as WorkflowStep, name: t("assessment.distribute") },
    { id: 2 as WorkflowStep, name: t("assessment.tasks") },
    { id: 3 as WorkflowStep, name: t("assessment.progress") },
    { id: 4 as WorkflowStep, name: t("assessment.preview") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{t("assessment.constructor")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("assessment.lead")}{" "}
          <Link to="/methodology/fos" className="text-primary hover:underline font-medium">
            {t("assessment.methodology")}
          </Link>
        </p>
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {workflowSteps.map((step) => {
          const active = step.id === workflowStep;
          const done = step.id < workflowStep;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => goWorkflow(step.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary text-white"
                    : done
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-primary/40"
                }`}
              >
                <span className="text-[11px] uppercase tracking-wide opacity-80">{t("assessment.step", { n: step.id })}</span>
                <div className="text-sm font-semibold">{step.name}</div>
              </button>
            </li>
          );
        })}
      </ol>

      {workflowStep === 1 && (
        <AllocationStep
          level={level}
          onLevelChange={setLevel}
          components={components}
          plan={block.plan}
          extraMethods={extraMethods}
          onToggle={(componentId, method) =>
            setLevelPlan(togglePlanMethod(block.plan, componentId, method))
          }
          onRecommend={() => setLevelPlan(recommendedPlan(components))}
          onAddMethod={() => {
            const extra: CustomAssessmentMethod = {
              id: createCustomAssessmentMethodId(),
              label: t("assessment.extraMethod", { n: extraMethods.length + 1 }),
            };
            commit((current) =>
              withSharedExtraMethods(current, [...collectExtraMethods(current), extra]),
            );
          }}
          onRenameMethod={(id, label) => {
            commit((current) =>
              withSharedExtraMethods(
                current,
                collectExtraMethods(current).map((item) =>
                  item.id === id ? { ...item, label } : item,
                ),
              ),
            );
          }}
          onRemoveMethod={(id) => {
            commit((current) => {
              const extras = collectExtraMethods(current).filter((item) => item.id !== id);
              const next = { ...current };
              FORMATION_LEVELS.forEach((item) => {
                const blockItem = current[item];
                const plan: typeof blockItem.plan = {};
                Object.entries(blockItem.plan || {}).forEach(([componentId, methods]) => {
                  const filtered = methods.filter((method) => method !== id);
                  if (filtered.length) plan[componentId] = filtered;
                });
                next[item] = {
                  ...blockItem,
                  extraMethods: extras,
                  plan,
                  tasks: blockItem.tasks.filter((task) => task.method !== id),
                };
              });
              return next;
            });
          }}
          onCopyToAll={() => {
            const plan = block.plan;
            const extras = extraMethods;
            commit((current) => {
              const next = { ...current };
              FORMATION_LEVELS.forEach((item) => {
                next[item] = { ...current[item], plan: { ...plan }, extraMethods: extras };
              });
              return next;
            });
          }}
        />
      )}

      {workflowStep === 2 && (
        <DevelopStep
          level={level}
          onLevelChange={(next) => {
            setLevel(next);
            setActiveTaskId(byLevel[next].tasks[0]?.id ?? null);
            setEditorStage("content");
          }}
          byLevel={byLevel}
          components={components}
          tasks={block.tasks}
          extraMethods={extraMethods}
          activeTask={activeTask}
          editorStage={editorStage}
          onEditorStage={setEditorStage}
          onSelectTask={setActiveTaskId}
          onChange={(patch) => activeTask && updateTask(activeTask.id, patch)}
          onNokChange={(forNok) =>
            commit((current) => ({
              ...current,
              [level]: { ...current[level], forNok },
            }))
          }
        />
      )}

      {workflowStep === 3 && (
        <ProgressStep
          progress={progress}
          extraMethods={extraMethods}
          onOpen={(targetLevel, taskId) => openTask(taskId, targetLevel)}
        />
      )}

      {workflowStep === 4 && (
        <AssessmentFosPreview
          byLevel={byLevel}
          components={components}
          coverageLine={
            `Готово ${progress.completeSlots} из ${progress.plannedSlots} запланированных заданий. ` +
            `Покрытие структуры: ${coverage.components.length - coverage.uncovered.length} из ${coverage.components.length}` +
            (coverage.uncovered.length > 0
              ? `. Не закрыты: ${coverage.uncovered.map((item) => item.code).join(", ")}.`
              : coverage.components.length > 0
                ? ". Все З/У/Н закрыты."
                : ".")
          }
          onEdit={(targetLevel, taskId) => openTask(taskId, targetLevel)}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => goWorkflow(Math.max(1, workflowStep - 1) as WorkflowStep)}
          disabled={workflowStep === 1}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("assessment.back")}
        </Button>
        <Button
          type="button"
          onClick={() => goWorkflow(Math.min(4, workflowStep + 1) as WorkflowStep)}
          disabled={workflowStep === 4}
          className="gap-2"
        >
          {t("assessment.next")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function LevelTabs({
  value,
  onChange,
  suffix,
}: {
  value: FormationLevel;
  onChange: (level: FormationLevel) => void;
  suffix?: (level: FormationLevel) => string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATION_LEVELS.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === value}
          onClick={() => onChange(item)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            item === value
              ? "border-primary bg-primary text-white"
              : "border-gray-200 bg-white text-gray-700 hover:border-primary/40"
          }`}
        >
          {translateKeyed(t, FORMATION_I18N_KEYS, item, FORMATION_LEVEL_LABELS[item])}
          {suffix ? (
            <span className={`ml-2 text-xs ${item === value ? "text-white/80" : "text-gray-500"}`}>
              {suffix(item)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function AllocationStep({
  level,
  onLevelChange,
  components,
  plan,
  extraMethods,
  onToggle,
  onRecommend,
  onAddMethod,
  onRenameMethod,
  onRemoveMethod,
  onCopyToAll,
}: {
  level: FormationLevel;
  onLevelChange: (level: FormationLevel) => void;
  components: StructureComponent[];
  plan: Record<string, AssessmentMethodId[]>;
  extraMethods: CustomAssessmentMethod[];
  onToggle: (componentId: string, method: AssessmentMethodId) => void;
  onRecommend: () => void;
  onAddMethod: () => void;
  onRenameMethod: (id: string, label: string) => void;
  onRemoveMethod: (id: string) => void;
  onCopyToAll: () => void;
}) {
  const { t } = useI18n();
  const missing = unassignedComponents(components, plan);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Для каждого знания, умения и навыка отметьте методы, которыми его будут оценивать на выбранном
        уровне. Один компонент можно закрыть несколькими методами.
      </p>
      <LevelTabs value={level} onChange={onLevelChange} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onRecommend} disabled={components.length === 0}>
          Рекомендуемые методы
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCopyToAll} disabled={components.length === 0}>
          Скопировать на все уровни
        </Button>
      </div>
      {components.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
          Сначала заполните структуру A/B/C на шаге 3 мастера.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Компонент</th>
                {ASSESSMENT_METHODS.map((method) => (
                  <th key={method.id} className="px-2 py-2 font-medium text-center w-20">
                    {t(METHOD_SHORT_KEYS[method.id])}
                  </th>
                ))}
                {extraMethods.map((method) => (
                  <th key={method.id} className="px-2 py-2 font-medium text-center min-w-[8.5rem]">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        value={method.label}
                        onChange={(e) => onRenameMethod(method.id, e.target.value)}
                        className="w-24 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 normal-case"
                        aria-label={t("assessment.extraMethodName")}
                      />
                      <button
                        type="button"
                        className="p-0.5 rounded text-gray-400 hover:text-red-600"
                        aria-label={t("assessment.removeMethod")}
                        onClick={() => onRemoveMethod(method.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 font-medium text-center w-12">
                  <button
                    type="button"
                    onClick={onAddMethod}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/10"
                    aria-label={t("assessment.addMethod")}
                    title={t("assessment.addMethod")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr key={component.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold mr-2 ${CATEGORY_STYLE[component.category]}`}
                    >
                      {component.code}
                    </span>
                    <span className="text-gray-800">{component.text}</span>
                  </td>
                  {ASSESSMENT_METHODS.map((method) => {
                    const checked = (plan[component.id] || []).includes(method.id);
                    const fit = methodFitsCategory(method.id, component.category);
                    return (
                      <td key={method.id} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(component.id, method.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                          aria-label={`${t(METHOD_SHORT_KEYS[method.id])} для ${component.code}`}
                        />
                        {fit === "recommended" ? (
                          <span className="sr-only">рекомендуется</span>
                        ) : null}
                      </td>
                    );
                  })}
                  {extraMethods.map((method) => (
                    <td key={method.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={(plan[component.id] || []).includes(method.id)}
                        onChange={() => onToggle(component.id, method.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label={`${method.label} для ${component.code}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Тест — знания; кейс — умения; практика, игра и проект — навыки. Рекомендуемые сочетания можно
        подставить кнопкой выше.
      </p>
      {missing.length > 0 ? (
        <p className="text-sm text-amber-800">
          Не распределены: {missing.map((item) => item.code).join(", ")}
        </p>
      ) : components.length > 0 ? (
        <p className="text-sm text-green-700">Все З/У/Н этого уровня закреплены за методами</p>
      ) : null}
    </div>
  );
}

function DevelopStep({
  level,
  onLevelChange,
  byLevel,
  components,
  tasks,
  extraMethods,
  activeTask,
  editorStage,
  onEditorStage,
  onSelectTask,
  onChange,
  onNokChange,
}: {
  level: FormationLevel;
  onLevelChange: (level: FormationLevel) => void;
  byLevel: AssessmentByLevel;
  components: StructureComponent[];
  tasks: AssessmentTask[];
  extraMethods: CustomAssessmentMethod[];
  activeTask: AssessmentTask | null;
  editorStage: "content" | "criteria";
  onEditorStage: (stage: "content" | "criteria") => void;
  onSelectTask: (taskId: string) => void;
  onChange: (patch: Partial<AssessmentTask>) => void;
  onNokChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const byId = new Map(components.map((item) => [item.id, item]));
  const customActive = Boolean(activeTask && isCustomAssessmentMethodId(activeTask.method));

  return (
    <div className="space-y-4">
      <LevelTabs
        value={level}
        onChange={onLevelChange}
        suffix={(item) => {
          const complete = byLevel[item].tasks.filter(isAssessmentTaskComplete).length;
          return `${complete}/${byLevel[item].tasks.length}`;
        }}
      />
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={byLevel[level].forNok}
          onChange={(e) => onNokChange(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary"
        />
        Комплект уровня пригоден для НОК
      </label>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">
          На шаге «Распределение» отметьте методы для З/У/Н — здесь появятся заготовки заданий.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {tasks.map((task, index) => {
              const complete = isAssessmentTaskComplete(task);
              const codes = task.componentIds.map((id) => byId.get(id)?.code).filter(Boolean).join(", ");
              const active = task.id === activeTask?.id;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTask(task.id);
                      onEditorStage("content");
                    }}
                    className={`w-full text-left px-3 py-2 ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {index + 1}. {assessmentMethodLabel(task.method, extraMethods)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {codes || "нет компонентов"} · {complete ? "готово" : "черновик"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {activeTask ? (
            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {assessmentMethodLabel(activeTask.method, extraMethods)}
                </h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {activeTask.componentIds.map((id) => {
                    const item = byId.get(id);
                    if (!item) return null;
                    return (
                      <span
                        key={id}
                        className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${CATEGORY_STYLE[item.category]}`}
                      >
                        {item.code}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">{assessmentMethodDef(activeTask.method).short}</p>
              </div>
              {customActive ? (
                <div className="space-y-4">
                  <MethodFields task={activeTask} onChange={onChange} />
                  <AssessmentTaskAttachments
                    attachments={activeTask.attachments || []}
                    onChange={(attachments) => onChange({ attachments })}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTask.forNok}
                      onChange={(e) => onChange({ forNok: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Задание пригодно для НОК
                  </label>
                </div>
              ) : (
                <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEditorStage("content")}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    editorStage === "content" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Содержание
                </button>
                <button
                  type="button"
                  onClick={() => onEditorStage("criteria")}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    editorStage === "criteria" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Критерии
                </button>
              </div>
              {editorStage === "content" ? (
                <div className="space-y-4">
                  <MethodFields task={activeTask} onChange={onChange} />
                  <AssessmentTaskAttachments
                    attachments={activeTask.attachments || []}
                    onChange={(attachments) => onChange({ attachments })}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("assessment.taskCriteria")}</label>
                    <textarea
                      value={activeTask.criteria}
                      onChange={(e) => onChange({ criteria: e.target.value })}
                      rows={4}
                      className="form-control"
                      placeholder="Наблюдаемые признаки, порог, что считается выполненным…"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTask.forNok}
                      onChange={(e) => onChange({ forNok: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Задание пригодно для НОК
                  </label>
                </div>
              )}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Выберите задание слева.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MethodFraction({ complete, planned }: { complete: number; planned: number }) {
  if (planned === 0) return <span className="text-gray-300">—</span>;
  const done = complete >= planned;
  return (
    <span className={done ? "text-green-700 font-semibold" : "text-gray-800 font-semibold"}>
      {complete}
      <span className="text-gray-400 font-normal"> / {planned}</span>
    </span>
  );
}

function ProgressStep({
  progress,
  extraMethods,
  onOpen,
}: {
  progress: ReturnType<typeof getDevelopmentProgress>;
  extraMethods: CustomAssessmentMethod[];
  onOpen: (level: FormationLevel, taskId: string) => void;
}) {
  const { t } = useI18n();
  const methodColumns = [
    ...ASSESSMENT_METHODS.map((method) => ({
      id: method.id as AssessmentMethodId,
      label: t(METHOD_SHORT_KEYS[method.id]),
    })),
    ...extraMethods.map((method) => ({ id: method.id as AssessmentMethodId, label: method.label })),
  ];
  const methodsInUse = methodColumns.filter((method) => (progress.byMethod[method.id]?.planned || 0) > 0);
  const openFirst = (level: FormationLevel, methodId?: AssessmentMethodId) => {
    const row = progress.byLevel[level];
    const item = methodId ? row.incomplete.find((slot) => slot.method === methodId) : row.incomplete[0];
    if (item) onOpen(level, item.taskId);
  };
  const openMethod = (methodId: AssessmentMethodId) => {
    for (const level of FORMATION_LEVELS) {
      const item = progress.byLevel[level].incomplete.find((slot) => slot.method === methodId);
      if (item) {
        onOpen(level, item.taskId);
        return;
      }
    }
  };

  if (progress.plannedSlots === 0) {
    return (
      <p className="text-sm text-gray-500">
        На шаге «Распределение» отметьте методы для З/У/Н — здесь появится дашборд разработки.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-gray-900">Разработка заданий</p>
          <p className="text-sm text-gray-500">
            {progress.completeSlots} из {progress.plannedSlots}
            {progress.plannedSlots > 0
              ? ` · ${Math.round((progress.completeSlots / progress.plannedSlots) * 100)}%`
              : ""}
          </p>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{
              width: `${progress.plannedSlots > 0 ? Math.round((progress.completeSlots / progress.plannedSlots) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {methodColumns.map((method) => {
            const stat = progress.byMethod[method.id] || { planned: 0, complete: 0 };
            const idle = stat.planned === 0;
            const done = !idle && stat.complete >= stat.planned;
            return (
              <button
                key={method.id}
                type="button"
                disabled={idle || done}
                onClick={() => openMethod(method.id)}
                className={`rounded-lg border px-3 py-2 text-left ${
                  idle
                    ? "border-gray-100 bg-gray-50 text-gray-400 cursor-default"
                    : done
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-white hover:border-primary/40"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  {method.label}
                </div>
                <div className="mt-1 text-lg leading-none">
                  {idle ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <MethodFraction complete={stat.complete} planned={stat.planned} />
                  )}
                </div>
                {!idle ? (
                  <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${done ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${Math.round((stat.complete / stat.planned) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
        {progress.unplanned.length > 0 ? (
          <p className="text-xs text-amber-800">
            Нет метода ни на одном уровне: {progress.unplanned.length} З/У/Н
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-medium">Уровень</th>
              {(methodsInUse.length ? methodsInUse : methodColumns).map((method) => (
                <th key={method.id} className="px-3 py-2 font-medium text-center">
                  {method.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-center">Всего</th>
            </tr>
          </thead>
          <tbody>
            {FORMATION_LEVELS.map((level) => {
              const row = progress.byLevel[level];
              const columns = methodsInUse.length ? methodsInUse : methodColumns;
              return (
                <tr key={level} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {FORMATION_LEVEL_LABELS[level]}
                    {row.unassigned.length > 0 ? (
                      <div className="text-[11px] font-normal text-amber-800">
                        Не распределены: {row.unassigned.length} З/У/Н
                      </div>
                    ) : null}
                  </td>
                  {columns.map((method) => {
                    const stat = row.byMethod[method.id] || { planned: 0, complete: 0 };
                    const canOpen = stat.planned > stat.complete;
                    return (
                      <td key={method.id} className="px-3 py-2 text-center">
                        {canOpen ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => openFirst(level, method.id)}
                          >
                            <MethodFraction complete={stat.complete} planned={stat.planned} />
                          </button>
                        ) : (
                          <MethodFraction complete={stat.complete} planned={stat.planned} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    {row.incomplete.length > 0 ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => openFirst(level)}
                      >
                        <MethodFraction complete={row.complete} planned={row.planned} />
                      </button>
                    ) : (
                      <MethodFraction complete={row.complete} planned={row.planned} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Нажмите на незаполненную ячейку, чтобы открыть следующее задание метода.</p>
    </div>
  );
}

function MethodFields({
  task,
  onChange,
}: {
  task: AssessmentTask;
  onChange: (patch: Partial<AssessmentTask>) => void;
}) {
  const { t } = useI18n();
  if (isCustomAssessmentMethodId(task.method)) {
    return (
      <div className="space-y-3">
        <Field
          label={t("assessment.taskDescription")}
          value={task.prompt}
          onChange={(prompt) => onChange({ prompt })}
          rows={4}
          placeholder="Сформулируйте задание: что должен сделать обучающийся…"
        />
        <Field
          label={t("assessment.taskCriteria")}
          value={task.criteria}
          onChange={(criteria) => onChange({ criteria })}
          rows={4}
          placeholder="Наблюдаемые признаки, порог, что считается выполненным…"
        />
      </div>
    );
  }

  if (task.method === "testing") {
    return <AssessmentTestingFields task={task} onChange={onChange} />;
  }

  if (task.method === "case") {
    return (
      <div className="space-y-3">
        <Field
          label="Описание кейса"
          value={task.context}
          onChange={(context) => onChange({ context })}
          rows={3}
          placeholder="Производственная ситуация, исходные данные, ограничения…"
        />
        <Field
          label="Вопросы и задания по кейсу"
          value={task.prompt}
          onChange={(prompt) => onChange({ prompt })}
          rows={2}
          placeholder="Анализ, решение, обоснование…"
        />
      </div>
    );
  }

  if (task.method === "practical") {
    return (
      <div className="space-y-3">
        <Field
          label="Ситуация / условие"
          value={task.context}
          onChange={(context) => onChange({ context })}
          rows={2}
          placeholder="Рабочее место, входные данные, ограничения…"
        />
        <Field
          label="Формулировка задания"
          value={task.prompt}
          onChange={(prompt) => onChange({ prompt })}
          rows={2}
          placeholder="Какое действие нужно выполнить…"
        />
        <Field
          label="Ожидаемый продукт / результат"
          value={task.product}
          onChange={(product) => onChange({ product })}
          rows={2}
          placeholder="Документ, изделие, протокол, наблюдаемое действие…"
        />
      </div>
    );
  }

  if (task.method === "business_game") {
    return (
      <div className="space-y-3">
        <Field
          label="Сценарий игры"
          value={task.context}
          onChange={(context) => onChange({ context })}
          rows={3}
          placeholder="Завязка, регламент, ограничение по времени…"
        />
        <Field
          label="Роли участников"
          value={task.roles}
          onChange={(roles) => onChange({ roles })}
          rows={2}
          placeholder="Роли, цели, кто оценивается…"
        />
        <Field
          label="Задание игрокам"
          value={task.prompt}
          onChange={(prompt) => onChange({ prompt })}
          rows={2}
          placeholder="Что должны сделать участники…"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Бриф / техническое задание"
        value={task.context}
        onChange={(context) => onChange({ context })}
        rows={3}
        placeholder="Цель, заказчик, ограничения…"
      />
      <Field
        label="Требования к выполнению"
        value={task.prompt}
        onChange={(prompt) => onChange({ prompt })}
        rows={2}
        placeholder="Этапы, обязательные работы, формат защиты…"
      />
      <Field
        label="Состав результата"
        value={task.product}
        onChange={(product) => onChange({ product })}
        rows={2}
        placeholder="Пояснительная записка, модель, прототип, презентация…"
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="form-control"
        placeholder={placeholder}
      />
    </div>
  );
}

