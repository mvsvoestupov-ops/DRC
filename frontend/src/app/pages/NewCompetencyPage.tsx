import { useState, useEffect, useCallback, useMemo, useRef, type SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Award, FileDown, Loader2, Plus, Save, Send, X } from "lucide-react";
import { DESCRIPTOR_CATEGORIES, FORMATION_LEVELS, formationLevelsForEducation } from "@/lib/competenceMappers";
import { DISCIPLINE_CONTROL_I18N_KEYS } from "@/lib/disciplineControl";
import { PROFESSIONAL_AREAS, areaDisplayCode, findProfessionalArea, formatProfessionalAreaLabel } from "@/lib/professionalAreas";
import {
  buildStructureFromLaborFunctions,
  emptyStructure,
  pruneStructureToSelectedTfs,
  structureFromPayload,
  structureToPayload,
  type LaborFunctionDetail,
  type StructureABC,
} from "@/lib/structureFromLaborFunctions";
import {
  buildStructureFromTdZu,
  confirmTdZuState,
  emptyTdZuState,
  incompleteTdZuCards,
  parseTdZuState,
  syncTdZuCardsFromStructure,
  type TdZuState,
} from "@/lib/tdZuDistribution";
import { WorkFunctionsSelectTree } from "@/app/components/WorkFunctionsSelectTree";
import { ResourcesMtoEditor } from "@/app/components/ResourcesMtoEditor";
import {
  emptyCompetenceResources,
  parseCompetenceResources,
  resourcesFilled,
  resourcesPayload,
  trimResourceList,
  type CompetenceResources,
} from "@/lib/competenceResources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import type { Competence, MatrixContext, QualificationLevelRef } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import {
  translateKeyed,
  translateAreaName,
  EDUCATION_KIND_I18N_KEYS,
  EDUCATION_LEVEL_I18N_KEYS,
  DESCRIPTOR_I18N_KEYS,
  FORMATION_I18N_KEYS,
} from "@/i18n/helpers";
import { WorkingGroupDialog } from "@/app/components/WorkingGroupPanel";
import {
  CollaborationCursors,
  CollaborationPresenceBar,
  CollaborationStepDots,
  readPresenceFragment,
} from "@/app/components/CollaborationPresence";
import { StepChatBadge, StepChatPanel } from "@/app/components/StepChatPanel";
import { DevelopmentDeadlineCard, DevelopmentProgressBar } from "@/app/components/ProjectActivityPanel";
import { useCollaborationPresence } from "@/lib/collaborationPresence";
import { PageShell } from "@/app/components/PageShell";
import { cn } from "@/lib/utils";
import { StructureABCEditor } from "@/app/components/StructureABCEditor";
import {
  ProfStandardSearchPicker,
  type ProfStandardSearchItem,
} from "@/app/components/ProfStandardSearchPicker";
import {
  ProfTrainingProfessionPicker,
  type ProfTrainingProfessionItem,
} from "@/app/components/ProfTrainingProfessionPicker";
import {
  FgosSearchPicker,
  FGOS_CATEGORIES_BY_EDUCATION_LEVEL,
  ALL_FGOS_CATEGORY_IDS,
  type FgosSearchItem,
} from "@/app/components/FgosSearchPicker";
import {
  allowedTfLevelRange,
  isTfLevelInRange,
  formatTfLevel,
  parseTfLevel,
  tfDisabledReason,
  tfLevelRangeHint,
} from "@/lib/tfLevelRules";
import {
  DescriptorEditor,
  createEmptyDescriptors,
  normalizeDescriptorMap,
  stripBlockedExpertDescriptors,
  type DescriptorMap,
} from "@/app/components/DescriptorEditor";
import {
  DisciplineMappingEditor,
  flattenDisciplineMapping,
  formatScaleScore,
  groupDisciplineMapping,
  syncDisciplineMapping,
  type DisciplineMappingRow,
} from "@/app/components/DisciplineMappingEditor";
import { AssessmentConstructor } from "@/app/components/AssessmentConstructor";
import { ExpertiseChecklistForm } from "@/app/components/ExpertiseChecklist";
import {
  InternationalMappingPreview,
  InternationalMappingStep,
} from "@/app/components/InternationalMappingStep";
import {
  HarmoniBricsPreview,
  HarmoniBricsStep,
} from "@/app/components/HarmoniBricsStep";
import { HarmonizationStep92 } from "@/app/components/HarmonizationStep92";
import {
  analyzeInternationalMapping,
  applyGarmEscoSuggest,
  emptyInternationalMapping,
  normalizeInternationalMapping,
  type InternationalMapping,
} from "@/lib/internationalMapping";
import {
  applySuggestToMapping,
  emptyHarmoniBricsMapping,
  normalizeHarmoniBricsMapping,
  type HarmoniBricsMapping,
} from "@/lib/harmoniBrics";
import {
  EXPERTISE_CRITERIA,
  criterionKey,
  type ExpertiseChecklist,
} from "@/lib/expertiseCriteria";
import {
  assessmentMethodLabel,
  assessmentToolsToByLevel,
  assessmentWizardErrorMessage,
  emptyAssessmentByLevel,
  flattenAssessmentTools,
  getAssessmentCoverage,
  isAssessmentTaskComplete,
  listStructureComponents,
  normalizeAssessmentByLevel,
  syncAssessmentByLevel,
  uniqueAssessmentMethodLabels,
} from "@/lib/assessmentConstructor";

type CompetenceKind = "professional" | "general" | "universal";

const EDUCATION_KINDS = [
  "профессиональное образование",
  "профессиональное обучение",
  "дополнительное образование",
] as const;

type EducationKind = (typeof EDUCATION_KINDS)[number] | "";

const PROFESSIONAL_EDUCATION_LEVELS = [
  "среднее профессиональное образование",
  "высшее образование - бакалавриат",
  "высшее образование - специалитет, магистратура",
  "высшее образование - подготовка кадров высшей квалификации",
] as const;

function PreviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-500 mb-1">{label}</h4>
      <p className="text-base text-gray-900 leading-relaxed">{value?.trim() || "—"}</p>
    </div>
  );
}

/** Один create на открытие /new (в т.ч. React Strict Mode) */
let newCompetenceBootstrapInFlight: Promise<Competence | null> | null = null;
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
const DRAFT_PLACEHOLDER_NAME = "DRAFT-PENDING";

