export interface User {
  email: string;
  role: string;
  id?: number;
  is_active?: boolean;
  email_confirmed?: boolean;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  organization?: string;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isExpert: boolean;
  isImpersonating: boolean;
  impersonatorEmail: string | null;
}

export interface Standard {
  id: number;
  code: string;
  name: string;
  description?: string;
  industry?: string;
}

export interface StandardDetail extends Standard {
  labor_functions?: Array<{
    code: string;
    name: string;
    description?: string;
  }>;
  qualification_levels?: string[];
}

export interface Qualification {
  id: number;
  name: string;
  code?: string;
  level?: string;
  activity_area?: string;
  prof_standard_id?: number;
  description?: string;
}

export interface PublicQualificationStats {
  local_count: number;
  expected: number;
  missing: number;
}

export interface PublicQualificationItem {
  id: number;
  code?: string;
  name: string;
  level?: string;
  activity_area?: string;
}

export type FormationLevel = 'базовый' | 'продвинутый' | 'экспертный';

export interface FormationLevelRef {
  code: FormationLevel;
  label: string;
  description: string;
  order: number;
}

export interface UniversalSkillRef {
  category: string;
  description?: string;
  levels?: Record<string, string>;
}

export interface QualificationLevelRef {
  qualification_level: number;
  qualification_level_label: string;
  order_148n_indicators: string;
  formation_levels: Record<FormationLevel, string>;
  universal_skills: Array<{ category: string; description: string }>;
  group?: string;
}

export interface MatrixContext {
  qualification_level: number;
  qualification_level_label: string;
  order_148n_indicators: string;
  formation_levels: Record<FormationLevel, string>;
  descriptors_by_category?: CompetenceDescriptors;
  universal_skills: Array<{ category: string; description: string }>;
  formation_level_definitions: FormationLevelRef[];
}

export type CompetenceDescriptors = Record<'A' | 'B' | 'C', Record<FormationLevel, string>>;

export interface FormationProfile {
  competence_kind: 'professional' | 'general' | 'universal';
  target_qualification_level_code?: number | null;
  matrix_ref?: {
    source: string;
    qualification_level?: number;
  } | null;
  universal_skills: Array<{ category: string; description: string }>;
  formation_templates: Record<FormationLevel, string>;
}

export interface SuggestProfileResponse {
  matrix_context: MatrixContext | null;
  formation_profile: FormationProfile;
  descriptors: CompetenceDescriptors;
  qualification_level_code: number | null;
}

export interface Competence {
  id: number;
  public_code?: string;
  code?: string;
  name: string;
  status: string;
  qualification_name?: string;
  qualification_level?: string;
  qualification_level_code?: number;
  prof_standard_id?: number;
  qualification_id?: number;
  competence_kind?: string;
  formation_profile?: FormationProfile;
  universal_skills?: Array<{ category: string; description: string }>;
  education_level?: string;
  education_kind?: string;
  education_training_profession_id?: number;
  education_training_profession?: string;
  fgos_id?: number;
  fgos_code?: string;
  fgos_name?: string;
  fgos_category?: string;
  description?: string;
  industry?: string;
  hours?: number;
  structure?: Record<string, string[]>;
  descriptors?: CompetenceDescriptors | Record<string, string>;
  matrix_context?: MatrixContext | null;
  assessment_tools?: any[];
  coverage_data?: any[];
  developer?: string;
  validator?: string;
  validation_notes?: string;
  labor_functions?: Array<{ code: string; name?: string }>;
  discipline_mapping?: any[];
  ed_technologies?: string[];
  resources?: string[];
  created_at?: string;
  updated_at?: string;
  is_active?: number;
}

export interface CompetenceStats {
  total: number;
  active: number;
  review: number;
  archived: number;
}

export interface CreateCompetencePayload {
  name: string;
  qualification_name?: string;
  qualification_level?: string;
  prof_standard_id?: number;
  qualification_id?: number;
  competence_kind?: string;
  labor_functions?: Array<{ code: string; name?: string }>;
  structure?: Record<string, string[]>;
  descriptors?: CompetenceDescriptors;
  assessment_tools?: Array<{ level: FormationLevel; tool: string; criteria?: string }>;
  ed_technologies?: string[];
  status?: string;
  developer?: string;
  description?: string;
  industry?: string;
  hours?: string;
  education_level?: string;
  education_kind?: string;
  education_training_profession_id?: number;
  education_training_profession?: string;
  fgos_id?: number;
  fgos_code?: string;
  fgos_name?: string;
  fgos_category?: string;
  universal_skills?: Array<{ category: string; description: string }>;
}

export interface EnrichedStandard extends Standard {
  is_active: boolean;
  qualification?: Qualification;
}

export interface Feedback {
  id: number;
  user_id?: number;
  message: string;
  category?: string;
  created_at?: string;
}

export interface Registration {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  created_at?: string;
}
