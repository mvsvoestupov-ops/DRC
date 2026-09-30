import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Award, ChevronDown, ChevronRight, FileDown, Loader2, Plus, Save, Send, X } from "lucide-react";
import { DESCRIPTOR_CATEGORIES, FORMATION_LEVELS } from "@/lib/competenceMappers";
import { PROFESSIONAL_AREAS, areaDisplayCode, findProfessionalArea, formatProfessionalAreaLabel } from "@/lib/professionalAreas";
import {
  buildStructureFromLaborFunctions,
  emptyStructure,
  structureFromPayload,
  structureToPayload,
  type LaborFunctionDetail,
  type StructureABC,
} from "@/lib/structureFromLaborFunctions";
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
import { WorkingGroupPanel } from "@/app/components/WorkingGroupPanel";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
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
  analyzeInternationalMapping,
  emptyInternationalMapping,
  normalizeInternationalMapping,
  type InternationalMapping,
} from "@/lib/internationalMapping";
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

const DISCIPLINE_CONTROL_I18N_KEYS: Record<string, string> = {
  "зачёт": "discipline.credit",
  "экзамен": "discipline.exam",
  "защита проекта": "discipline.project",
  "курсовая работа": "discipline.coursework",
  "отчёт по практике": "discipline.practiceReport",
};

const PROFESSIONAL_EDUCATION_LEVELS = [
  "среднее профессиональное образование",
  "высшее образование - бакалавриат",
  "высшее образование - специалитет, магистратура",
  "высшее образование - подготовка кадров высшей квалификации",
] as const;

function tfDetails(lf: LaborFunctionDetail) {
  const tds: string[] = [];
  const knowledges: string[] = [];
  const skills: string[] = [];
  const seenK = new Set<string>();
  const seenS = new Set<string>();
  for (const action of lf.labor_actions || []) {
    const td = (action.text || "").trim();
    if (td) tds.push(td);
    for (const raw of action.knowledges || []) {
      const text = raw.trim();
      const key = text.toLowerCase();
      if (!text || seenK.has(key)) continue;
      seenK.add(key);
      knowledges.push(text);
    }
    for (const raw of action.skills || []) {
      const text = raw.trim();
      const key = text.toLowerCase();
      if (!text || seenS.has(key)) continue;
      seenS.add(key);
      skills.push(text);
    }
  }
  return { tds, knowledges, skills };
}

function PreviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-500 mb-1">{label}</h4>
      <p className="text-base text-gray-900 leading-relaxed">{value?.trim() || "—"}</p>
    </div>
  );
}

