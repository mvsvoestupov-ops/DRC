import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Award, ChevronDown, ChevronRight, FileDown, Loader2, Save, Send, X } from "lucide-react";
import { defaultIndustries, DESCRIPTOR_CATEGORIES, DESCRIPTOR_CATEGORY_LABELS, FORMATION_LEVELS, FORMATION_LEVEL_LABELS } from "@/lib/competenceMappers";
import {
  buildStructureFromLaborFunctions,
  emptyStructure,
  structureToPayload,
  type LaborFunctionDetail,
  type StructureABC,
} from "@/lib/structureFromLaborFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import type { FormationLevel, MatrixContext, QualificationLevelRef } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
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

type AssessmentByLevel = Record<
  FormationLevel,
  { methods: string[]; criteria: string }
>;

const emptyAssessmentByLevel = (): AssessmentByLevel => ({
  базовый: { methods: [], criteria: "" },
  продвинутый: { methods: [], criteria: "" },
  экспертный: { methods: [], criteria: "" },
});

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
      <h4 className="text-xs font-medium text-gray-500 mb-1">{label}</h4>
      <p className="text-sm text-gray-900">{value?.trim() || "—"}</p>
    </div>
  );
}

export function NewCompetencyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    industry: "",
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
    files: [] as string[],
  });

  const steps = [
    { number: 1, name: "Общая информация" },
    { number: 2, name: "Профстандарт и уровень" },
    { number: 3, name: "Структура A/B/C" },
    { number: 4, name: "Дескрипторы" },
    { number: 5, name: "Оценочные средства" },
    { number: 6, name: "Предпросмотр" },
  ];

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

  const assessmentMethods = [
    "Кейс-метод",
    "Деловая игра",
    "Практические задания",
    "Тестирование",
    "Проектная работа",
  ];
  const competenceKinds: { value: CompetenceKind; label: string }[] = [
    { value: "professional", label: "Профессиональная" },
    { value: "general", label: "Общепрофессиональная" },
    { value: "universal", label: "Универсальная" },
  ];

  const structurePayload = structureToPayload(formData.structure);

  const selectedLaborFunctions = useMemo(
    () => laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id)),
    [laborFunctions, formData.selectedLaborFunctionIds],
  );

  const selectedTfKey = formData.selectedLaborFunctionIds.slice().sort((a, b) => a - b).join(",");

  const applyMatrixProfile = useCallback(async () => {
    if (!formData.qualificationLevel) {
      setError("Сначала выберите уровень квалификации (1–9)");
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
      setError(err instanceof Error ? err.message : "Не удалось загрузить профиль из матрицы");
    } finally {
      setApplyingMatrix(false);
    }
  }, [formData.qualificationLevel, formData.competenceKind, formData.structure]);

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
    setFormData((prev) => ({ ...prev, structure }));
  };

  const toggleAssessmentMethod = (level: FormationLevel, method: string) => {
    setFormData((prev) => {
      const current = prev.assessmentByLevel[level].methods;
      const methods = current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method];
      return {
        ...prev,
        assessmentByLevel: {
          ...prev.assessmentByLevel,
          [level]: { ...prev.assessmentByLevel[level], methods },
        },
      };
    });
  };

  const updateAssessmentCriteria = (level: FormationLevel, criteria: string) => {
    setFormData((prev) => ({
      ...prev,
      assessmentByLevel: {
        ...prev.assessmentByLevel,
        [level]: { ...prev.assessmentByLevel[level], criteria },
      },
    }));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getQualificationLevels()
      .then(setQualificationLevels)
      .catch(() => setQualificationLevels([]));
  }, [isAuthenticated]);

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
  }, [formData.educationKind, formData.educationLevel, laborFunctions]);

  useEffect(() => {
    if (formData.competenceKind !== "professional" || !selectedTfKey) return;
    const selected = laborFunctions.filter((lf) => formData.selectedLaborFunctionIds.includes(lf.id));
    if (selected.length === 0) return;
    setFormData((prev) => ({
      ...prev,
      structure: buildStructureFromLaborFunctions(selected, prev.structure),
    }));
  }, [selectedTfKey, laborFunctions, formData.competenceKind, formData.selectedLaborFunctionIds]);

  const buildAssessmentTools = () => {
    const tools: Array<{ level: FormationLevel; tool: string; criteria: string }> = [];
    for (const level of FORMATION_LEVELS) {
      const block = formData.assessmentByLevel[level];
      for (const method of block.methods) {
        tools.push({
          level,
          tool: method,
          criteria: block.criteria,
        });
      }
    }
    return tools;
  };

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
      standard_id: lf.standard_id,
      standard_reg_number: lf.standard_reg_number,
      standard_name: lf.standard_name,
    })),
    structure: structurePayload,
    descriptors: formData.descriptors,
    assessment_tools: buildAssessmentTools(),
    ed_technologies: Array.from(
      new Set(FORMATION_LEVELS.flatMap((level) => formData.assessmentByLevel[level].methods)),
    ),
    universal_skills: formData.matrixContext?.universal_skills,
    status,
    developer: formData.developer || user?.email || "Не указан",
    description: formData.description,
    industry: formData.industry,
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
        if (!formData.title.trim()) return "Укажите название компетенции";
        if (!formData.description.trim()) return "Укажите описание компетенции";
        if (!formData.educationKind) return "Выберите вид профессионального образования";
        if (
          formData.educationKind === "профессиональное образование" &&
          !formData.educationLevel
        ) {
          return "Выберите уровень образования";
        }
        if (
          formData.educationKind === "профессиональное обучение" &&
          !formData.trainingProfessionId
        ) {
          return "Выберите профессию рабочего или должность служащего";
        }
        if (
          (formData.educationKind === "профессиональное образование" ||
            formData.educationKind === "дополнительное образование") &&
          (formData.educationKind === "дополнительное образование" || formData.educationLevel) &&
          !formData.fgosId
        ) {
          return "Выберите ФГОС";
        }
        if (!formData.industry) return "Выберите отрасль";
        return null;
      case 2:
        if (!formData.qualificationLevel) {
          return "Укажите уровень квалификации по приказу №148н (1–9)";
        }
        if (formData.competenceKind === "professional" && selectedStandards.length === 0) {
          return "Выберите хотя бы один профессиональный стандарт";
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
          return "Добавьте хотя бы одно знание (A)";
        }
        if (!formData.structure.B.some((item) => item.text.trim())) {
          return "Добавьте хотя бы одно умение (B)";
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
      if (!formData.title.trim()) return "Укажите название компетенции";
      return null;
    }

    const stepError = validateStepsUpTo(6);
    if (stepError) return stepError;
    if (status === "на экспертизе") {
      const missingDescriptor = (["A", "B", "C"] as const).some((cat) =>
        FORMATION_LEVELS.some((level) => !formData.descriptors[cat][level]?.trim()),
      );
      if (missingDescriptor) {
        return "Заполните все дескрипторы (A/B/C × базовый/продвинутый/экспертный) перед отправкой на экспертизу";
      }
      if (buildAssessmentTools().length === 0) {
        return "Добавьте оценочные средства хотя бы для одного уровня сформированности";
      }
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
      const created = await apiClient.createCompetence(buildPayload(status));
      navigate(`/competency/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!formData.title.trim()) {
      setError("Укажите название компетенции перед выгрузкой DOCX");
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
      setError(err instanceof Error ? err.message : "Не удалось сформировать DOCX");
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
    setCurrentStep((prev) => Math.min(6, prev + 1));
  };

  const selectedQl = qualificationLevels.find(
    (item) => String(item.qualification_level) === formData.qualificationLevel,
  );

  if (!isAuthenticated) {
    return (
      <PageShell className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Требуется авторизация</h2>
        <p className="text-gray-600 mb-6">Войдите в систему, чтобы предложить новую компетенцию</p>
        <Link to="/login" state={{ from: "/new" }}>
          <Button>Войти</Button>
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Вернуться на главную
      </Link>

      <PageHeader title="Предложить новую компетенцию" />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8 w-full">
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
              className={`ml-2 text-sm font-medium text-left cursor-pointer hover:text-gray-900 truncate ${
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
                  Назад
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
                    disabled={submitting}
                    onClick={() => handleSubmit("проект")}
                  >
                    <Save className="w-4 h-4" />
                    Сохранить черновик
                  </Button>

                  {currentStep === 6 && (
                    <Button
                      variant="outline"
                      className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
                      disabled={downloadingDocx || submitting}
                      onClick={() => void handleDownloadDocx()}
                    >
                      <FileDown className="w-4 h-4" />
                      {downloadingDocx ? "DOCX..." : "Скачать DOCX"}
                    </Button>
                  )}

                  {currentStep < 6 ? (
                    <Button onClick={goNext} className="gap-2">
                      Далее
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      disabled={submitting}
                      onClick={() => handleSubmit("на экспертизе")}
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? "Отправка..." : "Отправить на экспертизу"}
                    </Button>
                  )}
                </div>
              </div>
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Общая информация о компетенции
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Название компетенции <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Например: Способен применять..."
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Описание компетенции <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="form-control"
                      placeholder="Подробное описание компетенции..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Выбор вида профессионального образования <span className="text-red-500">*</span>
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
                          {kind}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.educationKind === "профессиональное образование" ||
                    formData.educationKind === "дополнительное образование") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Уровень образования
                        {formData.educationKind === "профессиональное образование" && (
                          <span className="text-red-500"> *</span>
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
                        <option value="">Выберите уровень</option>
                        {educationLevels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showFgosPicker && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ФГОС <span className="text-red-500">*</span>
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
                        Профессия рабочего / должность служащего{" "}
                        <span className="text-red-500">*</span>
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
                        Отрасль <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="form-control"
                      >
                        <option value="">Выберите отрасль</option>
                        {defaultIndustries.map((industry) => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Тип компетенции
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
                      Разработчик (организация)
                    </label>
                    <Input
                      type="text"
                      value={formData.developer}
                      onChange={(e) => setFormData({ ...formData, developer: e.target.value })}
                      placeholder="Название организации"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    Профстандарт, трудовая функция и уровень квалификации
                  </h2>

                  {formData.competenceKind === "professional" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Профессиональный стандарт <span className="text-red-500">*</span>
                        </label>
                        {showRecommended && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-800 mb-1">
                              {showOksoRecommended
                                ? `Рекомендованные профстандарты по ОКСО ${formData.fgosCode}`
                                : recommendedOkpdtr
                                  ? `Рекомендованные профстандарты по ОКПДТР ${recommendedOkpdtr}`
                                  : "Рекомендованные профстандарты по ОКПДТР"}
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
                              {showOksoRecommended
                                ? "В список включены ПС, у которых в разделе ОКСО указан код выбранного ФГОС."
                                : "В список включены ПС, у которых в разделе ОКПДТР указан код выбранной профессии."}
                            </p>
                            {showOkpdtrRecommended && !recommendedOkpdtr ? (
                              <p className="text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-3">
                                У выбранной профессии нет кода ОКПДТР. Воспользуйтесь поиском ниже.
                              </p>
                            ) : recommendedLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-6">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span>
                                  {showOksoRecommended
                                    ? "Подбор профстандартов по коду ФГОС…"
                                    : "Подбор профстандартов по коду ОКПДТР…"}
                                </span>
                              </div>
                            ) : recommendedStandards.length === 0 ? (
                              <p className="text-sm text-gray-500 rounded-xl border border-gray-200 px-4 py-3">
                                {showOksoRecommended
                                  ? `Совпадений по коду ${formData.fgosCode} в разделе ОКСО нет. Воспользуйтесь поиском ниже.`
                                  : `Совпадений по коду ${recommendedOkpdtr} в разделе ОКПДТР нет. Воспользуйтесь поиском ниже.`}
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
                                Найдено: {recommendedStandards.length}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-3 mb-2">
                              Добавьте профстандарт — трудовые функции можно выбрать из нескольких ПС:
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
                              {tfLevelRangeHint(tfLevelRange)} Нажмите на профстандарт, чтобы открыть его трудовые функции.
                              У ТФ кнопка «вниз» показывает трудовые действия и знания/умения.
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
                                          {selectedCount > 0 ? ` · выбрано ТФ: ${selectedCount}` : ""}
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
                                        aria-label="Убрать профстандарт"
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
                                          <span>Идет загрузка трудовых функций</span>
                                        </div>
                                      ) : items.length === 0 ? (
                                        <p className="text-sm text-gray-500 py-1">Трудовые функции не найдены</p>
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
                                                      <span className="text-gray-500"> (ур. {levelLabel})</span>
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
                                                  aria-label={tfOpen ? "Скрыть ТД и З/У" : "Показать ТД и З/У"}
                                                  title="Трудовые действия, знания и умения"
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
                                                      Трудовые действия
                                                    </p>
                                                    {details.tds.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.tds.map((text, idx) => (
                                                          <li key={`${lf.id}-td-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">Нет данных</p>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                                      Знания
                                                    </p>
                                                    {details.knowledges.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.knowledges.map((text, idx) => (
                                                          <li key={`${lf.id}-z-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">Нет данных</p>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                                      Умения
                                                    </p>
                                                    {details.skills.length ? (
                                                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                                                        {details.skills.map((text, idx) => (
                                                          <li key={`${lf.id}-u-${idx}`}>{text}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-400">Нет данных</p>
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
                                Выбрано ТФ: {formData.selectedLaborFunctionIds.length}
                                {lockedTfLevel != null ? ` · уровень ${lockedTfLevel}` : ""}.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Уровень квалификации по приказу №148н <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.qualificationLevel}
                      onChange={(e) =>
                        setFormData({ ...formData, qualificationLevel: e.target.value })
                      }
                      className="form-control"
                      disabled={lockedTfLevel != null}
                    >
                      <option value="">Выберите уровень (1–9)...</option>
                      {allowedQualificationLevels.map((level) => (
                        <option key={level.qualification_level} value={String(level.qualification_level)}>
                          {level.qualification_level_label || `${level.qualification_level}-й уровень`}
                        </option>
                      ))}
                    </select>
                    {lockedTfLevel != null && (
                      <p className="text-xs text-gray-500 mt-2">
                        Уровень зафиксирован выбранными трудовыми функциями ({lockedTfLevel}).
                        Чтобы сменить уровень, снимите выбор ТФ.
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
                        Для общепрофессиональных и универсальных компетенций связь с профстандартом необязательна.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Рекомендуемая трудоёмкость
                    </label>
                    <Input
                      type="text"
                      value={formData.workload}
                      onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                      placeholder="Например: 180 часов"
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
                    (formData.qualificationLevel ? `${formData.qualificationLevel}-й уровень` : '')
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
                <div className="space-y-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Оценочные средства по уровням сформированности
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Укажите методы и критерии отдельно для базового, продвинутого и экспертного уровней.
                  </p>

                  {FORMATION_LEVELS.map((level) => (
                    <div key={level} className="rounded-xl border border-gray-200 p-5 space-y-4">
                      <h3 className="font-semibold text-primary">{FORMATION_LEVEL_LABELS[level]}</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Методы оценки
                        </label>
                        <div className="space-y-2">
                          {assessmentMethods.map((method) => (
                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.assessmentByLevel[level].methods.includes(method)}
                                onChange={() => toggleAssessmentMethod(level, method)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="text-sm text-gray-700">{method}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Критерии и типовые задания
                        </label>
                        <textarea
                          value={formData.assessmentByLevel[level].criteria}
                          onChange={(e) => updateAssessmentCriteria(level, e.target.value)}
                          rows={3}
                          className="form-control"
                          placeholder={`Опишите задания и критерии для ${FORMATION_LEVEL_LABELS[level].toLowerCase()} уровня…`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Предпросмотр компетенции</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Полная картина заполненных полей перед сохранением или отправкой на экспертизу
                    </p>
                  </div>

                  {/* 1. Общая информация */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      1. Общая информация
                    </h3>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">Название</h4>
                      <p className="text-base font-medium text-gray-900">{formData.title || "—"}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">Описание</h4>
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {formData.description || "—"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PreviewField
                        label="Вид профессионального образования"
                        value={formData.educationKind}
                      />
                      {formData.educationKind === "профессиональное образование" && (
                        <PreviewField label="Уровень образования" value={formData.educationLevel} />
                      )}
                      {formData.educationKind === "дополнительное образование" && formData.educationLevel && (
                        <PreviewField label="Уровень образования" value={formData.educationLevel} />
                      )}
                      {formData.fgosCode && (
                        <PreviewField
                          label="ФГОС"
                          value={`${formData.fgosCode} — ${formData.fgosName}`}
                        />
                      )}
                      {formData.educationKind === "профессиональное обучение" && (
                        <PreviewField
                          label="Профессия / должность"
                          value={
                            formData.trainingProfessionOkpdtr
                              ? `${formData.trainingProfessionName} (ОКПДТР ${formData.trainingProfessionOkpdtr})`
                              : formData.trainingProfessionName
                          }
                        />
                      )}
                      <PreviewField label="Отрасль" value={formData.industry} />
                      <PreviewField
                        label="Тип компетенции"
                        value={
                          competenceKinds.find((k) => k.value === formData.competenceKind)?.label
                        }
                      />
                      <PreviewField label="Трудоёмкость" value={formData.workload} />
                      <PreviewField
                        label="Разработчик"
                        value={formData.developer || user?.email}
                      />
                    </div>
                  </section>

                  {/* 2. Профстандарт и уровень */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      2. Профстандарт и уровень квалификации
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PreviewField
                        label="Профстандарт"
                        value={
                          selectedStandards.length
                            ? selectedStandards
                                .map(
                                  (item) =>
                                    `${item.name}${item.reg_number ? ` (рег. ${item.reg_number})` : ""}`,
                                )
                                .join("; ")
                            : formData.competenceKind === "professional"
                              ? "Не выбран"
                              : "Не требуется"
                        }
                      />
                      <PreviewField
                        label="Уровень квалификации (№148н)"
                        value={
                          selectedQl?.qualification_level_label ||
                          (formData.qualificationLevel
                            ? `${formData.qualificationLevel}-й уровень`
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
                          Трудовые функции ({selectedLaborFunctions.length})
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
                              {lf.otf_level ? ` (ур. ${lf.otf_level})` : ""}
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
                      3. Структура A / B / C
                    </h3>
                    {(["A", "B", "C"] as const).map((cat) => {
                      const items = formData.structure[cat].filter((item) => item.text.trim());
                      return (
                        <div key={cat}>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">
                            {cat}. {DESCRIPTOR_CATEGORY_LABELS[cat]}
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
                            <p className="text-sm text-gray-400">Не заполнено</p>
                          )}
                        </div>
                      );
                    })}
                  </section>

                  {/* 4. Дескрипторы */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      4. Дескрипторы уровней сформированности
                    </h3>
                    {DESCRIPTOR_CATEGORIES.map((cat) => (
                      <div key={cat} className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Категория {cat} ({DESCRIPTOR_CATEGORY_LABELS[cat]})
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
                                  {FORMATION_LEVEL_LABELS[level]}
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

                  {/* 5. Оценочные средства */}
                  <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                      5. Оценочные средства
                    </h3>
                    {FORMATION_LEVELS.map((level) => {
                      const block = formData.assessmentByLevel[level];
                      const hasContent = block.methods.length > 0 || block.criteria.trim();
                      return (
                        <div key={level} className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {FORMATION_LEVEL_LABELS[level]}
                          </h4>
                          {hasContent ? (
                            <>
                              <div>
                                <span className="text-xs font-medium text-gray-500">Методы: </span>
                                <span className="text-sm text-gray-800">
                                  {block.methods.length ? block.methods.join(", ") : "—"}
                                </span>
                              </div>
                              {block.criteria.trim() && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 block mb-1">
                                    Критерии и задания
                                  </span>
                                  <p className="text-sm text-gray-800 whitespace-pre-line leading-snug">
                                    {block.criteria}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">Не заполнено</p>
                          )}
                        </div>
                      );
                    })}
                  </section>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      После отправки заявка будет направлена на экспертизу. Для отправки нужны заполненные дескрипторы и оценочные средства.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="xl:w-72 xl:shrink-0 w-full">
            <div className="surface-padded sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">Правила заполнения</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Сначала найдите профстандарт через поиск (название, рег. номер, область)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Можно добавить несколько профстандартов и выбрать ТФ из разных ПС, но только одного уровня квалификации</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Умения из колонки B можно перенести в практические навыки (C)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>На шаге 4 нажмите «Загрузить из матрицы», чтобы подставить эталонные формулировки дескрипторов</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Оценочные средства указываются для каждого уровня сформированности</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Нажмите на номер шага для быстрого перехода между разделами</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
    </PageShell>
  );
}
