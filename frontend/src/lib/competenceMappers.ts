import type { Competence, FormationLevel } from '@/api/types';

export type UiStatus = 'active' | 'draft' | 'review' | 'archived';

const API_TO_UI: Record<string, UiStatus> = {
  'утверждена': 'active',
  'проект': 'draft',
  'на экспертизе': 'review',
};

const UI_TO_API: Record<UiStatus, string | null> = {
  active: 'утверждена',
  draft: 'проект',
  review: 'на экспертизе',
  archived: null,
};

export function mapApiStatusToUi(status: string, isActive = 1): UiStatus {
  if (isActive === 0) return 'archived';
  return API_TO_UI[status] || 'draft';
}

export function mapUiStatusToApi(status: UiStatus): string | undefined {
  return UI_TO_API[status] ?? undefined;
}

export function formatCompetenceId(id: number): string {
  return `RUS-PK-${String(id).padStart(4, '0')}`;
}

export interface CompetenceListItem {
  id: number;
  displayId: string;
  title: string;
  description: string;
  status: UiStatus;
  developer: string;
  industry: string;
  educationLevel: string;
  version: string;
  lastUpdated: string;
}

export function toListItem(comp: Competence): CompetenceListItem {
  const raw = comp as Competence & { raw_data?: { description?: string; industry?: string; hours?: string } };
  const description = comp.description || raw.raw_data?.description || '';
  const industry = comp.industry || raw.raw_data?.industry || '';
  return {
    id: comp.id,
    displayId: formatCompetenceId(comp.id),
    title: comp.name,
    description,
    status: mapApiStatusToUi(comp.status, (comp as Competence & { is_active?: number }).is_active ?? 1),
    developer: comp.developer || '—',
    industry: industry || '—',
    educationLevel: comp.qualification_level || '—',
    version: '1.0',
    lastUpdated: comp.updated_at || comp.created_at || '',
  };
}

export const statusColors: Record<UiStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-gray-50 text-gray-700 border-gray-200',
  review: 'bg-amber-50 text-amber-700 border-amber-200',
  archived: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const statusLabels: Record<UiStatus, string> = {
  active: 'Действует',
  draft: 'Проект',
  review: 'На экспертизе',
  archived: 'Архив',
};

export const defaultIndustries = [
  'Юриспруденция',
  'Финансы',
  'IT и цифровая экономика',
  'Образование',
  'Здравоохранение',
  'Инженерия',
  'Маркетинг и PR',
];

/** Уровни сформированности компетенции (единая шкала проекта). */
export const FORMATION_LEVELS: FormationLevel[] = ['базовый', 'продвинутый', 'экспертный'];
export type { FormationLevel };

export const FORMATION_LEVEL_LABELS: Record<FormationLevel, string> = {
  базовый: 'Базовый',
  продвинутый: 'Продвинутый',
  экспертный: 'Экспертный',
};

export const DESCRIPTOR_CATEGORIES = ['A', 'B', 'C'] as const;
export type DescriptorCategory = (typeof DESCRIPTOR_CATEGORIES)[number];

export const DESCRIPTOR_CATEGORY_LABELS: Record<DescriptorCategory, string> = {
  A: 'Знания',
  B: 'Умения / интеллектуальные навыки',
  C: 'Практические навыки',
};

export function getDescriptorText(
  descriptors: Competence['descriptors'] | undefined,
  category: DescriptorCategory,
  level: FormationLevel,
): string {
  if (!descriptors) return '';
  const nested = (descriptors as Record<string, unknown>)[category];
  if (nested && typeof nested === 'object' && level in (nested as object)) {
    return String((nested as Record<string, string>)[level] || '');
  }
  const flatKey = `${category}_${level}`;
  return String((descriptors as Record<string, string>)[flatKey] || '');
}
