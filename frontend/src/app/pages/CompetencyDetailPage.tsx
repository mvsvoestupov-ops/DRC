import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, FileDown, Pencil } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { translateKeyed, API_STATUS_KEYS, FORMATION_I18N_KEYS } from '@/i18n/helpers';
import type { Competence } from '@/api/types';
import { FormationLevelsPanel } from '@/app/components/FormationLevelsPanel';
import { CompetenceReviewSection } from '@/app/components/CompetenceReviewSection';
import { InternationalMappingPreview } from '@/app/components/InternationalMappingStep';
import { normalizeInternationalMapping } from '@/lib/internationalMapping';
import { WorkingGroupPanel } from '@/app/components/WorkingGroupPanel';
import { groupDisciplineMapping, formatScaleScore } from '@/app/components/DisciplineMappingEditor';
import { displayAssessmentTools, TEST_ITEM_TYPES } from '@/lib/assessmentConstructor';
import { FosAttachments } from '@/app/components/AssessmentFosPreview';
import {
  FORMATION_LEVELS,
  DESCRIPTOR_CATEGORIES,
  getDescriptorText,
} from '@/lib/competenceMappers';
import { formatProfessionalAreaLabel } from '@/lib/professionalAreas';
import { PageShell } from '@/app/components/PageShell';
import { PageHeader } from '@/app/components/PageHeader';

const statusMeta: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  'проект': { variant: 'secondary', icon: <Clock className="w-4 h-4" /> },
  draft: { variant: 'secondary', icon: <Clock className="w-4 h-4" /> },
  'на экспертизе': { variant: 'secondary', icon: <AlertTriangle className="w-4 h-4" /> },
  review: { variant: 'secondary', icon: <AlertTriangle className="w-4 h-4" /> },
  'утверждена': { variant: 'default', icon: <CheckCircle className="w-4 h-4" /> },
  approved: { variant: 'default', icon: <CheckCircle className="w-4 h-4" /> },
};

async function fetchCompetence(id: number, isAuthenticated: boolean): Promise<Competence | null> {
  if (isAuthenticated) {
    try {
      return await apiClient.getCompetenceById(id);
    } catch {
      try {
        return await apiClient.getPublicCompetenceById(id);
      } catch {
        return null;
      }
    }
  }
  try {
    return await apiClient.getPublicCompetenceById(id);
  } catch {
    return null;
  }
}