export function NewCompetencyPage() {
  const navigate = useNavigate();
  const { id: editIdParam } = useParams<{ id?: string }>();
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = Boolean(editId);
  const { isAuthenticated, user } = useAuth();
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
  const [expandedStandardIds, setExpandedStandardIds] = useState<number[]>([]);
  const [expandedTfIds, setExpandedTfIds] = useState<number[]>([]);
  const [qualificationLevels, setQualificationLevels] = useState<QualificationLevelRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [applyingMatrix, setApplyingMatrix] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [error, setError] = useState("");
  const [canSubmitToReview, setCanSubmitToReview] = useState(true);
  const [hydrating, setHydrating] = useState(Boolean(editId));
  const [workingCompetence, setWorkingCompetence] = useState<Competence | null>(null);
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
    resources: [] as string[],
    expertise: {} as ExpertiseChecklist,
    internationalMapping: emptyInternationalMapping() as InternationalMapping,
  });

  const steps = [
    { number: 1, name: t("wizard.step1") },
    { number: 2, name: t("wizard.step2") },
    { number: 3, name: t("wizard.step3") },
    { number: 4, name: t("wizard.step4") },
    { number: 5, name: t("wizard.step5") },
    { number: 6, name: t("wizard.step6") },
    { number: 7, name: t("wizard.step7") },
    { number: 8, name: t("wizard.step8") },
    { number: 9, name: t("wizard.step9") },
    { number: 10, name: t("wizard.step10") },
  ];
  const lastStep = steps.length;

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
    return parseTfLevel(selected[0]?.otf_level);
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

  const runInternationalMapping = useCallback(() => {
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
        laborFunctions: laborFunctions.filter((lf) => prev.selectedLaborFunctionIds.includes(lf.id)),
        structure: prev.structure,
      }),
    }));
  }, [laborFunctions]);

  useEffect(() => {
    if (currentStep !== 9) return;
    if (formData.internationalMapping.analyzedAt) return;
    runInternationalMapping();
  }, [currentStep, formData.internationalMapping.analyzedAt, runInternationalMapping]);

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
        descriptors: normalizeDescriptorMap(result.descriptors),
        matrixContext: result.matrix_context,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("wizard.matrixError"));
    } finally {
      setApplyingMatrix(false);
    }
  }, [formData.qualificationLevel, formData.competenceKind, formData.structure, t]);

  const toggleLaborFunction = (id: number) => {
    const target = laborFunctions.find((lf) => lf.id === id);
    const level = parseTfLevel(target?.otf_level);
    const alreadySelected = formData.selectedLaborFunctionIds.includes(id);
    if (!alreadySelected && tfDisabledReason(level, tfLevelRange, lockedTfLevel)) {
      return;
    }
    setFormData((prev) => {
      const ids = alreadySelected
        ? prev.selectedLaborFunctionIds.filter((item) => item !== id)
        : [...prev.selectedLaborFunctionIds, id];
      const selected = laborFunctions.filter((lf) => ids.includes(lf.id));
      const otfLevel = selected[0] ? parseTfLevel(selected[0].otf_level) : null;
      return {
        ...prev,
        selectedLaborFunctionIds: ids,
        qualificationLevel: otfLevel != null ? String(otfLevel) : prev.qualificationLevel,
      };
    });
  };

  const updateStructure = (structure: StructureABC) => {
    setFormData((prev) => ({
      ...prev,
      structure,
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
        setCanSubmitToReview(comp.collaboration_role !== "member");
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
          resources: Array.isArray(comp.resources) ? comp.resources : [],
          expertise: (comp.expertise || {}) as ExpertiseChecklist,
          internationalMapping: normalizeInternationalMapping(comp.international_mapping),
        }));
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
              otf_level: formatTfLevel(lf.otf_level) ?? "",
            }));
            setLaborFunctions(tagged);
            const selectedCodes = new Set(lfList.map((item: { code?: string }) => item.code).filter(Boolean));
            setFormData((prev) => ({
              ...prev,
              selectedLaborFunctionIds: tagged.filter((item) => selectedCodes.has(item.code)).map((item) => item.id),
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
    if (selectedStandards.some((item) => item.id === standard.id)) return;
    setSelectedStandards((prev) => [...prev, standard]);
    setExpandedStandardIds((prev) => (prev.includes(standard.id) ? prev : [...prev, standard.id]));
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
          otf_level: formatTfLevel(lf.otf_level) ?? "",
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
    setExpandedStandardIds((prev) => prev.filter((id) => id !== standardId));
    setExpandedTfIds((prev) => prev.filter((id) => !removedIds.has(id)));
    setLaborFunctions((prev) => prev.filter((lf) => lf.standard_id !== standardId));
    setFormData((prev) => {
      const ids = prev.selectedLaborFunctionIds.filter((id) => !removedIds.has(id));
      const remaining = selectedStandards.filter((item) => item.id !== standardId);
      const selected = laborFunctions.filter(
        (lf) => lf.standard_id !== standardId && ids.includes(lf.id),
      );
      const otfLevel = selected[0] ? parseTfLevel(selected[0].otf_level) : null;
      return {
        ...prev,
        profStandardId: remaining[0]?.id ?? null,
        selectedLaborFunctionIds: ids,
        qualificationLevel: otfLevel != null ? String(otfLevel) : prev.qualificationLevel,
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
        return isTfLevelInRange(parseTfLevel(lf?.otf_level), range);
      });
      let nextLevel = prev.qualificationLevel;
      if (nextLevel && range && !isTfLevelInRange(Number(nextLevel), range)) {
        nextLevel = "";
      }
      if (allowedIds.length === prev.selectedLaborFunctionIds.length && nextLevel === prev.qualificationLevel) {
        return prev;
      }
      const selected = laborFunctions.filter((lf) => allowedIds.includes(lf.id));
      const firstLevel = selected[0] ? parseTfLevel(selected[0].otf_level) : null;
      const sameLevelIds =
        firstLevel == null
          ? allowedIds
          : allowedIds.filter((id) => {
              const lf = laborFunctions.find((item) => item.id === id);
              return parseTfLevel(lf?.otf_level) === firstLevel;
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
    if (formData.competenceKind !== "professional" || !selectedTfKey) return;
    const selected = laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id));
    if (selected.length === 0) return;
    setFormData((prev) => {
      const structure = buildStructureFromLaborFunctions(selected, prev.structure);
      return {
        ...prev,
        structure,
        disciplineMapping: syncDisciplineMapping(structure, prev.disciplineMapping),
        assessmentByLevel: syncAssessmentByLevel(structure, prev.assessmentByLevel),
      };
    });
  }, [selectedTfKey, laborFunctions, formData.competenceKind, formData.selectedLaborFunctionIds, hydrating]);

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
    resources: formData.resources.map((item) => item.trim()).filter(Boolean),
    expertise: formData.expertise,
    international_mapping: formData.internationalMapping,
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
        if (formData.resources.map((item) => item.trim()).filter(Boolean).length < 3) {
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
        FORMATION_LEVELS.some((level) => !formData.descriptors[cat][level]?.trim()),
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
      const saved = isEdit && editId
        ? await apiClient.updateCompetence(editId, payload)
        : await apiClient.createCompetence(payload);
      if (saved?.id) setWorkingCompetence(saved);
      if (status === "на экспертизе") {
        navigate(`/competency/${saved.id}`);
      } else if (!isEdit && saved?.id) {
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

  const goToStep = (target: number) => {
    if (target === currentStep) return;
    setError("");
    setCurrentStep(target);
  };

  const goNext = () => {
    setError("");
    setCurrentStep((prev) => Math.min(lastStep, prev + 1));
  };

  const selectedQl = qualificationLevels.find(
    (item) => String(item.qualification_level) === formData.qualificationLevel,
  );

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
    <PageShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-base text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("wizard.backHome")}
      </Link>

      <PageHeader title={isEdit ? t("wizard.titleEdit") : t("wizard.titleNew")} />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}
      {!canSubmitToReview ? (
        <p className="mb-6 text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {t("wizard.memberNotice")}
        </p>
      ) : null}
      <WorkingGroupPanel
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 w-full">
        {steps.map((step) => (
          <div key={step.number} className="flex items-center min-w-0">
            <button
              type="button"
              onClick={() => goToStep(step.number)}
              title={step.name}
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm transition-colors cursor-pointer ${
                currentStep === step.number
                  ? "bg-primary text-white ring-2 ring-primary/30"
                  : currentStep > step.number
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
            >
              {step.number}
            </button>
            <button
              type="button"
              onClick={() => goToStep(step.number)}
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
          <div className="surface p-6 lg:p-8 w-full">
              <div className="flex justify-between mb-6 pb-6 border-b border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => goToStep(currentStep - 1)}
                  disabled={currentStep === 1}
                  className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("common.back")}
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
                    disabled={submitting}
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
                    <Button onClick={goNext} className="gap-2">
                      {t("common.next")}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : canSubmitToReview ? (
                    <Button
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      disabled={submitting}
                      onClick={() => handleSubmit("на экспертизе")}
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? t("wizard.submitting") : t("wizard.submitReview")}
                    </Button>
                  ) : null}
                </div>
              </div>
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {t("wizard.step1Title")}
                  </h2>

                  <div>
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

                  <div>
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

                  <div>
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

                  <div>
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
                    <div>
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
                    <div>
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
                    <div>
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

                  <div>
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

                  <div>
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
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {t("wizard.step2Title")}
                  </h2>

                  {formData.competenceKind === "professional" && (
                    <>
                      <div>
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
                        <ProfStandardSearchPicker
                          selectedId={null}
                          selected={null}
                          selectedIds={selectedStandards.map((item) => item.id)}
                          allowMultiple
                          onSelect={handleAddStandard}
                        />
                        {selectedStandards.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-xs text-gray-500">
                              {tfLevelRangeHint(tfLevelRange)} {t("wizard.clickPs")} {t("wizard.tfDown")}
                            </p>
                            {selectedStandards.map((item) => {
                              const items = laborFunctions.filter((lf) => lf.standard_id === item.id);
                              const selectedCount = items.filter((lf) =>
                                formData.selectedLaborFunctionIds.includes(lf.id),
                              ).length;
                              const expanded = expandedStandardIds.includes(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden"
                                >
                                  <div className="flex items-stretch">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedStandardIds((prev) =>
                                          prev.includes(item.id)
                                            ? prev.filter((id) => id !== item.id)
                                            : [...prev, item.id],
                                        )
                                      }
                                      className="flex-1 min-w-0 text-left px-3 py-3 flex items-start gap-2 hover:bg-white/40"
                                    >
                                      {expanded ? (
                                        <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-primary">
                                          {item.reg_number}
                                          {item.ps_code ? ` · ${item.ps_code}` : ""}
                                          {selectedCount > 0 ? ` · ${t("wizard.selectedTf", { n: selectedCount })}` : ""}
                                        </p>
                                        <p className="text-sm text-gray-800 leading-snug">{item.name}</p>
                                      </div>
                                    </button>
                                    <div className="flex items-start p-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveStandard(item.id)}
                                        aria-label={t("wizard.removePs")}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  {expanded && (
                                    <div className="border-t border-primary/15 bg-white p-3 space-y-2">
                                      {laborFunctionsLoading && items.length === 0 ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                          <span>{t("wizard.loadingTf")}</span>
                                        </div>
                                      ) : items.length === 0 ? (
                                        <p className="text-sm text-gray-500 py-1">{t("wizard.tfNotFound")}</p>
                                      ) : (
                                        items.map((lf) => {
                                          const levelLabel = formatTfLevel(lf.otf_level);
                                          const level = parseTfLevel(lf.otf_level);
                                          const selected = formData.selectedLaborFunctionIds.includes(lf.id);
                                          const reason = selected
                                            ? null
                                            : tfDisabledReason(level, tfLevelRange, lockedTfLevel);
                                          const disabled = Boolean(reason);
                                          const tfOpen = expandedTfIds.includes(lf.id);
                                          const details = tfDetails(lf);
                                          return (
                                            <div
                                              key={lf.id}
                                              className={`rounded-lg border ${
                                                disabled ? "border-gray-100 bg-gray-50" : "border-gray-200"
                                              }`}
                                            >
                                              <div className="flex items-start gap-2 px-3 py-2">
                                                <input
                                                  type="checkbox"
                                                  checked={selected}
                                                  disabled={disabled}
                                                  onChange={() => toggleLaborFunction(lf.id)}
                                                  className="mt-1 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <p className={`text-sm ${disabled ? "text-gray-400" : "text-gray-800"}`}>
                                                    <span className="font-medium">{lf.code}</span>
                                                    {" — "}
                                                    {lf.name}
                                                    {levelLabel ? (
                                                      <span className="text-gray-500"> {t("wizard.tfLevel", { n: levelLabel })}</span>
                                                    ) : null}
                                                  </p>
                                                  {reason ? (
                                                    <p className="text-xs text-gray-400 mt-1">{reason}</p>
                                                  ) : null}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setExpandedTfIds((prev) =>
                                                      prev.includes(lf.id)
                                                        ? prev.filter((id) => id !== lf.id)
                                                        : [...prev, lf.id],
                                                    )
                                                  }
                                                  className="shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                                                  aria-label={tfOpen ? t("wizard.hideTf") : t("wizard.showTf")}
                                                  title={t("wizard.tdZuTitle")}
                                                >
                                                  <ChevronDown
                                                    className={`w-4 h-4 transition-transform ${tfOpen ? "rotate-180" : ""}`}
                                                  />
                                                </button>
                                              </div>
                                              {tfOpen && (
                                                <div className="border-t border-gray-100 px-3 py-3 space-y-3 text-sm">
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                                      {t("wizard.laborActions")}
                                                    </p>
                                                    {details.tds.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.tds.map((text, idx) => (
                                                          <li key={`${lf.id}-td-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">{t("common.noData")}</p>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                                      {t("wizard.knowledge")}
                                                    </p>
                                                    {details.knowledges.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.knowledges.map((text, idx) => (
                                                          <li key={`${lf.id}-z-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">{t("common.noData")}</p>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                                      {t("wizard.skills")}
                                                    </p>
                                                    {details.skills.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.skills.map((text, idx) => (
                                                          <li key={`${lf.id}-u-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">{t("common.noData")}</p>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {formData.selectedLaborFunctionIds.length > 0 && (
                              <p className="text-sm text-primary">
                                {t("wizard.selectedTf", { n: formData.selectedLaborFunctionIds.length })}
                                {lockedTfLevel != null ? ` · ${t("wizard.levelN", { n: lockedTfLevel })}` : ""}.
                              </p>
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
                <div className="space-y-6">
                  <div>
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
                <DescriptorEditor
                  descriptors={formData.descriptors}
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
              )}

              {currentStep === 5 && (
                <div className="space-y-4">
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
              )}

              {currentStep === 7 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step7Title")}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t("wizard.step7Lead")}</p>
                  </div>
                  <div className="space-y-3">
                    {formData.resources.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={item}
                          placeholder={t("wizard.resourcePlaceholder")}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              resources: prev.resources.map((row, i) =>
                                i === index ? e.target.value : row,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 text-red-600 border-gray-300 hover:bg-red-50"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              resources: prev.resources.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          {t("wizard.removeResource")}
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-dashed"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          resources: [...prev.resources, ""],
                        }))
                      }
                    >
                      <Plus className="w-4 h-4" />
                      {t("wizard.addResource")}
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 8 && (
                <div className="space-y-6">
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
                <InternationalMappingStep
                  value={formData.internationalMapping}
                  onChange={(internationalMapping) =>
                    setFormData((prev) => ({ ...prev, internationalMapping }))
                  }
                  onRecalculate={runInternationalMapping}
                />
              )}

              {currentStep === lastStep && (
                <div className="space-y-6">
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {FORMATION_LEVELS.map((level) => {
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
                    {formData.resources.map((item) => item.trim()).filter(Boolean).length ? (
                      <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                        {formData.resources
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                      </ul>
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

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      {t("wizard.afterSubmit")}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="xl:w-72 xl:shrink-0 w-full">
            <div className="surface-padded sticky top-6">
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
          </div>
        </div>
    </PageShell>
  );
}
