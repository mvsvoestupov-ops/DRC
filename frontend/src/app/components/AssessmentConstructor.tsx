import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import { FORMATION_LEVELS, FORMATION_LEVEL_LABELS } from "@/lib/competenceMappers";
import type { FormationLevel } from "@/api/types";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";
import { AssessmentFosPreview, ASSESSMENT_MEDIA_ACCEPT } from "@/app/components/AssessmentFosPreview";
import { useI18n } from "@/context/I18nContext";
import { FORMATION_I18N_KEYS, translateKeyed } from "@/i18n/helpers";
import {
  ASSESSMENT_METHODS,
  TEST_ITEM_TYPES,
  assessmentMethodDef,
  assessmentMethodLabel,
  emptyAssessmentOption,
  formatAttachmentSize,
  getAssessmentCoverage,
  getDevelopmentProgress,
  isAssessmentTaskComplete,
  ASSESSMENT_MEDIA_KIND_LABELS,
  listStructureComponents,
  methodFitsCategory,
  normalizeAssessmentByLevel,
  recommendedPlan,
  syncTasksFromPlan,
  togglePlanMethod,
  unassignedComponents,
  type AssessmentAttachment,
  type AssessmentByLevel,
  type AssessmentMethodId,
  type AssessmentOption,
  type AssessmentTask,
  type StructureComponent,
  type TestItemType,
} from "@/lib/assessmentConstructor";

const CATEGORY_STYLE: Record<"A" | "B" | "C", string> = {
  A: "bg-blue-50 text-primary border-blue-100",
  B: "bg-green-50 text-green-700 border-green-100",
  C: "bg-purple-50 text-purple-700 border-purple-100",
};

const WORKFLOW_STEP_IDS = [1, 2, 3, 4] as const;

type WorkflowStep = (typeof WORKFLOW_STEP_IDS)[number];