export function CompetencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isExpert, isModerator } = useAuth();
  const { t, intlLocale } = useI18n();
  const [comp, setComp] = useState<Competence | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [docxError, setDocxError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchCompetence(Number(id), isAuthenticated)
      .then(setComp)
      .finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  const handleDownloadDocx = async () => {
    if (!comp?.id) return;
    setDownloadingDocx(true);
    setDocxError('');
    try {
      const blob = isAuthenticated
        ? await apiClient.downloadCompetenceDocx(comp.id)
        : await apiClient.downloadCompetenceDocx(comp.id, { public: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (comp.name || 'competence').replace(/[<>:"/\\|?*]+/g, '_').slice(0, 60);
      a.download = `competence_${comp.id}_${safeName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDocxError(err instanceof Error ? err.message : t('detail.docxError'));
    } finally {
      setDownloadingDocx(false);
    }
  };
  if (loading) return (
    <PageShell>
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </PageShell>
  );
  if (!comp) return (
    <PageShell>
      <p className="text-gray-600 text-lg">{t('detail.notFound')}</p>
    </PageShell>
  );

  const status = statusMeta[comp.status] || statusMeta['проект'];
  const statusLabel = translateKeyed(t, API_STATUS_KEYS, comp.status, t('status.draft'));
  const descriptors = comp.descriptors;
  const categories = [...DESCRIPTOR_CATEGORIES];
  const levels = [...FORMATION_LEVELS];
  const assessmentTasks = displayAssessmentTools(comp.assessment_tools as Array<Record<string, unknown>> | undefined);
  const formationLabel = (level: string) => translateKeyed(t, FORMATION_I18N_KEYS, level, level);

  return (
    <PageShell>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('common.back')}
      </Button>

      <PageHeader
        title={comp.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant} className="flex items-center gap-1">
              {status.icon}{statusLabel}
            </Badge>
            <Badge variant="outline">
              {t('detail.ql', { n: (comp as Competence).qualification_level || comp.qualification_level_code || '—' })}
            </Badge>
            <Badge variant="outline">ID: {comp.id}</Badge>
            {comp.collaboration_role === "leader" ? (
              <Badge variant="outline">{t('detail.leader')}</Badge>
            ) : comp.collaboration_role === "member" ? (
              <Badge variant="outline">{t('detail.member')}</Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={downloadingDocx}
              onClick={() => void handleDownloadDocx()}
            >
              <FileDown className="w-3.5 h-3.5" />
              {downloadingDocx ? t('common.docxBusy') : t('common.downloadDocx')}
            </Button>
            {comp.can_edit && comp.status === 'проект' ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/competency/${comp.id}/edit`)}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('detail.continue')}
              </Button>
            ) : null}
          </div>
        }
      />
      {docxError && (
        <p className="mb-4 text-sm text-red-600">{docxError}</p>
      )}
      {isAuthenticated && (comp.collaboration_role || comp.can_invite || (comp.collaborators || []).length > 0) ? (
        <WorkingGroupPanel competence={comp} onUpdated={setComp} />
      ) : null}
      <Card>
        <CardContent className="pt-8 pb-8">
          <Tabs defaultValue="main">
            <TabsList className="h-auto w-full mb-6 flex-wrap justify-start gap-1">
              <TabsTrigger value="main" className="flex-none px-4">{t('detail.tabMain')}</TabsTrigger>
              <TabsTrigger value="levels" className="flex-none px-4">{t('detail.tabLevels')}</TabsTrigger>
              <TabsTrigger value="structure" className="flex-none px-4">{t('detail.tabStructure')}</TabsTrigger>
              <TabsTrigger value="disciplines" className="flex-none px-4">{t('detail.tabDisciplines')}</TabsTrigger>
              <TabsTrigger value="assessment" className="flex-none px-4">{t('detail.tabAssessment')}</TabsTrigger>
              <TabsTrigger value="resources" className="flex-none px-4">{t('detail.tabResources')}</TabsTrigger>
              <TabsTrigger value="mapping" className="flex-none px-4">{t('detail.tabMapping')}</TabsTrigger>
            </TabsList>

            <TabsContent value="main">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <InfoItem label={t('detail.qualificationCode')} value={comp.qualification_name || '—'} />
                <InfoItem label={t('detail.qualificationLevel')} value={(comp as any).qualification_level || '—'} />
                <InfoItem label={t('detail.profStandardId')} value={String(comp.prof_standard_id || '—')} />
                <InfoItem label={t('detail.qualificationId')} value={String(comp.qualification_id || '—')} />
                <InfoItem label={t('detail.developer')} value={(comp as any).developer || '—'} />
                <InfoItem label={t('detail.validator')} value={(comp as any).validator || '—'} />
                <InfoItem
                  label={t('detail.area')}
                  value={formatProfessionalAreaLabel(comp.professional_area_code, comp.industry, t) || "—"}
                />
                <InfoItem label={t('detail.workload')} value={String(comp.hours || '—')} />
              </div>
              <InfoItem label={t('detail.description')} value={comp.description || '—'} />

              <h4 className="text-base font-medium mt-6 mb-2">{t('detail.laborFunctions')}</h4>
              {((comp as any).labor_functions?.length > 0) ? (
                <ul className="space-y-2">
                  {(comp as any).labor_functions.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-base">
                      <Badge variant="secondary">{item.code}</Badge>
                      {item.name || item.code}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-base">{t('common.notSpecifiedPl')}</p>
              )}
            </TabsContent>

            <TabsContent value="levels">
              <FormationLevelsPanel comp={comp} />
            </TabsContent>

            <TabsContent value="structure">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {categories.map(cat => (
                  <Card key={cat}>
                    <CardHeader><CardTitle className="text-lg">{t('detail.category', { cat })}</CardTitle></CardHeader>
                    <CardContent>
                      {(((comp as any).structure?.[cat])?.length > 0) ? (
                        <ul className="list-disc list-inside text-base space-y-1.5 leading-relaxed">
                          {((comp as any).structure[cat]).map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-base">{t('common.noData')}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <h4 className="text-base font-medium mb-3">{t('detail.descriptors')}</h4>
              <Accordion type="single" collapsible>
                {categories.map(cat => (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger>{t('detail.category', { cat })}</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {levels.map(level => (
                          <div key={`${cat}_${level}`}>
                            <span className="text-sm text-muted-foreground">{formationLabel(level)}</span>
                            <p className="text-base font-medium leading-relaxed">
                              {getDescriptorText(descriptors, cat, level) || '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="disciplines">
              <h4 className="text-base font-medium mb-3">{t('detail.disciplineMap')}</h4>
              {((comp as any).discipline_mapping?.length > 0) ? (
                <ul className="space-y-3">
                  {groupDisciplineMapping((comp as any).discipline_mapping).map((group) => (
                    <li key={group.key} className="flex items-start gap-2 flex-wrap">
                      <Badge variant="secondary" className="mt-0.5">{group.component}</Badge>
                      <div className="min-w-0 flex-1">
                        {group.text ? (
                          <p className="text-base text-gray-800 leading-relaxed">{group.text}</p>
                        ) : null}
                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          <Badge variant="outline">
                            {t('detail.importance', { n: formatScaleScore(group.importance) })}
                          </Badge>
                          <Badge variant="outline">
                            {t('detail.volume', { n: formatScaleScore(group.volume) })}
                          </Badge>
                        </div>
                        {group.bindings.length ? (
                          <ul className="mt-1.5 space-y-1">
                            {group.bindings.map((binding, idx) => (
                              <li key={`${group.key}-${idx}`} className="flex items-center gap-2 flex-wrap">
                                <span className="text-base font-medium">{binding.discipline || '—'}</span>
                                {binding.hours ? (
                                  <Badge variant="outline">{t('detail.hours', { n: binding.hours })}</Badge>
                                ) : null}
                                {binding.control ? (
                                  <Badge variant="outline">{binding.control}</Badge>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-base">{t('common.notSpecified')}</p>}

              <h4 className="text-base font-medium mt-6 mb-3">{t('detail.edtech')}</h4>
              {((comp as any).ed_technologies?.length > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {(comp as any).ed_technologies.map((tech: string, idx: number) => (
                    <Badge key={idx} variant="default">{tech}</Badge>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-base">{t('common.notSpecifiedPl')}</p>}
            </TabsContent>

            <TabsContent value="assessment">
              {assessmentTasks.length > 0 ? (
                <div className="space-y-6">
                  {FORMATION_LEVELS.map((level) => {
                    const tasks = assessmentTasks.filter((item) => item.level === level);
                    if (tasks.length === 0) return null;
                    return (
                      <div key={level} className="space-y-3">
                        <h4 className="text-base font-medium">{formationLabel(level)}</h4>
                        <ul className="space-y-4">
                          {tasks.map((item) => {
                            const itemTypeLabel = TEST_ITEM_TYPES.find((row) => row.value === item.itemType)?.label;
                            return (
                              <li key={item.id} className="border-b pb-3 last:border-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-base">{item.tool}</span>
                                  {itemTypeLabel ? (
                                    <Badge variant="outline">{itemTypeLabel}</Badge>
                                  ) : null}
                                  {item.forNok && <Badge variant="default">{t('detail.nok')}</Badge>}
                                </div>
                                {item.components.length > 0 ? (
                                  <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
                                    {t('detail.covers')}{" "}
                                    {item.components
                                      .map((component) =>
                                        component.code ? `${component.code}. ${component.text}` : component.text,
                                      )
                                      .join("; ")}
                                  </p>
                                ) : null}
                                {item.context ? (
                                  <p className="text-base text-gray-800 whitespace-pre-line mb-1 leading-relaxed">{item.context}</p>
                                ) : null}
                                {item.roles ? (
                                  <p className="text-base text-gray-700 mb-1">{t('detail.roles')} {item.roles}</p>
                                ) : null}
                                {item.prompt ? (
                                  <p className="text-base text-gray-800 whitespace-pre-line leading-relaxed">{item.prompt}</p>
                                ) : null}
                                {item.product ? (
                                  <p className="text-base text-gray-700 mt-1">{t('detail.result')} {item.product}</p>
                                ) : null}
                                {item.options.some((opt) => opt.text) ? (
                                  <ul className="mt-2 text-base text-gray-700 list-disc pl-5 space-y-0.5">
                                    {item.options.filter((opt) => opt.text).map((opt) => (
                                      <li key={opt.id}>
                                        {opt.text}
                                        {opt.isCorrect ? (
                                          <span className="ml-1 text-sm text-green-700">{t('detail.correct')}</span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                                  {item.criteria || t('detail.noCriteria')}
                                </p>
                                {item.attachments.length > 0 ? (
                                  <div className="mt-3">
                                    <FosAttachments attachments={item.attachments} compact />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                  {assessmentTasks.some(
                    (item) => !FORMATION_LEVELS.includes(item.level as (typeof FORMATION_LEVELS)[number]),
                  ) ? (
                    <ul className="space-y-4">
                      {assessmentTasks
                        .filter((item) => !FORMATION_LEVELS.includes(item.level as (typeof FORMATION_LEVELS)[number]))
                        .map((item) => (
                          <li key={item.id} className="border-b pb-3 last:border-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.level ? (
                                <Badge variant="secondary">{formationLabel(item.level)}</Badge>
                              ) : null}
                              <span className="font-medium text-base">{item.tool}</span>
                            </div>
                            <p className="text-base text-muted-foreground">{item.criteria || item.prompt || t('detail.noCriteria')}</p>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ) : <p className="text-muted-foreground text-base">{t('common.notSpecifiedPl')}</p>}
            </TabsContent>

            <TabsContent value="resources">
              <h4 className="text-base font-medium mb-3">{t('detail.mtb')}</h4>
              {((comp as any).resources?.length > 0) ? (
                <ul className="list-disc list-inside text-base space-y-1.5 leading-relaxed">
                  {(comp as any).resources.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-base">{t('common.notSpecifiedF')}</p>}

              <h4 className="text-base font-medium mt-6 mb-3">{t('detail.meta')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base">
                <InfoItem label={t('detail.created')} value={comp.created_at ? new Date(comp.created_at).toLocaleString(intlLocale) : '—'} />
                <InfoItem label={t('detail.updated')} value={comp.updated_at ? new Date(comp.updated_at).toLocaleString(intlLocale) : '—'} />
                <InfoItem label={t('detail.active')} value={(comp as any).is_active ? t('common.yes') : t('common.no')} />
              </div>
            </TabsContent>

            <TabsContent value="mapping">
              <InternationalMappingPreview value={normalizeInternationalMapping(comp.international_mapping)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(isExpert || isModerator) && (
        <CompetenceReviewSection competence={comp} onUpdated={setComp} />
      )}
    </PageShell>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="text-base font-medium leading-relaxed">{value}</p>
    </div>
  );
}
