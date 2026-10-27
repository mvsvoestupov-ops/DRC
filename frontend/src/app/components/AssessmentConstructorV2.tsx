import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileEdit, Plus, Save, Trash2 } from "lucide-react";
import { FORMATION_LEVELS, type FormationLevel } from "@/lib/competenceMappers";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";
import {
  buildPracticalTree,
  createPracticalTask,
  listKnowledgeComponents,
  listPracticalComponents,
  practicalCoverage,
  practiceDashboardStats,
  syncAssessmentByLevelV2,
  theoryDashboardStats,
  toggleComponentInTask,
  type AssessmentByLevelV2,
  type AssessmentV2PracticalTask,
  type AssessmentV2TestItem,
  type PracticalComponent,
} from "@/lib/assessmentV2";
import { isAssessmentTaskComplete } from "@/lib/assessmentConstructor";
import { AssessmentTestingFields } from "@/app/components/AssessmentTestingFields";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  structure: StructureABC;
  value: AssessmentByLevelV2;
  onChange: (next: AssessmentByLevelV2) => void;
};

type Screen = "dashboard" | "theory" | "practice-compose" | "practice-details";

export function AssessmentConstructorV2({ structure, value, onChange }: Props) {
  const { t } = useI18n();
  const [level, setLevel] = useState<FormationLevel>("базовый");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [theoryStage, setTheoryStage] = useState<"content" | "criteria">("content");
  const [showTheoryReq, setShowTheoryReq] = useState(false);
  const [showPracticeReq, setShowPracticeReq] = useState(false);

  const synced = useMemo(() => syncAssessmentByLevelV2(structure, value), [structure, value]);
  const block = synced[level];
  const knowledge = listKnowledgeComponents(structure);
  const practical = listPracticalComponents(structure);
  const tree = buildPracticalTree(structure);
  const coverage = practicalCoverage(structure, block.practicalTasks);
  const theory = theoryDashboardStats(structure, block.tests);
  const practice = practiceDashboardStats(structure, block.practicalTasks);
  const canOpenPracticeDetails =
    block.compositionDone ||
    coverage.complete ||
    block.practicalTasks.some(
      (task) =>
        Boolean(task.prompt.trim()) ||
        Boolean(task.description.trim()) ||
        Boolean(task.instruction.trim()) ||
        (task.criteria || []).some((item) => String(item || "").trim()),
    );
  const byId = useMemo(
    () => new Map(practical.map((item) => [item.id, item])),
    [practical],
  );

  const activeTask =
    block.practicalTasks.find((task) => task.id === activeTaskId) ||
    block.practicalTasks[0] ||
    null;

  const activeTest =
    block.tests.find((task) => task.id === activeTestId) || block.tests[0] || null;

  useEffect(() => {
    if (screen !== "theory") return;
    if (activeTestId && block.tests.some((task) => task.id === activeTestId)) return;
    setActiveTestId(block.tests[0]?.id ?? null);
  }, [screen, activeTestId, block.tests]);

  const commit = (nextBlock: typeof block) => {
    onChange({
      ...synced,
      [level]: nextBlock,
    });
  };

  const updateTest = (testId: string, patch: Partial<AssessmentV2TestItem>) => {
    // Как на шаге 6: нельзя менять привязку — один тест = одно знание A
    const { componentIds: _ignored, method: _method, planKey: _planKey, ...safe } = patch;
    commit({
      ...block,
      tests: block.tests.map((item) => {
        if (item.id !== testId) return item;
        const componentId = item.componentIds[0];
        return {
          ...item,
          ...safe,
          method: "testing",
          componentIds: componentId ? [componentId] : item.componentIds,
          planKey: componentId ? `testing:${componentId}` : item.planKey,
        };
      }),
    });
  };

  const setTasks = (practicalTasks: AssessmentV2PracticalTask[], compositionDone = false) => {
    const nextCoverage = practicalCoverage(structure, practicalTasks);
    commit({
      ...block,
      practicalTasks,
      compositionDone: compositionDone && nextCoverage.complete,
    });
  };

  const addTask = () => {
    const task = createPracticalTask(block.practicalTasks.length + 1);
    setTasks([...block.practicalTasks, task], false);
    setActiveTaskId(task.id);
    setScreen("practice-compose");
  };

  const removeTask = (taskId: string) => {
    const practicalTasks = block.practicalTasks.filter((task) => task.id !== taskId);
    setTasks(practicalTasks, false);
    if (activeTaskId === taskId) setActiveTaskId(practicalTasks[0]?.id || null);
  };

  const updateTask = (taskId: string, patch: Partial<AssessmentV2PracticalTask>) => {
    setTasks(
      block.practicalTasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      block.compositionDone,
    );
  };

  const finishComposition = () => {
    if (!coverage.complete) return;
    commit({ ...block, compositionDone: true });
    setScreen("practice-details");
  };

  const usedIds = useMemo(
    () => new Set(block.practicalTasks.flatMap((task) => task.componentIds)),
    [block.practicalTasks],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("assessmentV2.badge")}
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-1">{t("assessmentV2.title")}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">{t("assessmentV2.lead")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FORMATION_LEVELS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setLevel(item);
              setScreen("dashboard");
              setActiveTaskId(null);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              level === item
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-200 hover:border-primary/40",
            )}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {screen === "dashboard" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DashboardCard
            title={t("assessmentV2.theoryTitle")}
            progress={theory.percent}
            requirementsOpen={showTheoryReq}
            onToggleRequirements={() => setShowTheoryReq((v) => !v)}
            requirements={t("assessmentV2.theoryRequirements")}
            onEditor={() => setScreen("theory")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-2 font-medium" />
                  <th className="py-2 px-2 font-medium text-center">{t("assessmentV2.colKnowledge")}</th>
                  <th className="py-2 pl-2 font-medium text-center">{t("assessmentV2.colTotal")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                <DashRow label={t("assessmentV2.rowQuantity")} a={theory.quantity} total={theory.quantity} />
                <DashRow
                  label={t("assessmentV2.rowTestsCreated")}
                  a={`${theory.created}/${theory.quantity}`}
                  total={`${theory.created}/${theory.quantity}`}
                />
                <DashRow
                  label={t("assessmentV2.rowWithAnswers")}
                  a={`${theory.withAnswers}/${theory.quantity}`}
                  total={`${theory.withAnswers}/${theory.quantity}`}
                />
                <DashRow
                  label={t("assessmentV2.rowWithoutAnswers")}
                  a={theory.withoutAnswers}
                  total={theory.withoutAnswers}
                />
                <DashRow
                  label={t("assessmentV2.rowIncomplete")}
                  a={theory.incomplete}
                  total={theory.incomplete}
                />
              </tbody>
            </table>
          </DashboardCard>

          <DashboardCard
            title={t("assessmentV2.practiceTitleShort")}
            progress={practice.coverage.percent}
            progressLabel={t("assessmentV2.skillsCovered")}
            requirementsOpen={showPracticeReq}
            onToggleRequirements={() => setShowPracticeReq((v) => !v)}
            requirements={t("assessmentV2.practiceRequirements")}
            onEditor={() =>
              setScreen(canOpenPracticeDetails ? "practice-details" : "practice-compose")
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-2 font-medium">{t("assessmentV2.colTask")}</th>
                  <th className="py-2 px-2 font-medium text-center">{t("assessmentV2.colVariants")}</th>
                  <th className="py-2 pl-2 font-medium text-center">{t("assessmentV2.colSkills")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {practice.tasks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400">
                      {t("assessmentV2.noTasksYet")}
                    </td>
                  </tr>
                ) : (
                  practice.tasks.map((task, index) => (
                    <tr key={task.id} className="border-b border-gray-50">
                      <td className="py-2 pr-2">
                        {index + 1}. {task.name}
                      </td>
                      <td className="py-2 px-2 text-center">{task.variants}</td>
                      <td className="py-2 pl-2 text-center">{task.skills}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DashboardCard>
        </div>
      ) : null}

      {screen !== "dashboard" ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setScreen("dashboard")} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            {t("assessmentV2.backToDashboard")}
          </Button>
        </div>
      ) : null}

      {screen === "theory" ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-primary">{t("assessmentV2.knowledgeTitle")}</h3>
            <p className="text-xs text-gray-600 mt-1">{t("assessmentV2.knowledgeLead")}</p>
          </div>
          {knowledge.length === 0 ? (
            <p className="text-sm text-gray-500">{t("assessmentV2.noKnowledge")}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
              <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                {block.tests.map((task, index) => {
                  const complete = isAssessmentTaskComplete(task);
                  const comp = knowledge.find((item) => item.id === task.componentIds[0]);
                  const active = task.id === activeTest?.id;
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTestId(task.id);
                          setTheoryStage("content");
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2",
                          active ? "bg-blue-50" : "hover:bg-gray-50",
                        )}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {index + 1}. {t("assessment.testingShort")}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {comp?.code || t("wizard.noComponents")} ·{" "}
                          {complete ? t("wizard.filled") : t("wizard.draft")}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {activeTest ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      {t("assessment.testingShort")}
                    </h4>
                    {(() => {
                      const comp = knowledge.find((item) => item.id === activeTest.componentIds[0]);
                      if (!comp) return null;
                      return (
                        <div className="mt-2 space-y-1">
                          <span className="inline-flex rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                            {comp.code}
                          </span>
                          <p className="text-xs text-gray-600 leading-snug">{comp.text}</p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTheoryStage("content")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        theoryStage === "content"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600",
                      )}
                    >
                      {t("assessmentV2.contentTab")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheoryStage("criteria")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        theoryStage === "criteria"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600",
                      )}
                    >
                      {t("assessmentV2.criteriaTab")}
                    </button>
                  </div>
                  {theoryStage === "content" ? (
                    <AssessmentTestingFields
                      task={activeTest}
                      onChange={(patch) => updateTest(activeTest.id, patch)}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("assessment.taskCriteria")}
                        </label>
                        <textarea
                          value={activeTest.criteria}
                          onChange={(e) => updateTest(activeTest.id, { criteria: e.target.value })}
                          rows={4}
                          className="form-control"
                          placeholder={t("assessmentV2.criteriaPh")}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeTest.forNok}
                          onChange={(e) => updateTest(activeTest.id, { forNok: e.target.checked })}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        {t("detail.nok")}
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t("assessmentV2.selectTest")}</p>
              )}
            </div>
          )}
        </section>
      ) : null}

      {screen === "practice-compose" || screen === "practice-details" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t("assessmentV2.practicalTitle")}</h3>
              <p className="text-xs text-gray-600 mt-1">{t("assessmentV2.composeLead")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScreen("practice-compose")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border",
                  screen === "practice-compose"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200",
                )}
              >
                {t("assessmentV2.phaseCompose")}
              </button>
              <button
                type="button"
                onClick={() => canOpenPracticeDetails && setScreen("practice-details")}
                disabled={!canOpenPracticeDetails}
                title={
                  canOpenPracticeDetails
                    ? undefined
                    : t("assessmentV2.needComposeFirst")
                }
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border",
                  screen === "practice-details"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200",
                  !canOpenPracticeDetails && "opacity-50 cursor-not-allowed",
                )}
              >
                {t("assessmentV2.phaseDetails")}
              </button>
            </div>
          </div>

          {practical.length === 0 ? (
            <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 p-4">
              {t("assessmentV2.noPractical")}
            </p>
          ) : screen === "practice-compose" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p
                  className={cn(
                    "text-sm",
                    coverage.complete ? "text-green-700 font-medium" : "text-gray-700",
                  )}
                >
                  {t("assessmentV2.coverage", {
                    covered: coverage.covered,
                    total: coverage.total,
                  })}
                  {coverage.complete ? ` · ${t("assessmentV2.coverageComplete")}` : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addTask} className="gap-1">
                    <Plus className="w-4 h-4" />
                    {t("assessmentV2.addTask")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={finishComposition}
                    disabled={!coverage.complete || block.practicalTasks.length === 0}
                    className="gap-1"
                  >
                    <Check className="w-4 h-4" />
                    {t("assessmentV2.finishCompose")}
                  </Button>
                </div>
              </div>

              {block.practicalTasks.length === 0 ? (
                <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 p-4">
                  {t("assessmentV2.noTasksYet")}
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                  <aside className="space-y-2">
                    {block.practicalTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(task.id)}
                          className={cn(
                            "flex-1 text-left px-3 py-2 rounded-lg border text-sm font-medium truncate",
                            (activeTask?.id || "") === task.id
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-gray-200 bg-white text-gray-800 hover:border-primary/40",
                          )}
                        >
                          {task.name || t("assessmentV2.unnamedTask")}
                          <span className="block text-[11px] font-normal text-gray-500">
                            {task.componentIds.length} {t("assessmentV2.componentsShort")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTask(task.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </aside>

                  {activeTask ? (
                    <TaskCompositionEditor
                      task={activeTask}
                      tree={tree}
                      usedIds={usedIds}
                      onRename={(name) => updateTask(activeTask.id, { name })}
                      onToggle={(componentId, checked) =>
                        setTasks(
                          toggleComponentInTask(
                            block.practicalTasks,
                            activeTask.id,
                            componentId,
                            checked,
                          ),
                          false,
                        )
                      }
                      onSave={() => {
                        const nextIncomplete = block.practicalTasks.find(
                          (task) =>
                            task.id !== activeTask.id && task.componentIds.length === 0,
                        );
                        if (nextIncomplete) setActiveTaskId(nextIncomplete.id);
                      }}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {block.practicalTasks.map((task) => (
                <PracticalTaskCard
                  key={task.id}
                  task={task}
                  components={task.componentIds
                    .map((id) => byId.get(id))
                    .filter((item): item is PracticalComponent => Boolean(item))}
                  onChange={(patch) => updateTask(task.id, patch)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function DashRow({
  label,
  a,
  total,
}: {
  label: string;
  a: string | number;
  total: string | number;
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-2 pr-2 text-gray-600">{label}</td>
      <td className="py-2 px-2 text-center font-medium">{a}</td>
      <td className="py-2 pl-2 text-center font-medium">{total}</td>
    </tr>
  );
}

function DashboardCard({
  title,
  progress,
  progressLabel,
  requirements,
  requirementsOpen,
  onToggleRequirements,
  onEditor,
  children,
}: {
  title: string;
  progress: number;
  progressLabel?: string;
  requirements: string;
  requirementsOpen: boolean;
  onToggleRequirements: () => void;
  onEditor: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-gray-200 bg-slate-100/80 p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        <h3 className="text-base font-semibold text-sky-700">{title}</h3>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 overflow-x-auto">{children}</div>

      {progressLabel ? (
        <p className="text-xs font-medium text-gray-600">{progressLabel}</p>
      ) : null}
      <div className="h-7 rounded-md bg-sky-600 text-white text-sm font-semibold flex items-center justify-center">
        {progress}%
      </div>

      {requirementsOpen ? (
        <p className="text-xs text-gray-600 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
          {requirements}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-between pt-1">
        <Button
          type="button"
          size="sm"
          onClick={onToggleRequirements}
          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-4 h-4" />
          {t("assessmentV2.requirements")}
        </Button>
        <Button type="button" size="sm" onClick={onEditor} className="gap-1">
          <FileEdit className="w-4 h-4" />
          {t("assessmentV2.editor")}
        </Button>
      </div>
    </section>
  );
}

function TaskCompositionEditor({
  task,
  tree,
  usedIds,
  onRename,
  onToggle,
  onSave,
}: {
  task: AssessmentV2PracticalTask;
  tree: ReturnType<typeof buildPracticalTree>;
  usedIds: Set<string>;
  onRename: (name: string) => void;
  onToggle: (componentId: string, checked: boolean) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const selected = new Set(task.componentIds);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">{t("assessmentV2.taskName")}</span>
        <input
          value={task.name}
          onChange={(e) => onRename(e.target.value)}
          className="form-control w-full"
          placeholder={t("assessmentV2.taskNamePh")}
        />
      </label>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-800">{t("assessmentV2.treeTitle")}</h4>
        <p className="text-xs text-green-700">{t("assessmentV2.treeHint")}</p>
        <p className="text-xs text-gray-500">{t("assessmentV2.treeLeafOnly")}</p>

        <div className="rounded-lg border border-gray-200 max-h-[28rem] overflow-auto p-3 space-y-3">
          {tree.map((tf) => {
            const tfIds = tf.tds.flatMap((td) => td.items.map((item) => item.id));
            const tfUsed = tfIds.some((id) => usedIds.has(id));
            return (
              <div key={tf.key} className="space-y-2">
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    tfUsed ? "text-green-700" : "text-gray-800",
                  )}
                >
                  {tf.tfCode === "—" ? t("assessmentV2.noTf") : tf.tfCode}
                </p>
                <div className="pl-4 space-y-2">
                  {tf.tds.map((td) => {
                    const tdIds = td.items.map((item) => item.id);
                    const tdUsed = tdIds.some((id) => usedIds.has(id));
                    return (
                      <div key={td.key} className="space-y-1.5">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            tdUsed ? "text-green-700" : "text-gray-700",
                          )}
                        >
                          {td.tdText}
                        </p>
                        <div className="pl-4 space-y-1">
                          {td.items.map((item) => (
                            <label key={item.id} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={selected.has(item.id)}
                                onChange={(e) => onToggle(item.id, e.target.checked)}
                              />
                              <span
                                className={cn(
                                  "text-sm leading-snug",
                                  usedIds.has(item.id) ? "text-green-700" : "text-gray-800",
                                )}
                              >
                                {item.code}. {item.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center pt-1">
        <Button type="button" onClick={onSave} className="gap-2 min-w-[10rem]">
          <Save className="w-4 h-4" />
          {t("common.save")}
        </Button>
      </div>
    </article>
  );
}

function PracticalTaskCard({
  task,
  components,
  onChange,
}: {
  task: AssessmentV2PracticalTask;
  components: PracticalComponent[];
  onChange: (patch: Partial<AssessmentV2PracticalTask>) => void;
}) {
  const { t } = useI18n();

  const setCriterion = (index: number, text: string) => {
    const criteria = [...task.criteria];
    criteria[index] = text;
    onChange({ criteria });
  };

  const addCriterion = () => onChange({ criteria: [...task.criteria, ""] });
  const removeCriterion = (index: number) => {
    const criteria = task.criteria.filter((_, i) => i !== index);
    onChange({ criteria: criteria.length ? criteria : [""] });
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
      <h4 className="text-base font-semibold text-gray-900">{task.name}</h4>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-500">{t("assessmentV2.prompt")}</span>
        <textarea
          value={task.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={6}
          className="form-control w-full min-h-[8rem]"
          placeholder={t("assessmentV2.promptPh")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-500">{t("assessmentV2.instruction")}</span>
        <input
          value={task.instruction}
          onChange={(e) => onChange({ instruction: e.target.value })}
          className="form-control w-full"
          placeholder={t("assessmentV2.instructionPh")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-500">{t("assessmentV2.description")}</span>
        <textarea
          value={task.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="form-control w-full"
          placeholder={t("assessmentV2.descriptionPh")}
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-500">{t("assessmentV2.location")}</span>
          <input
            value={task.location}
            onChange={(e) => onChange({ location: e.target.value })}
            className="form-control w-full"
            placeholder={t("assessmentV2.locationPh")}
          />
        </label>
        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-500">{t("assessmentV2.components")}</span>
          <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 content-start">
            {components.length === 0 ? (
              <span className="text-xs text-gray-400">—</span>
            ) : (
              components.map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    "inline-flex items-center rounded-md text-[11px] font-semibold px-2 py-0.5 border",
                    item.category === "B"
                      ? "bg-green-50 text-green-800 border-green-100"
                      : "bg-purple-50 text-purple-800 border-purple-100",
                  )}
                  title={item.text}
                >
                  {item.code}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-500">{t("assessmentV2.criteria")}</span>
        <div className="space-y-2">
          {task.criteria.map((line, index) => (
            <div key={`${task.id}-c-${index}`} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-3 w-4 shrink-0">{index + 1}.</span>
              <input
                value={line}
                onChange={(e) => setCriterion(index, e.target.value)}
                className="form-control flex-1"
                placeholder={t("assessmentV2.criteriaPh")}
              />
              <button
                type="button"
                onClick={() => removeCriterion(index)}
                className="mt-1 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                aria-label={t("common.delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCriterion} className="gap-1">
          <Plus className="w-4 h-4" />
          {t("assessmentV2.addCriterion")}
        </Button>
      </div>
    </article>
  );
}