const METHOD_SHORT_KEYS: Record<AssessmentMethodId, string> = {
  testing: "assessment.testingShort",
  case: "assessment.caseShort",
  practical: "assessment.practicalShort",
  business_game: "assessment.gameShort",
  project: "assessment.projectShort",
};

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
          onToggle={(componentId, method) =>
            setLevelPlan(togglePlanMethod(block.plan, componentId, method))
          }
          onRecommend={() => setLevelPlan(recommendedPlan(components))}
          onCopyToAll={() => {
            const plan = block.plan;
            commit((current) => {
              const next = { ...current };
              FORMATION_LEVELS.forEach((item) => {
                next[item] = { ...current[item], plan: { ...plan } };
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
  onToggle,
  onRecommend,
  onCopyToAll,
}: {
  level: FormationLevel;
  onLevelChange: (level: FormationLevel) => void;
  components: StructureComponent[];
  plan: Record<string, AssessmentMethodId[]>;
  onToggle: (componentId: string, method: AssessmentMethodId) => void;
  onRecommend: () => void;
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
  activeTask: AssessmentTask | null;
  editorStage: "content" | "criteria";
  onEditorStage: (stage: "content" | "criteria") => void;
  onSelectTask: (taskId: string) => void;
  onChange: (patch: Partial<AssessmentTask>) => void;
  onNokChange: (value: boolean) => void;
}) {
  const byId = new Map(components.map((item) => [item.id, item]));

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
                      {index + 1}. {assessmentMethodLabel(task.method)}
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
                  {assessmentMethodLabel(activeTask.method)}
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
                  <TaskAttachments
                    attachments={activeTask.attachments || []}
                    onChange={(attachments) => onChange({ attachments })}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Критерии оценки</label>
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
  onOpen,
}: {
  progress: ReturnType<typeof getDevelopmentProgress>;
  onOpen: (level: FormationLevel, taskId: string) => void;
}) {
  const { t } = useI18n();
  const methodsInUse = ASSESSMENT_METHODS.filter((method) => progress.byMethod[method.id].planned > 0);
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
          {ASSESSMENT_METHODS.map((method) => {
            const stat = progress.byMethod[method.id];
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
                  {t(METHOD_SHORT_KEYS[method.id])}
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
              {(methodsInUse.length ? methodsInUse : ASSESSMENT_METHODS).map((method) => (
                <th key={method.id} className="px-3 py-2 font-medium text-center">
                  {t(METHOD_SHORT_KEYS[method.id])}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-center">Всего</th>
            </tr>
          </thead>
          <tbody>
            {FORMATION_LEVELS.map((level) => {
              const row = progress.byLevel[level];
              const columns = methodsInUse.length ? methodsInUse : ASSESSMENT_METHODS;
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
                    const stat = row.byMethod[method.id];
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

function TaskAttachments({
  attachments,
  onChange,
}: {
  attachments: AssessmentAttachment[];
  onChange: (next: AssessmentAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: AssessmentAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await apiClient.uploadAssessmentMedia(file));
      }
      onChange([...attachments, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700">Файлы к заданию</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {busy ? "Загрузка…" : "Загрузить"}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Изображения, PDF, видео и аудио: схемы, инструкции, образцы, фрагменты профессиональной ситуации.
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={ASSESSMENT_MEDIA_ACCEPT}
        onChange={(e) => addFiles(e.target.files)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 text-sm rounded-md border border-gray-200 px-2 py-1.5"
            >
              <span className="truncate">
                {item.name}
                <span className="ml-2 text-xs text-gray-500">
                  {ASSESSMENT_MEDIA_KIND_LABELS[item.kind]}
                  {item.size ? ` · ${formatAttachmentSize(item.size)}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="text-red-600 text-xs hover:underline shrink-0"
                onClick={() => onChange(attachments.filter((row) => row.id !== item.id))}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">Файлы не прикреплены</p>
      )}
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
  if (task.method === "testing") {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Тип задания</label>
          <select
            value={task.itemType}
            onChange={(e) => onChange({ itemType: e.target.value as TestItemType })}
            className="form-control max-w-xs"
          >
            {TEST_ITEM_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Текст вопроса"
          value={task.prompt}
          onChange={(prompt) => onChange({ prompt })}
          rows={2}
          placeholder="Сформулируйте вопрос к конкретному знанию или интеллектуальному умению…"
        />
        {task.itemType !== "open" ? (
          <OptionsEditor
            taskId={task.id}
            itemType={task.itemType}
            options={task.options}
            onChange={(options) => onChange({ options })}
          />
        ) : null}
      </div>
    );
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

function OptionsEditor({
  taskId,
  itemType,
  options,
  onChange,
}: {
  taskId: string;
  itemType: TestItemType;
  options: AssessmentOption[];
  onChange: (options: AssessmentOption[]) => void;
}) {
  const showCorrect = itemType === "single" || itemType === "multiple";
  const hint =
    itemType === "match"
      ? "Каждый вариант — пара «элемент — соответствие»."
      : itemType === "sequence"
        ? "Порядок вариантов сверху вниз — правильная последовательность."
        : "Отметьте правильный ответ.";

  const updateOption = (id: string, patch: Partial<AssessmentOption>) => {
    onChange(
      options.map((option) => {
        if (option.id !== id) {
          if (showCorrect && itemType === "single" && patch.isCorrect) {
            return { ...option, isCorrect: false };
          }
          return option;
        }
        return { ...option, ...patch };
      }),
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Варианты ответов</p>
      <p className="text-xs text-gray-500">{hint}</p>
      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          {showCorrect ? (
            <input
              type={itemType === "single" ? "radio" : "checkbox"}
              name={`correct-${taskId}`}
              checked={option.isCorrect}
              onChange={(e) => updateOption(option.id, { isCorrect: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
              aria-label={`Правильный вариант ${index + 1}`}
            />
          ) : (
            <span className="w-6 text-xs text-gray-400">{index + 1}.</span>
          )}
          <input
            value={option.text}
            onChange={(e) => updateOption(option.id, { text: e.target.value })}
            className="form-control"
            placeholder={`Вариант ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(options.filter((item) => item.id !== option.id))}
            className="text-red-600 shrink-0"
            aria-label="Удалить вариант"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, emptyAssessmentOption()])}
      >
        <Plus className="w-3.5 h-3.5" />
        Добавить вариант
      </Button>
    </div>
  );
}
