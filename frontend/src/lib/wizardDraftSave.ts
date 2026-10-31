/**
 * Чистая модель «сохранил черновик → открыл снова» для шагов 1–7.
 * Используется автотестами регрессии сохранения (особенно шаг 5).
 */
import {
  assessmentToolsToByLevel,
  emptyAssessmentByLevel,
  flattenAssessmentTools,
  type AssessmentByLevel,
} from "@/lib/assessmentConstructor";
import {
  emptyCompetenceResources,
  parseCompetenceResources,
  resourcesPayload,
  type CompetenceResources,
} from "@/lib/competenceResources";
import {
  flattenDisciplineMapping,
  groupDisciplineMapping,
  syncDisciplineMapping,
  type DisciplineMappingRow,
} from "@/app/components/DisciplineMappingEditor";
import {
  buildStructureFromLaborFunctions,
  structureFromPayload,
  structureToPayload,
  type LaborFunctionDetail,
  type StructureABC,
} from "@/lib/structureFromLaborFunctions";
import { createEmptyDescriptors, type DescriptorMap } from "@/app/components/DescriptorEditor";

export type WizardDraftSnapshot = {
  wizard_step: number;
  name: string;
  description: string;
  professional_area_code: string;
  education_kind: string;
  education_level: string;
  qualification_level: string;
  competence_kind: string;
  structure: StructureABC;
  descriptors: DescriptorMap;
  disciplineMapping: DisciplineMappingRow[];
  assessmentByLevel: AssessmentByLevel;
  resources: CompetenceResources;
  /** ТФ, по которым пересобирается структура после открытия (как в конструкторе). */
  laborFunctions?: LaborFunctionDetail[];
};

export type PersistedWizardPayload = {
  wizard_step: number;
  name: string;
  description: string;
  professional_area_code: string;
  education_kind: string;
  education_level: string;
  qualification_level: string;
  competence_kind: string;
  structure: ReturnType<typeof structureToPayload>;
  descriptors: DescriptorMap;
  discipline_mapping: ReturnType<typeof flattenDisciplineMapping>;
  assessment_tools: ReturnType<typeof flattenAssessmentTools>;
  resources: CompetenceResources;
};

/** Как `buildPayload` на фронте: что уходит в PUT /competences/{id}. */
export function buildWizardPersistPayload(draft: WizardDraftSnapshot): PersistedWizardPayload {
  return {
    wizard_step: draft.wizard_step,
    name: draft.name,
    description: draft.description,
    professional_area_code: draft.professional_area_code,
    education_kind: draft.education_kind,
    education_level: draft.education_level,
    qualification_level: draft.qualification_level,
    competence_kind: draft.competence_kind,
    structure: structureToPayload(draft.structure),
    descriptors: draft.descriptors,
    discipline_mapping: flattenDisciplineMapping(draft.disciplineMapping),
    assessment_tools: flattenAssessmentTools(draft.assessmentByLevel, draft.structure),
    resources: resourcesPayload(draft.resources),
  };
}

/**
 * Эмуляция гидрации после GET + эффект пересборки структуры
 * (buildStructureFromLaborFunctions + syncDisciplineMapping).
 */
export function reloadWizardDraftFromPayload(
  payload: PersistedWizardPayload,
  laborFunctions: LaborFunctionDetail[] = [],
): WizardDraftSnapshot {
  let structure = structureFromPayload(payload.structure as Record<string, unknown>);

  if (laborFunctions.length > 0) {
    structure = buildStructureFromLaborFunctions(laborFunctions, structure);
  }

  const grouped = groupDisciplineMapping(payload.discipline_mapping || []);
  const fromServer: DisciplineMappingRow[] = grouped.map((group) => {
    const category =
      group.category === "A" || group.category === "B" || group.category === "C"
        ? group.category
        : ((String(group.component || "").charAt(0).toUpperCase() as "A" | "B" | "C") || "A");
    return {
      id: String(group.key || ""),
      component: group.component,
      category,
      text: group.text,
      importance: group.importance,
      volume: group.volume,
      bindings: group.bindings.length
        ? group.bindings.map((binding) => ({
            discipline: binding.discipline,
            control: binding.control,
          }))
        : [{ discipline: "", control: "" }],
    };
  });

  return {
    wizard_step: payload.wizard_step,
    name: payload.name,
    description: payload.description,
    professional_area_code: payload.professional_area_code,
    education_kind: payload.education_kind,
    education_level: payload.education_level,
    qualification_level: payload.qualification_level,
    competence_kind: payload.competence_kind,
    structure,
    descriptors: payload.descriptors,
    disciplineMapping: syncDisciplineMapping(structure, fromServer),
    assessmentByLevel: assessmentToolsToByLevel(payload.assessment_tools, structure),
    resources: parseCompetenceResources(payload.resources),
    laborFunctions,
  };
}

/** Сохранить и сразу «открыть» — полный цикл одного шага. */
export function saveAndReloadWizardDraft(draft: WizardDraftSnapshot): WizardDraftSnapshot {
  const payload = buildWizardPersistPayload(draft);
  return reloadWizardDraftFromPayload(payload, draft.laborFunctions || []);
}

export function emptyWizardDraft(partial?: Partial<WizardDraftSnapshot>): WizardDraftSnapshot {
  return {
    wizard_step: 1,
    name: "",
    description: "",
    professional_area_code: "",
    education_kind: "профессиональное образование",
    education_level: "высшее образование - бакалавриат",
    qualification_level: "6",
    competence_kind: "professional",
    structure: { A: [], B: [], C: [] },
    descriptors: createEmptyDescriptors(),
    disciplineMapping: [],
    assessmentByLevel: emptyAssessmentByLevel(),
    resources: emptyCompetenceResources(),
    ...partial,
  };
}
