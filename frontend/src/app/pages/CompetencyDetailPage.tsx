import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, FileDown } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Competence } from '@/api/types';
import { FormationLevelsPanel } from '@/app/components/FormationLevelsPanel';
import { CompetenceReviewSection } from '@/app/components/CompetenceReviewSection';
import {
  FORMATION_LEVELS,
  FORMATION_LEVEL_LABELS,
  DESCRIPTOR_CATEGORIES,
  getDescriptorText,
} from '@/lib/competenceMappers';
import { PageShell } from '@/app/components/PageShell';
import { PageHeader } from '@/app/components/PageHeader';

const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
  'проект': { variant: 'secondary', icon: <Clock className="w-4 h-4" />, label: 'Проект' },
  'на экспертизе': { variant: 'secondary', icon: <AlertTriangle className="w-4 h-4" />, label: 'На экспертизе' },
  'утверждена': { variant: 'default', icon: <CheckCircle className="w-4 h-4" />, label: 'Утверждена' },
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
      setDocxError(err instanceof Error ? err.message : 'Не удалось скачать DOCX');
    } finally {
      setDownloadingDocx(false);
    }
  };
  if (loading) return (
    <PageShell narrow>
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </PageShell>
  );
  if (!comp) return (
    <PageShell narrow>
      <p className="text-gray-600">Компетенция не найдена</p>
    </PageShell>
  );

  const status = statusMap[comp.status] || statusMap['проект'];
  const descriptors = comp.descriptors;
  const categories = [...DESCRIPTOR_CATEGORIES];
  const levels = [...FORMATION_LEVELS];

  return (
    <PageShell narrow>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>

      <PageHeader
        title={comp.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant} className="flex items-center gap-1">
              {status.icon}{status.label}
            </Badge>
            <Badge variant="outline">
              Ур. квалификации: {(comp as Competence).qualification_level || comp.qualification_level_code || '—'}
            </Badge>
            <Badge variant="outline">ID: {comp.id}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={downloadingDocx}
              onClick={() => void handleDownloadDocx()}
            >
              <FileDown className="w-3.5 h-3.5" />
              {downloadingDocx ? 'DOCX...' : 'Скачать DOCX'}
            </Button>
          </div>
        }
      />
      {docxError && (
        <p className="mb-4 text-sm text-red-600">{docxError}</p>
      )}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="main">
            <TabsList className="w-full mb-4 overflow-x-auto">
              <TabsTrigger value="main" className="flex-1">Основное</TabsTrigger>
              <TabsTrigger value="levels" className="flex-1">Уровни освоения</TabsTrigger>
              <TabsTrigger value="structure" className="flex-1">Структура A/B/C</TabsTrigger>
              <TabsTrigger value="disciplines" className="flex-1">Дисциплины и технологии</TabsTrigger>
              <TabsTrigger value="assessment" className="flex-1">Оценочные средства</TabsTrigger>
              <TabsTrigger value="resources" className="flex-1">Ресурсы</TabsTrigger>
            </TabsList>

            <TabsContent value="main">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <InfoItem label="Код квалификации" value={comp.qualification_name || '—'} />
                <InfoItem label="Уровень квалификации" value={(comp as any).qualification_level || '—'} />
                <InfoItem label="Профстандарт ID" value={String(comp.prof_standard_id || '—')} />
                <InfoItem label="Квалификация ID" value={String(comp.qualification_id || '—')} />
                <InfoItem label="Разработчик" value={(comp as any).developer || '—'} />
                <InfoItem label="Валидатор" value={(comp as any).validator || '—'} />
                <InfoItem label="Отрасль" value={comp.industry || '—'} />
                <InfoItem label="Трудоёмкость" value={String(comp.hours || '—')} />
              </div>
              <InfoItem label="Описание" value={comp.description || '—'} />

              <h4 className="text-sm font-medium mt-6 mb-2">Трудовые функции</h4>
              {((comp as any).labor_functions?.length > 0) ? (
                <ul className="space-y-2">
                  {(comp as any).labor_functions.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="text-xs">{item.code}</Badge>
                      {item.name || item.code}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Не указаны</p>
              )}
            </TabsContent>

            <TabsContent value="levels">
              <FormationLevelsPanel comp={comp} />
            </TabsContent>

            <TabsContent value="structure">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {categories.map(cat => (
                  <Card key={cat}>
                    <CardHeader><CardTitle className="text-base">Категория {cat}</CardTitle></CardHeader>
                    <CardContent>
                      {(((comp as any).structure?.[cat])?.length > 0) ? (
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {((comp as any).structure[cat]).map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <h4 className="text-sm font-medium mb-3">Дескрипторы уровней</h4>
              <Accordion type="single" collapsible>
                {categories.map(cat => (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger>Категория {cat}</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {levels.map(level => (
                          <div key={`${cat}_${level}`}>
                            <span className="text-xs text-muted-foreground">{FORMATION_LEVEL_LABELS[level]}</span>
                            <p className="text-sm font-medium">
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
              <h4 className="text-sm font-medium mb-3">Привязка к дисциплинам / модулям</h4>
              {((comp as any).discipline_mapping?.length > 0) ? (
                <ul className="space-y-3">
                  {(comp as any).discipline_mapping.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{item.component || '—'}</Badge>
                      <span className="text-sm font-medium">{item.discipline}</span>
                      <Badge variant="outline" className="text-xs">{item.control || '—'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указано</p>}

              <h4 className="text-sm font-medium mt-6 mb-3">Образовательные технологии</h4>
              {((comp as any).ed_technologies?.length > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {(comp as any).ed_technologies.map((tech: string, idx: number) => (
                    <Badge key={idx} variant="default" className="text-xs">{tech}</Badge>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">Не указаны</p>}
            </TabsContent>

            <TabsContent value="assessment">
              {((comp as any).assessment_tools?.length > 0) ? (
                <ul className="space-y-4">
                  {(comp as any).assessment_tools.map((item: any, idx: number) => (
                    <li key={idx} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={item.level === 'базовый' ? 'secondary' : item.level === 'продвинутый' ? 'secondary' : 'default'} className="text-xs">
                          {item.level}
                        </Badge>
                        <span className="font-medium text-sm">{item.tool}</span>
                        {item.for_nok && <Badge variant="default" className="text-xs">НОК</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.criteria || 'Критерии не указаны'}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указаны</p>}
            </TabsContent>

            <TabsContent value="resources">
              <h4 className="text-sm font-medium mb-3">Материально-техническая база</h4>
              {((comp as any).resources?.length > 0) ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {(comp as any).resources.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указана</p>}

              <h4 className="text-sm font-medium mt-6 mb-3">Дополнительные метаданные</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <InfoItem label="Создана" value={comp.created_at ? new Date(comp.created_at).toLocaleString() : '—'} />
                <InfoItem label="Обновлена" value={comp.updated_at ? new Date(comp.updated_at).toLocaleString() : '—'} />
                <InfoItem label="Активна" value={(comp as any).is_active ? 'Да' : 'Нет'} />
              </div>
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