export function NewCompetencyPage() {
  const navigate = useNavigate();
  const { id: editIdParam } = useParams<{ id?: string }>();
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = Boolean(editId);
  const { isAuthenticated, user, isIntlMethodologist } = useAuth();
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStandards, setSelectedStandards] = useState<ProfStandardSearchItem[]>([]);
  const [selectedTrainingProfession, setSelectedTrainingProfession] =
    useState<ProfTrainingProfessionItem | null>(null);
  const [selectedFgos, setSelectedFgos] = useState<FgosSearchItem | null>(null);
  const [laborFunctions, setLaborFunctions] = useState<LaborFunctionDetail[]>([]);
  const [laborFunctionsLoading, setLaborFunctionsLoading] = useState(false);
  const [recommendedStandards, setRecommendedStandards] = useState<ProfStandardSearchItem[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [expandedTfIds, setExpandedTfIds] = useState<number[]>([]);
  const [qualificationLevels, setQualificationLevels] = useState<QualificationLevelRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [applyingMatrix, setApplyingMatrix] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [error, setError] = useState("");
  const [canSubmitToReview, setCanSubmitToReview] = useState(true);
  const [hydrating, setHydrating] = useState(Boolean(editId));
  const [workingCompetence, setWorkingCompetence] = useState<Competence | null>(null);
  const [nameBarStuck, setNameBarStuck] = useState(false);
  const [chatCounts, setChatCounts] = useState<Record<number, number>>({});
  const nameBarSentinelRef = useRef<HTMLDivElement>(null);
  const wizardSurfaceRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    professionalAreaCode: "",
    educationLevel: "",
    educationKind: EDUCATION_KINDS[0] as EducationKind,
    trainingProfessionId: null as number | null,
    trainingProfessionName: "",
    trainingProfessionOkpdtr: "",
    fgosId: null as number | null,
    fgosCode: "",
    fgosName: "",
    fgosCategory: "",
    workload: "",
    developer: "",
    structure: emptyStructure(),
    profStandardId: null as number | null,
    selectedLaborFunctionIds: [] as number[],
    qualificationLevel: "",
    competenceKind: "professional" as CompetenceKind,
    descriptors: createEmptyDescriptors(),
    matrixContext: null as MatrixContext | null,
    assessmentByLevel: emptyAssessmentByLevel(),
    disciplineMapping: [] as DisciplineMappingRow[],
    resources: emptyCompetenceResources() as CompetenceResources,
    expertise: {} as ExpertiseChecklist,
    internationalMapping: emptyInternationalMapping() as InternationalMapping,
    harmoniBrics: emptyHarmoniBricsMapping() as HarmoniBricsMapping,
    tdZu: emptyTdZuState() as TdZuState,
  });
  const [hbBusy, setHbBusy] = useState(false);
  const [hbError, setHbError] = useState<string | null>(null);
  const [garmBusy, setGarmBusy] = useState(false);
  const [garmError, setGarmError] = useState<string | null>(null);
  const [aiAgentConfigured, setAiAgentConfigured] = useState<boolean | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const formDataRef = useRef(formData);
  const currentStepRef = useRef(currentStep);
  const workingCompetenceRef = useRef(workingCompetence);
  const autoSavingRef = useRef(autoSaving);
  const submittingRef = useRef(submitting);
  formDataRef.current = formData;
  currentStepRef.current = currentStep;
  workingCompetenceRef.current = workingCompetence;
  autoSavingRef.current = autoSaving;
  submittingRef.current = submitting;

  const steps = useMemo(() => {
    const list = [
      { number: 1, name: t("wizard.step1"), label: "1" },
      { number: 2, name: t("wizard.step2"), label: "2" },
      { number: 3, name: t("wizard.step3"), label: "3" },
      { number: 4, name: t("wizard.step4"), label: "4" },
      { number: 5, name: t("wizard.step5"), label: "5" },
      { number: 6, name: t("wizard.step6"), label: "6" },
      { number: 7, name: t("wizard.step7"), label: "7" },
      { number: 8, name: t("wizard.step8"), label: "8" },
      { number: 9, name: t("wizard.step9"), label: "9" },
      { number: 10, name: t("wizard.step91"), label: "9.1" },
    ];
    if (isIntlMethodologist) {
      list.push({ number: 11, name: t("wizard.step92"), label: "9.2" });
      list.push({ number: 12, name: t("wizard.step10"), label: "10" });
    } else {
      list.push({ number: 11, name: t("wizard.step10"), label: "10" });
    }
    return list;
  }, [t, isIntlMethodologist]);
  const lastStep = steps.length;
  const competenceId = editId || workingCompetence?.id || null;
  const { peers, setFragment: setPresenceFragment } = useCollaborationPresence({
    competenceId,
    step: currentStep,
    enabled: isAuthenticated && Boolean(competenceId),
  });
  const markPresenceFragment = (event: SyntheticEvent) => {
    setPresenceFragment(readPresenceFragment(event, `step:${currentStep}`));
  };

  const educationLevels = [...PROFESSIONAL_EDUCATION_LEVELS];
  const needsFgosSearch =
    formData.educationKind === "профессиональное образование" ||
    formData.educationKind === "дополнительное образование";
  const fgosCategories =
    formData.educationKind === "дополнительное образование" && !formData.educationLevel
      ? ALL_FGOS_CATEGORY_IDS
      : FGOS_CATEGORIES_BY_EDUCATION_LEVEL[formData.educationLevel] || [];
  const showFgosPicker =
    needsFgosSearch &&
    (formData.educationKind === "дополнительное образование" || Boolean(formData.educationLevel));
  const recommendedOkpdtr = formData.trainingProfessionOkpdtr.trim();
  const showOksoRecommended = Boolean(formData.fgosCode);
  const showOkpdtrRecommended =
    formData.educationKind === "профессиональное обучение" && Boolean(formData.trainingProfessionId);
  const showRecommended = showOksoRecommended || showOkpdtrRecommended;
  const tfLevelRange = allowedTfLevelRange(formData.educationKind, formData.educationLevel);
  const lockedTfLevel = useMemo(() => {
    const selected = laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id));
    if (selected.length === 0) return null;
    return parseTfLevel(selected[0]?.otf_level, selected[0]?.code);
  }, [laborFunctions, formData.selectedLaborFunctionIds]);
  const allowedQualificationLevels = useMemo(() => {
    if (!tfLevelRange) return qualificationLevels;
    return qualificationLevels.filter((level) => {
      const n = Number(level.qualification_level);
      return n >= tfLevelRange.min && n <= tfLevelRange.max;
    });
  }, [qualificationLevels, tfLevelRange]);

  const competenceKinds: { value: CompetenceKind; label: string }[] = [
    { value: "professional", label: t("competenceKind.professional") },
    { value: "general", label: t("competenceKind.general") },
    { value: "universal", label: t("competenceKind.universal") },
  ];

  const structurePayload = structureToPayload(formData.structure);

  const selectedLaborFunctions = useMemo(
    () => laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id)),
    [laborFunctions, formData.selectedLaborFunctionIds],
  );

  const runInternationalMapping = useCallback(async () => {
    let nextLabor = laborFunctions;
    const standardIds = [
      ...new Set(
        laborFunctions
          .map((lf) => lf.standard_id)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    ];
    if (standardIds.length > 0) {
      try {
        const batches = await Promise.all(
          standardIds.map((id) =>
            apiClient.getLaborFunctions(id).catch(() => [] as LaborFunctionDetail[]),
          ),
        );
        const byId = new Map<number, LaborFunctionDetail>();
        for (const batch of batches) {
          for (const lf of Array.isArray(batch) ? batch : []) {
            byId.set(lf.id, lf);
          }
        }
        if (byId.size > 0) {
          nextLabor = laborFunctions.map((lf) => {
            const fresh = byId.get(lf.id);
            if (!fresh) return lf;
            const okz = Array.isArray(fresh.okz_codes) ? fresh.okz_codes : lf.okz_codes;
            return okz && okz.length ? { ...lf, okz_codes: okz } : lf;
          });
          setLaborFunctions(nextLabor);
        }
      } catch {
        /* оставляем текущие ТФ */
      }
    }
    setFormData((prev) => ({
      ...prev,
      internationalMapping: analyzeInternationalMapping({
        competenceKind: prev.competenceKind,
        title: prev.title,
        qualificationLevel: prev.qualificationLevel,
        educationKind: prev.educationKind,
        educationLevel: prev.educationLevel,
        professionalAreaCode: prev.professionalAreaCode,
        fgosCode: prev.fgosCode,
        laborFunctions: nextLabor.filter((lf) => prev.selectedLaborFunctionIds.includes(lf.id)),
        structure: prev.structure,
      }),
    }));
  }, [laborFunctions]);

  useEffect(() => {
    if (currentStep !== 9) return;
    if (formData.internationalMapping.analyzedAt) return;
    void runInternationalMapping();
  }, [currentStep, formData.internationalMapping.analyzedAt, runInternationalMapping]);

  const askHarmoniBrics = useCallback(async () => {
    if (!formData.harmoniBrics.targetCountry) {
      setHbError(t("wizard.hbNeedCountry"));
      return;
    }
    setHbBusy(true);
    setHbError(null);
    try {
      const texts = (items: { text: string }[]) =>
        items.map((item) => item.text.trim()).filter(Boolean);
      const mapping = formData.internationalMapping;
      const result = await apiClient.suggestHarmoniBrics({
        target_country: formData.harmoniBrics.targetCountry,
        title: formData.title,
        description: formData.description,
        competence_kind: formData.competenceKind,
        qualification_level: formData.qualificationLevel,
        education_kind: formData.educationKind,
        education_level: formData.educationLevel,
        professional_area_code: formData.professionalAreaCode,
        fgos_code: formData.fgosCode,
        okz: mapping.okz,
        isco: mapping.isco || formData.harmoniBrics.isco,
        eqf_occupational: mapping.eqfOccupational,
        eqf_educational: mapping.eqfEducational,
        admitted_garm: mapping.admitted,
        esco_occupation: mapping.escoOccupation,
        labor_functions: selectedLaborFunctions.map((lf) => ({
          code: lf.code,
          name: lf.name,
          otf_level: lf.otf_level,
          okz_codes: lf.okz_codes,
        })),
        structure_a: texts(formData.structure.A),
        structure_b: texts(formData.structure.B),
        structure_c: texts(formData.structure.C),
      });
      const configured = Boolean((result as { status?: { configured?: boolean } }).status?.configured);
      setAiAgentConfigured(configured);
      setFormData((prev) => ({
        ...prev,
        harmoniBrics: applySuggestToMapping(prev.harmoniBrics, result as never),
      }));
    } catch (err) {
      setHbError(err instanceof Error ? err.message : String(err));
    } finally {
      setHbBusy(false);
    }
  }, [formData, selectedLaborFunctions, t]);

  const askGarmEsco = useCallback(async () => {
    setGarmBusy(true);
    setGarmError(null);
    try {
      const texts = (items: { text: string }[]) =>
        items.map((item) => item.text.trim()).filter(Boolean);
      const result = await apiClient.suggestGarmEsco({
        title: formData.title,
        description: formData.description,
        competence_kind: formData.competenceKind,
        qualification_level: formData.qualificationLevel,
        education_kind: formData.educationKind,
        education_level: formData.educationLevel,
        professional_area_code: formData.professionalAreaCode,
        fgos_code: formData.fgosCode,
        labor_functions: selectedLaborFunctions.map((lf) => ({
          code: lf.code,
          name: lf.name,
          otf_level: lf.otf_level,
          otf_code: lf.otf_code,
          okz_codes: lf.okz_codes,
        })),
        structure_a: texts(formData.structure.A),
        structure_b: texts(formData.structure.B),
        structure_c: texts(formData.structure.C),
      });
      const configured = Boolean((result as { status?: { configured?: boolean } }).status?.configured);
      setAiAgentConfigured(configured);
      setFormData((prev) => ({
        ...prev,
        internationalMapping: applyGarmEscoSuggest(prev.internationalMapping, result as never),
      }));
    } catch (err) {
      setGarmError(err instanceof Error ? err.message : String(err));
    } finally {
      setGarmBusy(false);
    }
  }, [formData, selectedLaborFunctions]);

  useEffect(() => {
    if (currentStep !== 9 && currentStep !== 10) return;
    let cancelled = false;
    const loader = currentStep === 9 ? apiClient.getGarmEscoStatus() : apiClient.getHarmoniBricsStatus();
    loader
      .then((status) => {
        if (!cancelled) setAiAgentConfigured(Boolean(status.configured));
      })
      .catch(() => {
        if (!cancelled) setAiAgentConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  const selectedTfKey = formData.selectedLaborFunctionIds.slice().sort((a, b) => a - b).join(",");

  const applyMatrixProfile = useCallback(async () => {
    if (!formData.qualificationLevel) {
      setError(t("wizard.selectQlFirst"));
      return;
    }
    setApplyingMatrix(true);
    setError("");
    try {
      const result = await apiClient.suggestCompetenceProfile({
        qualification_level: formData.qualificationLevel,
        structure: structurePayload,
        competence_kind: formData.competenceKind,
      });
      setFormData((prev) => ({
        ...prev,
        descriptors: stripBlockedExpertDescriptors(
          normalizeDescriptorMap(result.descriptors),
          prev.educationLevel,
        ),
        matrixContext: result.matrix_context,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.matrixError"));
    } finally {
      setApplyingMatrix(false);
    }
  }, [formData.qualificationLevel, formData.competenceKind, formData.structure, t]);

  const toggleLaborFunction = (id: number) => {
    if (formData.tdZu.confirmed) return;
    const target = laborFunctions.find((lf) => lf.id === id);
    const level = parseTfLevel(target?.otf_level, target?.code);
    const alreadySelected = formData.selectedLaborFunctionIds.includes(id);
    if (!alreadySelected && tfDisabledReason(level, tfLevelRange, lockedTfLevel)) {
      return;
    }
    setFormData((prev) => {
      const ids = alreadySelected
        ? prev.selectedLaborFunctionIds.filter((item) => item !== id)
        : [...prev.selectedLaborFunctionIds, id];
      const selected = laborFunctions.filter((lf) => ids.includes(lf.id));
      const otfLevel = selected[0] ? parseTfLevel(selected[0].otf_level, selected[0].code) : null;
      return {
        ...prev,
        selectedLaborFunctionIds: ids,
        qualificationLevel: otfLevel != null ? String(otfLevel) : prev.qualificationLevel,
        tdZu: emptyTdZuState(),
      };
    });
  };

  const confirmTfSelection = () => {
    if (selectedLaborFunctions.length === 0) {
      setError(t("wizard.needTf"));
      return;
    }
    setError("");
    setExpandedTfIds(selectedLaborFunctions.map((lf) => lf.id));
    setFormData((prev) => ({
      ...prev,
      tdZu: confirmTdZuState(selectedLaborFunctions, selectedTfKey, prev.tdZu),
    }));
  };

  const unlockTfSelection = () => {
    setFormData((prev) => ({
      ...prev,
      tdZu: { ...prev.tdZu, confirmed: false },
    }));
  };

  const updateStructure = (structure: StructureABC) => {
    setFormData((prev) => ({
      ...prev,
      structure,
      tdZu: prev.tdZu.confirmed
        ? { ...prev.tdZu, cards: syncTdZuCardsFromStructure(prev.tdZu.cards, structure) }
        : prev.tdZu,
      disciplineMapping: syncDisciplineMapping(structure, prev.disciplineMapping),
      assessmentByLevel: syncAssessmentByLevel(structure, prev.assessmentByLevel),
    }));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getQualificationLevels()
      .then(setQualificationLevels)
      .catch(() => setQualificationLevels([]));
  }, [isAuthenticated]);

  // Новая компетенция: сразу создаём черновик и подставляем ID (RUS-PK-…) в название
  useEffect(() => {
    if (editId || !isAuthenticated || !user) {
      if (editId) newCompetenceBootstrapInFlight = null;
      return;
    }
    if (workingCompetence?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setAutoSaving(true);
        if (!newCompetenceBootstrapInFlight) {
          newCompetenceBootstrapInFlight = apiClient
            .createCompetence({
              name: DRAFT_PLACEHOLDER_NAME,
              qualification_name: DRAFT_PLACEHOLDER_NAME,
              developer: user.email || t("wizard.notSpecified"),
              status: "проект",
              competence_kind: "professional",
              wizard_step: 1,
              description: "",
              labor_functions: [],
              structure: { A: [], B: [], C: [] },
              descriptors: {},
              discipline_mapping: [],
              assessment_tools: [],
              resources: { A: [], B: [], C: [] },
            })
            .catch((err) => {
              newCompetenceBootstrapInFlight = null;
              throw err;
            });
        }
        const saved = await newCompetenceBootstrapInFlight;
        if (cancelled || !saved?.id) return;
        const code = saved.public_code || `RUS-PK-${String(saved.id).padStart(4, "0")}`;
        setWorkingCompetence(saved);
        setFormData((prev) => ({
          ...prev,
          title: code,
          developer: prev.developer || user.email || "",
        }));
        navigate(`/competency/${saved.id}/edit`, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("wizard.saveError"));
        }
      } finally {
        if (!cancelled) setAutoSaving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isAuthenticated, user, workingCompetence?.id, navigate, t]);

  useEffect(() => {
    if (!isAuthenticated || !editId) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    setHydrating(true);
    apiClient.getCompetenceById(editId)
      .then(async (comp) => {
        if (cancelled) return;
        if (!comp?.can_edit) {
          setError(t("wizard.noCollabRights"));
          setHydrating(false);
          return;
        }
        setWorkingCompetence(comp);
        setCanSubmitToReview(
          comp.can_submit_review !== false && comp.collaboration_role !== "member",
        );
        const structure = structureFromPayload(comp.structure || {});
        const grouped = groupDisciplineMapping(comp.discipline_mapping || []);
        const disciplineMapping = syncDisciplineMapping(structure, []).map((row) => {
          const group = grouped.find((item) => item.text === row.text) || grouped.find((item) => item.component === row.component);
          if (!group) return row;
          return {
            ...row,
            importance: group.importance,
            volume: group.volume,
            bindings: group.bindings.length
              ? group.bindings.map((binding) => ({ discipline: binding.discipline, control: binding.control }))
              : row.bindings,
          };
        });
        const assessmentByLevel = assessmentToolsToByLevel(comp.assessment_tools, structure);
        setFormData((prev) => ({
          ...prev,
          title: comp.name || "",
          description: comp.description || "",
          professionalAreaCode: comp.professional_area_code || "",
          educationLevel: comp.education_level || "",
          educationKind: (comp.education_kind as EducationKind) || prev.educationKind,
          trainingProfessionId: comp.education_training_profession_id ?? null,
          trainingProfessionName: comp.education_training_profession || "",
          fgosId: comp.fgos_id ?? null,
          fgosCode: comp.fgos_code || "",
          fgosName: comp.fgos_name || "",
          fgosCategory: comp.fgos_category || "",
          workload: String(comp.hours || ""),
          developer: comp.developer || "",
          structure,
          profStandardId: comp.prof_standard_id ?? null,
          qualificationLevel: String(comp.qualification_level || ""),
          competenceKind: (comp.competence_kind as CompetenceKind) || "professional",
          descriptors: normalizeDescriptorMap(comp.descriptors),
          matrixContext: comp.matrix_context || null,
          assessmentByLevel,
          disciplineMapping,
          resources: parseCompetenceResources(comp.resources),
          expertise: (comp.expertise || {}) as ExpertiseChecklist,
          internationalMapping: normalizeInternationalMapping(comp.international_mapping),
          harmoniBrics: normalizeHarmoniBricsMapping(comp.harmoni_brics),
          tdZu: parseTdZuState(comp.td_zu_mapping),
        }));
        const savedStep = Number(comp.wizard_step);
        if (Number.isFinite(savedStep) && savedStep >= 1) {
          setCurrentStep(Math.min(lastStep, Math.floor(savedStep)));
        }
        if (comp.fgos_id) {
          setSelectedFgos({
            id: comp.fgos_id,
            code: comp.fgos_code || "",
            name: comp.fgos_name || "",
            category: comp.fgos_category || "",
          } as FgosSearchItem);
        }
        const lfList = Array.isArray(comp.labor_functions) ? comp.labor_functions : [];
        const standardId = comp.prof_standard_id || lfList[0]?.standard_id;
        if (standardId) {
          const first = lfList[0] || {};
          setSelectedStandards([{
            id: Number(standardId),
            name: first.standard_name || "Профессиональный стандарт",
            reg_number: first.standard_reg_number || "",
          }]);
          try {
            const data = await apiClient.getLaborFunctions(Number(standardId));
            if (cancelled) return;
            const tagged: LaborFunctionDetail[] = (Array.isArray(data) ? data : []).map((lf) => ({
              ...lf,
              standard_id: lf.standard_id ?? Number(standardId),
              standard_reg_number: lf.standard_reg_number ?? first.standard_reg_number,
              standard_name: lf.standard_name ?? first.standard_name,
              otf_level: formatTfLevel(lf.otf_level, lf.code) ?? "",
            }));
            setLaborFunctions(tagged);
            const selectedCodes = new Set(lfList.map((item: { code?: string }) => item.code).filter(Boolean));
            const selectedIds = tagged.filter((item) => selectedCodes.has(item.code)).map((item) => item.id);
            setExpandedTfIds(selectedIds);
            setFormData((prev) => ({
              ...prev,
              selectedLaborFunctionIds: selectedIds,
            }));
          } catch {
            /* структура уже загружена из паспорта */
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("wizard.openError"));
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, editId, t]);

  const handleAddStandard = (standard: ProfStandardSearchItem | null) => {
    if (!standard) return;
    if (formData.tdZu.confirmed) return;
    if (selectedStandards.some((item) => item.id === standard.id)) return;
    setSelectedStandards((prev) => [...prev, standard]);
    setFormData((prev) => ({
      ...prev,
      profStandardId: prev.profStandardId ?? standard.id,
    }));
    setLaborFunctionsLoading(true);
    apiClient
      .getLaborFunctions(standard.id)
      .then((data) => {
        const tagged: LaborFunctionDetail[] = (Array.isArray(data) ? data : []).map((lf) => ({
          ...lf,
          standard_id: lf.standard_id ?? standard.id,
          standard_reg_number: lf.standard_reg_number ?? standard.reg_number,
          standard_name: lf.standard_name ?? standard.name,
          otf_level: formatTfLevel(lf.otf_level, lf.code) ?? "",
        }));
        setLaborFunctions((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...tagged.filter((item) => !seen.has(item.id))];
        });
      })
      .catch(() => {
        setSelectedStandards((prev) => prev.filter((item) => item.id !== standard.id));
      })
      .finally(() => {
        setLaborFunctionsLoading(false);
      });
  };

  const handleRemoveStandard = (standardId: number) => {
    const removedIds = new Set(
      laborFunctions.filter((lf) => lf.standard_id === standardId).map((lf) => lf.id),
    );
    setSelectedStandards((prev) => prev.filter((item) => item.id !== standardId));
    setExpandedTfIds((prev) => prev.filter((id) => !removedIds.has(id)));
    setLaborFunctions((prev) => prev.filter((lf) => lf.standard_id !== standardId));
    setFormData((prev) => {
      const ids = prev.selectedLaborFunctionIds.filter((id) => !removedIds.has(id));
      const remaining = selectedStandards.filter((item) => item.id !== standardId);
      const selected = laborFunctions.filter(
        (lf) => lf.standard_id !== standardId && ids.includes(lf.id),
      );
      const otfLevel = selected[0] ? parseTfLevel(selected[0].otf_level, selected[0].code) : null;
      return {
        ...prev,
        profStandardId: remaining[0]?.id ?? null,
        selectedLaborFunctionIds: ids,
        qualificationLevel: otfLevel != null ? String(otfLevel) : prev.qualificationLevel,
        tdZu: emptyTdZuState(),
      };
    });
  };

  useEffect(() => {
    const okpdtrCode = formData.trainingProfessionOkpdtr.trim();
    const fetchRecommended = formData.fgosCode
      ? () => apiClient.getStandardsByOkso(formData.fgosCode)
      : okpdtrCode
        ? () => apiClient.getStandardsByOkpdtr(okpdtrCode)
        : null;
    if (!isAuthenticated || !fetchRecommended) {
      setRecommendedStandards([]);
      setRecommendedLoading(false);
      return;
    }
    let cancelled = false;
    setRecommendedLoading(true);
    fetchRecommended()
      .then((data) => {
        if (!cancelled) setRecommendedStandards(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRecommendedStandards([]);
      })
      .finally(() => {
        if (!cancelled) setRecommendedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, formData.fgosCode, formData.trainingProfessionOkpdtr]);

  useEffect(() => {
    if (hydrating) return;
    const range = allowedTfLevelRange(formData.educationKind, formData.educationLevel);
    setFormData((prev) => {
      if (prev.selectedLaborFunctionIds.length > 0 && laborFunctions.length === 0) return prev;
      const allowedIds = prev.selectedLaborFunctionIds.filter((id) => {
        const lf = laborFunctions.find((item) => item.id === id);
        return isTfLevelInRange(parseTfLevel(lf?.otf_level, lf?.code), range);
      });
      let nextLevel = prev.qualificationLevel;
      if (nextLevel && range && !isTfLevelInRange(Number(nextLevel), range)) {
        nextLevel = "";
      }
      if (allowedIds.length === prev.selectedLaborFunctionIds.length && nextLevel === prev.qualificationLevel) {
        return prev;
      }
      const selected = laborFunctions.filter((lf) => allowedIds.includes(lf.id));
      const firstLevel = selected[0] ? parseTfLevel(selected[0].otf_level, selected[0].code) : null;
      const sameLevelIds =
        firstLevel == null
          ? allowedIds
          : allowedIds.filter((id) => {
              const lf = laborFunctions.find((item) => item.id === id);
              return parseTfLevel(lf?.otf_level, lf?.code) === firstLevel;
            });
      return {
        ...prev,
        selectedLaborFunctionIds: sameLevelIds,
        qualificationLevel: firstLevel != null ? String(firstLevel) : nextLevel,
      };
    });
  }, [formData.educationKind, formData.educationLevel, laborFunctions, hydrating]);

  useEffect(() => {
    if (hydrating) return;
    if (formData.competenceKind !== "professional") return;

    const selected = laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id));
    if (!selectedTfKey || selected.length === 0) {
      setFormData((prev) => {
        const hasRemnants =
          prev.structure.A.length > 0 ||
          prev.structure.B.length > 0 ||
          prev.structure.C.length > 0 ||
          prev.disciplineMapping.length > 0 ||
          prev.internationalMapping.analyzedAt ||
          prev.harmoniBrics.analyzedAt ||
          prev.harmoniBrics.targetCountry;
        if (!hasRemnants) return prev;
        return {
          ...prev,
          structure: emptyStructure(),
          disciplineMapping: [],
          assessmentByLevel: emptyAssessmentByLevel(),
          internationalMapping: emptyInternationalMapping(),
          harmoniBrics: emptyHarmoniBricsMapping(),
          tdZu: emptyTdZuState(),
        };
      });
      return;
    }

    setFormData((prev) => {
      const selectedCodes = selected.map((lf) => lf.code);
      const codeSet = new Set(selectedCodes);
      const prevCodes = new Set(
        [...prev.structure.A, ...prev.structure.B, ...prev.structure.C]
          .map((item) => (item.tfCode || "").trim())
          .filter(Boolean),
      );
      const removedTfCodes = [...prevCodes].some((code) => !codeSet.has(code));
      const pruned = pruneStructureToSelectedTfs(prev.structure, selectedCodes);
      const structure = prev.tdZu.confirmed
        ? buildStructureFromTdZu(prev.tdZu.cards, pruned)
        : buildStructureFromLaborFunctions(selected, pruned);

      const next = {
        ...prev,
        structure,
        disciplineMapping: syncDisciplineMapping(
          structure,
          removedTfCodes ? [] : prev.disciplineMapping,
        ),
        assessmentByLevel: syncAssessmentByLevel(
          structure,
          removedTfCodes ? emptyAssessmentByLevel() : prev.assessmentByLevel,
        ),
      };

      // Смена/снятие ТФ сбрасывает международные сопоставления, собранные по старой структуре.
      if (
        removedTfCodes ||
        (prev.tdZu.confirmedTfKey && prev.tdZu.confirmedTfKey !== selectedTfKey)
      ) {
        next.internationalMapping = emptyInternationalMapping();
        next.harmoniBrics = emptyHarmoniBricsMapping();
      }

      return next;
    });
  }, [selectedTfKey, laborFunctions, formData.competenceKind, formData.selectedLaborFunctionIds, formData.tdZu.confirmed, formData.tdZu.cards, hydrating]);

  const buildAssessmentTools = () =>
    flattenAssessmentTools(formData.assessmentByLevel, formData.structure);

  const buildPayload = (status: string) => ({
    name: formData.title,
    qualification_name: formData.title,
    qualification_level: formData.qualificationLevel,
    competence_kind: formData.competenceKind,
    prof_standard_id: formData.profStandardId ?? undefined,
    labor_functions: selectedLaborFunctions.map((lf) => ({
      code: lf.code,
      name: lf.name,
      otf_level: lf.otf_level,
      otf_code: lf.otf_code,
      standard_id: lf.standard_id,
      standard_reg_number: lf.standard_reg_number,
      standard_name: lf.standard_name,
      okz_codes: lf.okz_codes || [],
    })),
    structure: structurePayload,
    descriptors: formData.descriptors,
    discipline_mapping: flattenDisciplineMapping(formData.disciplineMapping),
    assessment_tools: buildAssessmentTools(),
    ed_technologies: uniqueAssessmentMethodLabels(formData.assessmentByLevel),
    resources: resourcesPayload(formData.resources),
    expertise: formData.expertise,
    international_mapping: formData.internationalMapping,
    harmoni_brics: formData.harmoniBrics,
    td_zu_mapping: formData.tdZu,
    wizard_step: currentStep,
    universal_skills: formData.matrixContext?.universal_skills,
    status,
    developer: formData.developer || user?.email || t("wizard.notSpecified"),
    description: formData.description,
    professional_area_code: formData.professionalAreaCode,
    industry: findProfessionalArea(formData.professionalAreaCode)?.name || "",
    hours: formData.workload,
    education_level: formData.educationLevel,
    education_kind: formData.educationKind,
    education_training_profession_id: formData.trainingProfessionId ?? undefined,
    education_training_profession: formData.trainingProfessionName || undefined,
    fgos_id: formData.fgosId ?? undefined,
    fgos_code: formData.fgosCode || undefined,
    fgos_name: formData.fgosName || undefined,
    fgos_category: formData.fgosCategory || undefined,
  });

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!formData.title.trim()) return t("wizard.needTitle");
        if (!formData.description.trim()) return t("wizard.needDescription");
        if (!formData.educationKind) return t("wizard.needEducationKind");
        if (
          formData.educationKind === "профессиональное образование" &&
          !formData.educationLevel
        ) {
          return t("wizard.needEducationLevel");
        }
        if (
          formData.educationKind === "профессиональное обучение" &&
          !formData.trainingProfessionId
        ) {
          return t("wizard.needProfession");
        }
        if (
          (formData.educationKind === "профессиональное образование" ||
            formData.educationKind === "дополнительное образование") &&
          (formData.educationKind === "дополнительное образование" || formData.educationLevel) &&
          !formData.fgosId
        ) {
          return t("wizard.needFgos");
        }
        if (!formData.professionalAreaCode) return t("wizard.needArea");
        return null;
      case 2:
        if (!formData.qualificationLevel) {
          return t("wizard.needQl");
        }
        if (formData.competenceKind === "professional" && selectedStandards.length === 0) {
          return t("wizard.needPs");
        }
        if (formData.competenceKind === "professional") {
          if (selectedLaborFunctions.length === 0) return t("wizard.needTf");
          if (!formData.tdZu.confirmed) return t("wizard.needConfirmTf");
          const incomplete = incompleteTdZuCards(formData.tdZu.cards);
          if (incomplete.length > 0) return t("wizard.needTdZu", { n: incomplete.length });
        }
        if (formData.qualificationLevel && tfLevelRange) {
          const n = Number(formData.qualificationLevel);
          if (!isTfLevelInRange(n, tfLevelRange)) {
            return tfLevelRangeHint(tfLevelRange);
          }
        }
        return null;
      case 3:
        if (!formData.structure.A.some((item) => item.text.trim())) {
          return t("wizard.needA");
        }
        if (!formData.structure.B.some((item) => item.text.trim())) {
          return t("wizard.needB");
        }
        return null;
      case 7:
        if (!resourcesFilled(formData.resources)) {
          return t("wizard.needResources");
        }
        return null;
      case 8:
        if (EXPERTISE_CRITERIA.some((_, index) => !formData.expertise[criterionKey(index)]?.value)) {
          return t("wizard.needValidation");
        }
        return null;
      default:
        return null;
    }
  };

  const validateStepsUpTo = (targetStep: number): string | null => {
    for (let step = 1; step < targetStep; step += 1) {
      const err = validateStep(step);
      if (err) return err;
    }
    return null;
  };

  const validateForm = (status: string) => {
    if (status === "проект") {
      if (!formData.title.trim()) return t("wizard.needTitle");
      return null;
    }

    const stepError = validateStepsUpTo(lastStep);
    if (stepError) return stepError;
    if (status === "на экспертизе") {
      const missingDescriptor = (["A", "B", "C"] as const).some((cat) =>
        formationLevelsForEducation(formData.educationLevel).some(
          (level) => !formData.descriptors[cat][level]?.trim(),
        ),
      );
      if (missingDescriptor) {
        return t("wizard.needDescriptors");
      }
      const assessmentError = assessmentWizardErrorMessage(
        formData.structure,
        formData.assessmentByLevel,
      );
      if (assessmentError) return assessmentError;
    }
    return null;
  };

  const persistDraft = async (stepToStore: number) => {
    const payload = { ...buildPayload("проект"), wizard_step: stepToStore };
    const working = workingCompetenceRef.current;
    if (working?.collaboration_role === "member") {
      delete payload.status;
    }
    // Название по умолчанию — ID компетенции в системе
    if (!String(payload.name || "").trim() && working?.public_code) {
      payload.name = working.public_code;
      payload.qualification_name = working.public_code;
    }
    const id = editId || working?.id || null;
    const saved = id
      ? await apiClient.updateCompetence(id, payload)
      : await apiClient.createCompetence({
          ...payload,
          name: payload.name?.trim() || DRAFT_PLACEHOLDER_NAME,
          qualification_name: payload.qualification_name?.trim() || DRAFT_PLACEHOLDER_NAME,
        });
    if (saved?.id) {
      setWorkingCompetence(saved);
      const code = saved.public_code || `RUS-PK-${String(saved.id).padStart(4, "0")}`;
      setFormData((prev) => {
        if (prev.title.trim() && prev.title.trim() !== DRAFT_PLACEHOLDER_NAME) return prev;
        return { ...prev, title: code };
      });
    }
    if (!editId && saved?.id) {
      navigate(`/competency/${saved.id}/edit`, { replace: true });
    }
    return saved;
  };

  const persistDraftRef = useRef(persistDraft);
  persistDraftRef.current = persistDraft;

  // Автосохранение каждые 5 минут работы над проектом
  useEffect(() => {
    if (!competenceId || hydrating || !isAuthenticated) return;
    const timer = window.setInterval(() => {
      if (autoSavingRef.current || submittingRef.current) return;
      void (async () => {
        setAutoSaving(true);
        try {
          await persistDraftRef.current(currentStepRef.current);
          setLastAutoSavedAt(Date.now());
        } catch {
          /* не блокируем работу при фоновом сбое */
        } finally {
          setAutoSaving(false);
        }
      })();
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [competenceId, hydrating, isAuthenticated]);

  const handleSubmit = async (status: string) => {
    const validationError = validateForm(status);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload(status);
      if (workingCompetence?.collaboration_role === "member" && status === "проект") {
        delete payload.status;
      }
      const id = editId || workingCompetence?.id || null;
      const saved = id
        ? await apiClient.updateCompetence(id, payload)
        : await apiClient.createCompetence(payload);
      if (saved?.id) setWorkingCompetence(saved);
      if (status === "на экспертизе") {
        navigate(`/competency/${saved.id}`);
      } else if (!editId && saved?.id) {
        navigate(`/competency/${saved.id}/edit`, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!formData.title.trim()) {
      setError(t("wizard.docxNeedTitle"));
      return;
    }
    setDownloadingDocx(true);
    setError("");
    try {
      const payload = {
        ...buildPayload("проект"),
        assessment_by_level: formData.assessmentByLevel,
        order_148n_indicators: selectedQl?.order_148n_indicators || "",
        qualification_level_label:
          selectedQl?.qualification_level_label ||
          (formData.qualificationLevel ? `${formData.qualificationLevel}-й уровень` : ""),
        prof_standard_name: selectedStandards
          .map((item) => `${item.name}${item.reg_number ? ` (рег. ${item.reg_number})` : ""}`)
          .join("; "),
      };
      const blob = await apiClient.downloadCompetenceDocxFromDraft(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = formData.title.trim().replace(/[<>:"/\\|?*]+/g, "_").slice(0, 60) || "competence";
      a.download = `competence_${safeName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.docxError"));
    } finally {
      setDownloadingDocx(false);
    }
  };

  const goToStep = async (target: number) => {
    if (target === currentStep || autoSaving || submitting) return;
    setError("");
    setAutoSaving(true);
    try {
      await persistDraft(target);
      setCurrentStep(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.saveError"));
    } finally {
      setAutoSaving(false);
    }
  };

  const goNext = async () => {
    if (autoSaving || submitting) return;
    const next = Math.min(lastStep, currentStep + 1);
    setError("");
    setAutoSaving(true);
    try {
      await persistDraft(next);
      setCurrentStep(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.saveError"));
    } finally {
      setAutoSaving(false);
    }
  };

  const selectedQl = qualificationLevels.find(
    (item) => String(item.qualification_level) === formData.qualificationLevel,
  );
  const competenceName = formData.title.trim() || t("wizard.newName");

  useEffect(() => {
    const sentinel = nameBarSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNameBarStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hydrating, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <PageShell className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("wizard.needAuth")}</h2>
        <p className="text-gray-600 mb-6">{t("wizard.needAuthLead")}</p>
        <Link to="/login" state={{ from: isEdit ? `/competency/${editId}/edit` : "/new" }}>
          <Button>{t("common.login")}</Button>
        </Link>
      </PageShell>
    );
  }

  if (hydrating) {
    return (
      <PageShell className="text-center py-20">
        <p className="text-gray-600">{t("wizard.loading")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="[--competence-sticky-h:7.25rem]">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-base text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("wizard.backHome")}
      </Link>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="page-title">{isEdit ? t("wizard.titleEdit") : t("wizard.titleNew")}</h1>
        <WorkingGroupDialog
          competence={
            workingCompetence || {
              id: 0,
              name: formData.title.trim() || t("wizard.newName"),
              status: "проект",
              can_invite: canSubmitToReview,
              can_edit: true,
              collaboration_role: canSubmitToReview ? "leader" : "member",
              collaborators: [
                {
                  role: "leader",
                  status: "accepted",
                  user_id: user?.id,
                  user: user,
                },
              ],
            }
          }
          onUpdated={(next) => {
            setWorkingCompetence(next);
            if (!isEdit && next.id) {
              navigate(`/competency/${next.id}/edit`, { replace: true });
            }
          }}
          ensureCompetence={async () => {
            if (workingCompetence?.id) return workingCompetence;
            const validationError = validateForm("проект");
            if (validationError) throw new Error(validationError);
            const saved = await apiClient.createCompetence(buildPayload("проект"));
            setWorkingCompetence(saved);
            return saved;
          }}
        />
      </div>
      <div ref={nameBarSentinelRef} aria-hidden className="h-px" />
      <div
        className={cn(
          "sticky top-0 z-40 mb-6 border transition-shadow",
          nameBarStuck
            ? "-mx-[1cm] rounded-none border-x-0 border-t-0 border-b-primary/20 bg-white/95 px-[1cm] py-2.5 shadow-md backdrop-blur-sm"
            : "rounded-xl border-primary/25 bg-primary/5 px-4 py-2.5",
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
          {t("wizard.nameBar")}
        </p>
        <p className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">{competenceName}</p>
        {competenceId ? <CollaborationPresenceBar peers={peers} currentStep={currentStep} /> : null}
      </div>
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}
      {!canSubmitToReview ? (
        <p className="mb-6 text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {t("wizard.memberNotice")}
        </p>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 w-full">
        {steps.map((step) => (
          <div key={step.number} className="flex items-center min-w-0">
            <button
              type="button"
              onClick={() => void goToStep(step.number)}
              title={step.name}
              className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm transition-colors cursor-pointer ${
                currentStep === step.number
                  ? "bg-primary text-white ring-2 ring-primary/30"
                  : currentStep > step.number
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              {step.label}
              <StepChatBadge count={chatCounts[step.number]} />
              <CollaborationStepDots step={step.number} peers={peers} />
            </button>
            <button
              type="button"
              onClick={() => void goToStep(step.number)}
              className={`ml-2 text-base font-medium text-left cursor-pointer hover:text-gray-900 truncate ${
                currentStep === step.number ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {step.name}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 w-full">
        <div className="flex-1 min-w-0">
          <div
            ref={wizardSurfaceRef}
            className="surface relative p-6 lg:p-8 w-full min-w-0"
            onFocusCapture={markPresenceFragment}
            onPointerDownCapture={markPresenceFragment}
          >
            <CollaborationCursors peers={peers} containerRef={wizardSurfaceRef} />
              <div className="flex justify-between mb-6 pb-6 border-b border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => void goToStep(currentStep - 1)}
                  disabled={currentStep === 1 || autoSaving || submitting}
                  className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("common.back")}
                </Button>

                <div className="flex items-center gap-2">
                  {autoSaving ? (
                    <span className="text-sm text-gray-500">{t("wizard.autoSaving")}</span>
                  ) : workingCompetence?.id ? (
                    <span className="text-sm text-gray-400 hidden sm:inline">
                      {lastAutoSavedAt
                        ? t("wizard.autoSavedAt", {
                            time: new Date(lastAutoSavedAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          })
                        : t("wizard.autoSaved")}
                    </span>
                  ) : null}
                  <Button
                    variant="outline"
                    className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
                    disabled={submitting || autoSaving}
                    onClick={() => handleSubmit("проект")}
                  >
                    <Save className="w-4 h-4" />
                    {t("wizard.saveDraft")}
                  </Button>

                  {currentStep === lastStep && (
                    <Button
                      variant="outline"
                      className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
                      disabled={downloadingDocx || submitting}
                      onClick={() => void handleDownloadDocx()}
                    >
                      <FileDown className="w-4 h-4" />
                      {downloadingDocx ? t("common.docxBusy") : t("common.downloadDocx")}
                    </Button>
                  )}

                  {currentStep < lastStep ? (
                    <Button onClick={() => void goNext()} className="gap-2" disabled={autoSaving || submitting}>
                      {t("common.next")}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : canSubmitToReview ? (
                    <Button
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      disabled={submitting || autoSaving}
                      onClick={() => handleSubmit("на экспертизе")}
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? t("wizard.submitting") : t("wizard.submitReview")}
                    </Button>
                  ) : null}
                </div>
              </div>
              {currentStep === 1 && (
                <div className="space-y-6" data-presence-fragment="step:1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {t("wizard.step1Title")}
                  </h2>

                  <div data-presence-fragment="title">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.name")} <span className="text-red-500">{t("common.required")}</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={t("wizard.namePlaceholder")}
                      className="w-full"
                    />
                  </div>

                  <div data-presence-fragment="description">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.description")} <span className="text-red-500">{t("common.required")}</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="form-control"
                      placeholder={t("wizard.descriptionPlaceholder")}
                    />
                  </div>

                  <div data-presence-fragment="area">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.area")} <span className="text-red-500">{t("common.required")}</span>
                    </label>
                    <select
                      value={formData.professionalAreaCode}
                      onChange={(e) =>
                        setFormData({ ...formData, professionalAreaCode: e.target.value })
                      }
                      className="form-control"
                    >
                      <option value="">{t("wizard.selectArea")}</option>
                      {PROFESSIONAL_AREAS.map((area) => (
                        <option key={area.code} value={area.code}>
                          {areaDisplayCode(area)} — {translateAreaName(t, area.code, area.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div data-presence-fragment="educationKind">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.educationKind")} <span className="text-red-500">{t("common.required")}</span>
                    </label>
                    <select
                      value={formData.educationKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as EducationKind;
                        const keepLevel =
                          nextKind === "профессиональное образование" ||
                          nextKind === "дополнительное образование";
                        const keepTraining = nextKind === "профессиональное обучение";
                        if (!keepTraining) setSelectedTrainingProfession(null);
                        setSelectedFgos(null);
                        setFormData({
                          ...formData,
                          educationKind: nextKind,
                          educationLevel: keepLevel ? formData.educationLevel : "",
                          trainingProfessionId: keepTraining
                            ? formData.trainingProfessionId
                            : null,
                          trainingProfessionName: keepTraining
                            ? formData.trainingProfessionName
                            : "",
                          trainingProfessionOkpdtr: keepTraining
                            ? formData.trainingProfessionOkpdtr
                            : "",
                          fgosId: null,
                          fgosCode: "",
                          fgosName: "",
                          fgosCategory: "",
                        });
                      }}
                      className="form-control"
                      required
                    >
                      {EDUCATION_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {translateKeyed(t, EDUCATION_KIND_I18N_KEYS, kind)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.educationKind === "профессиональное образование" ||
                    formData.educationKind === "дополнительное образование") && (
                    <div data-presence-fragment="educationLevel">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("wizard.educationLevel")}
                        {formData.educationKind === "профессиональное образование" && (
                          <span className="text-red-500"> {t("common.required")}</span>
                        )}
                      </label>
                      <select
                        value={formData.educationLevel}
                        onChange={(e) => {
                          setSelectedFgos(null);
                          setFormData({
                            ...formData,
                            educationLevel: e.target.value,
                            fgosId: null,
                            fgosCode: "",
                            fgosName: "",
                            fgosCategory: "",
                          });
                        }}
                        className="form-control"
                        required={formData.educationKind === "профессиональное образование"}
                      >
                        <option value="">{t("wizard.selectLevel")}</option>
                        {educationLevels.map((level) => (
                          <option key={level} value={level}>
                            {translateKeyed(t, EDUCATION_LEVEL_I18N_KEYS, level)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showFgosPicker && (
                    <div data-presence-fragment="fgos">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("wizard.fgos")} <span className="text-red-500">{t("common.required")}</span>
                      </label>
                      <FgosSearchPicker
                        selectedId={formData.fgosId}
                        selected={selectedFgos}
                        categories={fgosCategories}
                        allowCategoryFilter={
                          formData.educationKind === "дополнительное образование" ||
                          fgosCategories.length > 1
                        }
                        onSelect={(item) => {
                          setSelectedFgos(item);
                          setFormData((prev) => ({
                            ...prev,
                            fgosId: item?.id ?? null,
                            fgosCode: item?.code ?? "",
                            fgosName: item?.name ?? "",
                            fgosCategory: item?.category ?? "",
                          }));
                        }}
                      />
                    </div>
                  )}

                  {formData.educationKind === "профессиональное обучение" && (
                    <div data-presence-fragment="profession">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("wizard.profession")}{" "}
                        <span className="text-red-500">{t("common.required")}</span>
                      </label>
                      <ProfTrainingProfessionPicker
                        selectedId={formData.trainingProfessionId}
                        selected={selectedTrainingProfession}
                        onSelect={(item) => {
                          setSelectedTrainingProfession(item);
                          setFormData((prev) => ({
                            ...prev,
                            trainingProfessionId: item?.id ?? null,
                            trainingProfessionName: item?.name ?? "",
                            trainingProfessionOkpdtr: item?.okpdtr_code ?? "",
                          }));
                        }}
                      />
                    </div>
                  )}

                  <div data-presence-fragment="competenceType">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.competenceType")}
                    </label>
                    <select
                      value={formData.competenceKind}
                      onChange={(e) =>
                        setFormData({ ...formData, competenceKind: e.target.value as CompetenceKind })
                      }
                      className="form-control"
                    >
                      {competenceKinds.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div data-presence-fragment="developer">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.developer")}
                    </label>
                    <Input
                      type="text"
                      value={formData.developer}
                      onChange={(e) => setFormData({ ...formData, developer: e.target.value })}
                      placeholder={t("wizard.developerPlaceholder")}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6" data-presence-fragment="step:2">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {t("wizard.step2Title")}
                  </h2>

                  {formData.competenceKind === "professional" && (
                    <>
                      <div data-presence-fragment="ps">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("wizard.profStandard")} <span className="text-red-500">{t("common.required")}</span>
                        </label>
                        {showRecommended && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-800 mb-1">
                              {showOksoRecommended
                                ? t("wizard.recommendedOkso", { code: formData.fgosCode })
                                : recommendedOkpdtr
                                  ? `${t("wizard.recommendedOkpdtr")} ${recommendedOkpdtr}`
                                  : t("wizard.recommendedOkpdtr")}
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
                              {showOksoRecommended
                                ? t("wizard.recommendedOksoHelp")
                                : t("wizard.recommendedOkpdtrHelp")}
                            </p>
                            {showOkpdtrRecommended && !recommendedOkpdtr ? (
                              <p className="text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-3">
                                {t("wizard.noOkpdtr")}
                              </p>
                            ) : recommendedLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-6">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span>
                                  {showOksoRecommended
                                    ? t("wizard.pickingFgos")
                                    : t("wizard.pickingOkpdtr")}
                                </span>
                              </div>
                            ) : recommendedStandards.length === 0 ? (
                              <p className="text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-3">
                                {t("wizard.noCodeMatch")}
                              </p>
                            ) : (
                              <ul className="divide-y divide-gray-100 rounded-xl border border-primary/20 bg-primary/5 max-h-72 overflow-y-auto">
                                {recommendedStandards.map((item) => {
                                  const isSelected = selectedStandards.some((std) => std.id === item.id);
                                  const matchedCodes = showOksoRecommended
                                    ? item.matched_okso_codes
                                    : item.matched_okpdtr_codes;
                                  const matchedLabel = showOksoRecommended ? "ОКСО" : "ОКПДТР";
                                  return (
                                    <li key={item.id}>
                                      <button
                                        type="button"
                                        onClick={() => handleAddStandard(item)}
                                        className={`w-full text-left px-4 py-3 hover:bg-white/70 transition-colors ${
                                          isSelected ? "bg-white" : ""
                                        }`}
                                      >
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                            {item.reg_number}
                                          </span>
                                          {item.ps_code && (
                                            <span className="text-xs text-gray-500">{item.ps_code}</span>
                                          )}
                                          {item.has_qualifications && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                              <Award className="w-3 h-3" />
                                              {item.qualification_count}
                                            </span>
                                          )}
                                          {Array.isArray(matchedCodes) && matchedCodes.length > 0 && (
                                            <span className="text-xs text-gray-500">
                                              {matchedLabel} {matchedCodes.join(", ")}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {!recommendedLoading && recommendedStandards.length > 0 && (
                              <p className="text-xs text-gray-500 mt-2">
                                {t("wizard.foundN", { n: recommendedStandards.length })}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-3 mb-2">
                              {t("wizard.addPs")}
                            </p>
                          </div>
                        )}
                        {!formData.tdZu.confirmed && (
                        <ProfStandardSearchPicker
                          selectedId={null}
                          selected={null}
                          selectedIds={selectedStandards.map((item) => item.id)}
                          allowMultiple
                          onSelect={handleAddStandard}
                        />
                        )}
                        {selectedStandards.length > 0 && (
                          <div className="mt-4 space-y-4">
                            <p className="text-xs text-gray-500">{tfLevelRangeHint(tfLevelRange)}</p>
                            {selectedStandards.map((item) => {
                              const items = laborFunctions.filter((lf) => lf.standard_id === item.id);
                              const selectedCount = items.filter((lf) =>
                                formData.selectedLaborFunctionIds.includes(lf.id),
                              ).length;
                              return (
                                <div key={item.id} className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-primary">
                                      {selectedCount > 0 ? t("wizard.selectedTf", { n: selectedCount }) : item.reg_number}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={formData.tdZu.confirmed}
                                      onClick={() => handleRemoveStandard(item.id)}
                                      aria-label={t("wizard.removePs")}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div className="overflow-x-auto max-w-full" data-presence-fragment="tf">
                                  <WorkFunctionsSelectTree
                                    standard={item}
                                    laborFunctions={items}
                                    selectedIds={formData.selectedLaborFunctionIds}
                                    onToggleTf={toggleLaborFunction}
                                    disableReason={(lf) =>
                                      tfDisabledReason(
                                        parseTfLevel(lf.otf_level, lf.code),
                                        tfLevelRange,
                                        lockedTfLevel,
                                      )
                                    }
                                    selectionLocked={formData.tdZu.confirmed}
                                    expandedIds={expandedTfIds}
                                    onToggleExpand={(id) =>
                                      setExpandedTfIds((prev) =>
                                        prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
                                      )
                                    }
                                    confirmed={formData.tdZu.confirmed}
                                    cards={formData.tdZu.cards}
                                    onChangeCards={(nextCards) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        tdZu: { ...prev.tdZu, cards: nextCards },
                                      }))
                                    }
                                    loading={laborFunctionsLoading}
                                  />
                                  </div>
                                </div>
                              );
                            })}
                            {formData.selectedLaborFunctionIds.length > 0 && (
                              <p className="text-sm text-primary">
                                {t("wizard.selectedTf", { n: formData.selectedLaborFunctionIds.length })}
                                {lockedTfLevel != null ? ` · ${t("wizard.levelN", { n: lockedTfLevel })}` : ""}.
                              </p>
                            )}
                            {formData.selectedLaborFunctionIds.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {formData.tdZu.confirmed ? (
                                  <Button type="button" variant="outline" onClick={unlockTfSelection}>
                                    {t("wizard.changeTfSelection")}
                                  </Button>
                                ) : (
                                  <Button type="button" onClick={confirmTfSelection}>
                                    {t("wizard.confirmTf")}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.qlLabel")} <span className="text-red-500">{t("common.required")}</span>
                    </label>
                    <select
                      value={formData.qualificationLevel}
                      onChange={(e) =>
                        setFormData({ ...formData, qualificationLevel: e.target.value })
                      }
                      className="form-control"
                      disabled={lockedTfLevel != null}
                    >
                      <option value="">{t("wizard.selectQl")}</option>
                      {allowedQualificationLevels.map((level) => (
                        <option key={level.qualification_level} value={String(level.qualification_level)}>
                          {level.qualification_level_label || t("wizard.nthLevel", { n: level.qualification_level })}
                        </option>
                      ))}
                    </select>
                    {lockedTfLevel != null && (
                      <p className="text-xs text-gray-500 mt-2">
                        {t("wizard.qlLocked", { n: lockedTfLevel })}
                      </p>
                    )}
                    {tfLevelRange && lockedTfLevel == null && (
                      <p className="text-xs text-gray-500 mt-2">{tfLevelRangeHint(tfLevelRange)}</p>
                    )}
                  </div>

                  {selectedQl && (
                    <div className="rounded-xl border border-primary/20 bg-secondary/40 p-4 text-sm text-gray-700">
                      <div className="font-medium text-primary mb-2">
                        {selectedQl.qualification_level_label}
                      </div>
                      <p className="text-gray-600 whitespace-pre-line">
                        {selectedQl.order_148n_indicators}
                      </p>
                    </div>
                  )}

                  {formData.competenceKind !== "professional" && (
                    <div className="bg-secondary border border-primary/20 rounded-xl p-4">
                      <p className="text-sm text-primary">
                        {t("wizard.optionalPs")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6" data-presence-fragment="step:3">
                  <div data-presence-fragment="workload">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("wizard.workload")}
                    </label>
                    <Input
                      type="text"
                      value={formData.workload}
                      onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                      placeholder={t("wizard.workloadPlaceholder")}
                      className="w-full"
                    />
                  </div>
                  <StructureABCEditor
                    structure={formData.structure}
                    selectedLaborFunctions={selectedLaborFunctions}
                    onChange={updateStructure}
                  />
                </div>
              )}

              {currentStep === 4 && (
                <div data-presence-fragment="descriptors">
                <DescriptorEditor
                  descriptors={formData.descriptors}
                  educationLevel={formData.educationLevel}
                  matrixContext={formData.matrixContext}
                  qualificationLevelLabel={
                    selectedQl?.qualification_level_label ||
                    (formData.qualificationLevel ? t("wizard.nthLevel", { n: formData.qualificationLevel }) : '')
                  }
                  order148nIndicators={selectedQl?.order_148n_indicators || ''}
                  onChange={(next: DescriptorMap) =>
                    setFormData({ ...formData, descriptors: next })
                  }
                  onApplyMatrix={applyMatrixProfile}
                  applying={applyingMatrix}
                />
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4" data-presence-fragment="discipline">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {t("wizard.step5Title")}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t("wizard.step5Help")}{" "}
                      <Link to="/methodology/scoring" className="text-primary hover:underline font-medium">
                        {t("wizard.scoringLink")}
                      </Link>
                    </p>
                  </div>
                  <DisciplineMappingEditor
                    rows={formData.disciplineMapping}
                    educationKind={formData.educationKind}
                    educationLevel={formData.educationLevel}
                    onChange={(disciplineMapping) =>
                      setFormData((prev) => ({ ...prev, disciplineMapping }))
                    }
                  />
                </div>
              )}

              {currentStep === 6 && (
                <div data-presence-fragment="assessment">
                <AssessmentConstructor
                  structure={formData.structure}
                  value={formData.assessmentByLevel}
                  onChange={(next) =>
                    setFormData((prev) => ({
                      ...prev,
                      assessmentByLevel:
                        typeof next === "function" ? next(prev.assessmentByLevel) : next,
                    }))
                  }
                />
                </div>
              )}

              {currentStep === 7 && (
                <div className="space-y-6" data-presence-fragment="resources">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step7Title")}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t("wizard.step7Lead")}</p>
                  </div>
                  <ResourcesMtoEditor
                    value={formData.resources}
                    onChange={(resources) => setFormData((prev) => ({ ...prev, resources }))}
                  />
                </div>
              )}

              {currentStep === 8 && (
                <div className="space-y-6" data-presence-fragment="expertise">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step8Title")}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t("wizard.step8Lead")}</p>
                  </div>
                  <ExpertiseChecklistForm
                    value={formData.expertise}
                    onChange={(expertise) =>
                      setFormData((prev) => ({ ...prev, expertise }))
                    }
                  />
                </div>
              )}

              {currentStep === 9 && (
                <div data-presence-fragment="international">
                <InternationalMappingStep
                  value={formData.internationalMapping}
                  onChange={(internationalMapping) =>
                    setFormData((prev) => ({ ...prev, internationalMapping }))
                  }
                  onRecalculate={runInternationalMapping}
                  onAskAssistant={askGarmEsco}
                  assistantBusy={garmBusy}
                  assistantError={garmError}
                  aiAgentConfigured={aiAgentConfigured}
                />
                </div>
              )}

              {currentStep === 10 && (
                <div data-presence-fragment="harmoni-brics">
                  <HarmoniBricsStep
                    value={formData.harmoniBrics}
                    onChange={(harmoniBrics) => setFormData((prev) => ({ ...prev, harmoniBrics }))}
                    onAskAssistant={askHarmoniBrics}
                    assistantBusy={hbBusy}
                    assistantError={hbError}
                    aiAgentConfigured={aiAgentConfigured}
                  />
                </div>
              )}

              {isIntlMethodologist && currentStep === 11 && (
                <div data-presence-fragment="intl-harmonization">
                  <HarmonizationStep92 competenceId={competenceId} />
                </div>
              )}

              {currentStep === lastStep && (
                <div className="space-y-6" data-presence-fragment="preview">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{t("wizard.previewTitle")}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {t("wizard.previewLead")}
                    </p>
                  </div>

                  {/* 1. Общая информация */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      {t("wizard.section1")}
                    </h3>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">{t("wizard.name")}</h4>
                      <p className="text-base font-medium text-gray-900">{formData.title || "—"}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">{t("wizard.description")}</h4>
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {formData.description || "—"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PreviewField
                        label={t("wizard.area")}
                        value={formatProfessionalAreaLabel(formData.professionalAreaCode, null, t)}
                      />
                      <PreviewField
                        label={t("wizard.educationKindShort")}
                        value={translateKeyed(t, EDUCATION_KIND_I18N_KEYS, formData.educationKind)}
                      />
                      {formData.educationKind === "профессиональное образование" && (
                        <PreviewField
                          label={t("wizard.educationLevel")}
                          value={translateKeyed(t, EDUCATION_LEVEL_I18N_KEYS, formData.educationLevel)}
                        />
                      )}
                      {formData.educationKind === "дополнительное образование" && formData.educationLevel && (
                        <PreviewField
                          label={t("wizard.educationLevel")}
                          value={translateKeyed(t, EDUCATION_LEVEL_I18N_KEYS, formData.educationLevel)}
                        />
                      )}
                      {formData.fgosCode && (
                        <PreviewField
                          label={t("wizard.fgos")}
                          value={`${formData.fgosCode} — ${formData.fgosName}`}
                        />
                      )}
                      {formData.educationKind === "профессиональное обучение" && (
                        <PreviewField
                          label={t("wizard.professionShort")}
                          value={
                            formData.trainingProfessionOkpdtr
                              ? `${formData.trainingProfessionName} (ОКПДТР ${formData.trainingProfessionOkpdtr})`
                              : formData.trainingProfessionName
                          }
                        />
                      )}
                      <PreviewField
                        label={t("wizard.competenceType")}
                        value={
                          competenceKinds.find((k) => k.value === formData.competenceKind)?.label
                        }
                      />
                      <PreviewField label={t("detail.workload")} value={formData.workload} />
                      <PreviewField
                        label={t("detail.developer")}
                        value={formData.developer || user?.email}
                      />
                    </div>
                  </section>

                  {/* 2. Профстандарт и уровень */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      2. {t("wizard.step2")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PreviewField
                        label={t("wizard.profStandard")}
                        value={
                          selectedStandards.length
                            ? selectedStandards
                                .map(
                                  (item) =>
                                    `${item.name}${item.reg_number ? ` (рег. ${item.reg_number})` : ""}`,
                                )
                                .join("; ")
                            : formData.competenceKind === "professional"
                              ? t("wizard.notSelected")
                              : t("wizard.notRequired")
                        }
                      />
                      <PreviewField
                        label={t("wizard.ql148")}
                        value={
                          selectedQl?.qualification_level_label ||
                          (formData.qualificationLevel
                            ? t("wizard.nthLevel", { n: formData.qualificationLevel })
                            : "")
                        }
                      />
                    </div>

                    {selectedQl?.order_148n_indicators && (
                      <div className="rounded-lg border border-primary/15 bg-secondary/30 p-4">
                        <h4 className="text-xs font-medium text-primary mb-2">
                          Показатели по приказу Минтруда №148н
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                          {selectedQl.order_148n_indicators}
                        </p>
                      </div>
                    )}

                    {selectedLaborFunctions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 mb-2">
                          {t("wizard.laborFunctionsN", { n: selectedLaborFunctions.length })}
                        </h4>
                        <ul className="space-y-2">
                          {selectedLaborFunctions.map((lf) => (
                            <li
                              key={lf.id}
                              className="text-sm text-gray-800 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                              <span className="font-medium text-primary">{lf.code}</span>
                              {" — "}
                              {lf.name}
                              {lf.otf_level ? ` ${t("wizard.tfLevel", { n: lf.otf_level })}` : ""}
                              {lf.standard_reg_number ? ` · ПС ${lf.standard_reg_number}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  {/* 3. Структура A/B/C */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      3. {t("wizard.step3")}
                    </h3>
                    {(["A", "B", "C"] as const).map((cat) => {
                      const items = formData.structure[cat].filter((item) => item.text.trim());
                      return (
                        <div key={cat}>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">
                            {cat}. {translateKeyed(t, DESCRIPTOR_I18N_KEYS, cat)}
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              ({items.length})
                            </span>
                          </h4>
                          {items.length ? (
                            <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-800">
                              {items.map((item, idx) => (
                                <li key={`${cat}-${idx}`} className="leading-snug">
                                  {item.text}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-gray-400">{t("wizard.empty")}</p>
                          )}
                        </div>
                      );
                    })}
                  </section>

                  {/* 4. Дескрипторы */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      4. {t("wizard.step4")}
                    </h3>
                    {DESCRIPTOR_CATEGORIES.map((cat) => (
                      <div key={cat} className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {t("detail.category", { cat })} ({translateKeyed(t, DESCRIPTOR_I18N_KEYS, cat)})
                        </h4>
                        <div className={`grid grid-cols-1 gap-3 ${formationLevelsForEducation(formData.educationLevel).length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                          {formationLevelsForEducation(formData.educationLevel).map((level) => {
                            const text = formData.descriptors[cat][level]?.trim();
                            return (
                              <div
                                key={`${cat}-${level}`}
                                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                              >
                                <div className="text-xs font-medium text-primary mb-1.5">
                                  {translateKeyed(t, FORMATION_I18N_KEYS, level)}
                                </div>
                                <p className="text-sm text-gray-800 leading-snug whitespace-pre-line">
                                  {text || "—"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>

                  {/* 5. Привязка к дисциплинам */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      5. {t("wizard.step5")}
                    </h3>
                    {formData.disciplineMapping.length ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{t("wizard.step3")}</th>
                              <th>{t("discipline.importance")}</th>
                              <th>{t("discipline.volume")}</th>
                              <th>{t("wizard.step5")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.disciplineMapping.map((row) => {
                              const filled = (row.bindings || []).filter((binding) => binding.discipline.trim());
                              return (
                                <tr key={row.id}>
                                  <td>
                                    <div className="text-xs font-semibold text-primary">{row.component}</div>
                                    <div className="text-sm text-gray-800 leading-snug">{row.text}</div>
                                  </td>
                                  <td className="text-sm text-gray-800 whitespace-nowrap">
                                    {formatScaleScore(row.importance)}
                                  </td>
                                  <td className="text-sm text-gray-800 whitespace-nowrap">
                                    {formatScaleScore(row.volume)}
                                  </td>
                                  <td>
                                    {filled.length ? (
                                      <ul className="space-y-1">
                                        {filled.map((binding, idx) => (
                                          <li key={`${row.id}-${idx}`} className="text-sm text-gray-800">
                                            {binding.discipline}
                                            {binding.control ? (
                                              <span className="text-gray-500">
                                                {" "}
                                                · {translateKeyed(t, DISCIPLINE_CONTROL_I18N_KEYS, binding.control)}
                                              </span>
                                            ) : null}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-sm text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">{t("wizard.empty")}</p>
                    )}
                  </section>

                  {/* 6. Оценочные средства */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      6. {t("wizard.step6")}
                    </h3>
                    {(() => {
                      const assessmentByLevel = normalizeAssessmentByLevel(formData.assessmentByLevel);
                      const coverage = getAssessmentCoverage(formData.structure, assessmentByLevel);
                      const byId = new Map(listStructureComponents(formData.structure).map((item) => [item.id, item]));
                      return (
                        <>
                          <p className="text-sm text-gray-700">
                            {t("wizard.coverage", {
                              a: coverage.components.length - coverage.uncovered.length,
                              b: coverage.components.length,
                            })}
                            {coverage.uncovered.length > 0 ? (
                              <span className="text-amber-800">
                                {" "}
                                · {t("wizard.uncovered", {
                                  codes: coverage.uncovered.map((item) => item.code).join(", "),
                                })}
                              </span>
                            ) : coverage.components.length > 0 ? (
                              <span className="text-green-700"> · {t("wizard.allCovered")}</span>
                            ) : null}
                          </p>
                          {FORMATION_LEVELS.map((level) => {
                            const block = assessmentByLevel[level];
                            return (
                              <div key={level} className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {translateKeyed(t, FORMATION_I18N_KEYS, level)}
                                  {block.forNok ? (
                                    <span className="ml-2 text-xs font-medium text-primary">{t("detail.nok")}</span>
                                  ) : null}
                                </h4>
                                {block.tasks.length === 0 ? (
                                  <p className="text-sm text-gray-400">{t("wizard.empty")}</p>
                                ) : (
                                  <ul className="space-y-3">
                                    {block.tasks.map((task, idx) => {
                                      const complete = isAssessmentTaskComplete(task);
                                      const codes = task.componentIds
                                        .map((id) => byId.get(id)?.code)
                                        .filter(Boolean)
                                        .join(", ");
                                      const text = task.prompt.trim() || task.context.trim() || t("wizard.noPrompt");
                                      return (
                                        <li key={task.id} className="text-sm text-gray-800">
                                          <div className="font-medium">
                                            {idx + 1}. {assessmentMethodLabel(task.method)}
                                            {complete ? (
                                              <span className="ml-2 text-xs font-normal text-green-700">{t("wizard.filled")}</span>
                                            ) : (
                                              <span className="ml-2 text-xs font-normal text-amber-800">{t("wizard.draft")}</span>
                                            )}
                                            {task.forNok ? (
                                              <span className="ml-2 text-xs font-normal text-primary">{t("detail.nok")}</span>
                                            ) : null}
                                          </div>
                                          {codes ? (
                                            <div className="text-xs text-gray-500 mt-0.5">{t("detail.covers")} {codes}</div>
                                          ) : (
                                            <div className="text-xs text-amber-800 mt-0.5">{t("wizard.noComponents")}</div>
                                          )}
                                          <p className="whitespace-pre-line leading-snug mt-1">{text}</p>
                                          {task.criteria.trim() ? (
                                            <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">
                                              {t("wizard.criteria")} {task.criteria}
                                            </p>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </section>

                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      7. {t("wizard.sectionResources")}
                    </h3>
                    {resourcesFilled(formData.resources) ||
                    ["A", "B", "C"].some((group) =>
                      trimResourceList(formData.resources[group as "A" | "B" | "C"]).length,
                    ) ? (
                      <div className="space-y-4">
                        {(["A", "B", "C"] as const).map((group) => {
                          const items = trimResourceList(formData.resources[group]);
                          const title =
                            group === "A"
                              ? t("wizard.resourcesForKnowledge")
                              : group === "B"
                                ? t("wizard.resourcesForSkills")
                                : t("wizard.resourcesForPractice");
                          return (
                            <div key={group}>
                              <h4 className="text-sm font-medium text-gray-900 mb-1">
                                {group} — {title}
                              </h4>
                              {items.length ? (
                                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                                  {items.map((item, index) => (
                                    <li key={`${group}-${index}`}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-500">{t("wizard.empty")}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{t("wizard.empty")}</p>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      8. {t("wizard.sectionValidation")}
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-800">
                      {EXPERTISE_CRITERIA.map((_, index) => {
                        const row = formData.expertise[criterionKey(index)] || {};
                        const answer =
                          row.value === "да"
                            ? t("common.yes")
                            : row.value === "нет"
                              ? t("common.no")
                              : "—";
                        return (
                          <li key={criterionKey(index)}>
                            <span className="font-medium">{t(`review.c${index}`)}:</span> {answer}
                            {row.comment?.trim() ? (
                              <span className="text-gray-600"> — {row.comment.trim()}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      9. {t("wizard.sectionMapping")}
                    </h3>
                    <InternationalMappingPreview value={formData.internationalMapping} />
                  </section>

                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      {t("wizard.section91")}
                    </h3>
                    <HarmoniBricsPreview value={formData.harmoniBrics} />
                  </section>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      {t("wizard.afterSubmit")}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="xl:w-80 xl:shrink-0 w-full">
            <div className="sticky top-[var(--competence-sticky-h)] space-y-4">
              {competenceId && (workingCompetence?.can_view_activity || workingCompetence?.collaboration_role === "leader") ? (
                <div className="surface-padded space-y-3">
                  <h3 className="font-semibold text-gray-900">{t("activity.planTitle")}</h3>
                  <DevelopmentDeadlineCard
                    competenceId={competenceId}
                    dueDate={workingCompetence?.development_due}
                    progress={workingCompetence?.progress}
                    onUpdated={setWorkingCompetence}
                  />
                </div>
              ) : competenceId && workingCompetence?.progress ? (
                <div className="surface-padded">
                  <DevelopmentProgressBar
                    progress={workingCompetence.progress}
                    dueDate={workingCompetence.development_due}
                    compact
                  />
                </div>
              ) : null}
              <StepChatPanel
                competenceId={competenceId}
                step={currentStep}
                stepName={steps.find((item) => item.number === currentStep)?.name || ""}
                onCounts={setChatCounts}
              />
          {currentStep !== 2 ? (
            <div className="surface-padded">
              <h3 className="font-semibold text-gray-900 mb-4">{t("wizard.rulesTitle")}</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule1")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule2")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule3")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule4")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule5")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule6")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule7")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule8")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{t("wizard.rule9")}</span>
                </li>
              </ul>
            </div>
              ) : null}
            </div>
          </div>
        </div>
    </PageShell>
  );
}
