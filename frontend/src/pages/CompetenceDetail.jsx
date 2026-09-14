import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/Accordion';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, Briefcase, BookOpen, Award, Microscope } from 'lucide-react';
import { getCompetence } from '../api';

const statusMap = {
  'проект': { variant: 'secondary', icon: <Clock className="w-4 h-4" />, label: 'Проект' },
  'на экспертизе': { variant: 'warning', icon: <AlertTriangle className="w-4 h-4" />, label: 'На экспертизе' },
  'утверждена': { variant: 'success', icon: <CheckCircle className="w-4 h-4" />, label: 'Утверждена' },
};

const CompetenceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompetence(id)
      .then(res => setComp(res.data))
      .catch(() => setComp(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  if (!comp) return <div className="p-6">Компетенция не найдена</div>;

  const status = statusMap[comp.status] || statusMap['проект'];
  const descriptors = comp.descriptors || {};
  const categories = ['A', 'B', 'C'];
  const levels = ['базовый', 'продвинутый', 'экспертный'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-medium">{comp.name}</h2>
              <Badge variant={status.variant} className="flex items-center gap-1">
                {status.icon}{status.label}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">Уровень: {comp.qualification_level || '—'}</Badge>
              <Badge variant="outline">ID: {comp.id}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="main">
            <TabsList className="w-full mb-4 overflow-x-auto">
              <TabsTrigger value="main" className="flex-1">Основное</TabsTrigger>
              <TabsTrigger value="structure" className="flex-1">Структура A/B/C</TabsTrigger>
              <TabsTrigger value="disciplines" className="flex-1">Дисциплины и технологии</TabsTrigger>
              <TabsTrigger value="assessment" className="flex-1">Оценочные средства</TabsTrigger>
              <TabsTrigger value="resources" className="flex-1">Ресурсы</TabsTrigger>
            </TabsList>

            {/* Вкладка Основное */}
            <TabsContent value="main">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <InfoItem label="Код квалификации" value={comp.qualification_name || '—'} />
                <InfoItem label="Уровень квалификации" value={comp.qualification_level || '—'} />
                <InfoItem label="Профстандарт ID" value={comp.prof_standard_id || '—'} />
                <InfoItem label="Квалификация ID" value={comp.qualification_id || '—'} />
                <InfoItem label="Разработчик" value={comp.developer || '—'} />
                <InfoItem label="Валидатор" value={comp.validator || '—'} />
                <InfoItem label="Отрасль" value={comp.raw_data?.industry || comp.industry || '—'} />
                <InfoItem label="Трудоёмкость" value={comp.raw_data?.hours || comp.hours || '—'} />
              </div>
              <InfoItem label="Описание" value={comp.raw_data?.description || comp.description || '—'} />

              <h4 className="text-sm font-medium mt-6 mb-2">Трудовые функции</h4>
              {comp.labor_functions?.length > 0 ? (
                <ul className="space-y-2">
                  {comp.labor_functions.map((item, idx) => (
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

            {/* Вкладка Структура A/B/C */}
            <TabsContent value="structure">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {categories.map(cat => (
                  <Card key={cat}>
                    <CardHeader><CardTitle className="text-base">Категория {cat}</CardTitle></CardHeader>
                    <CardContent>
                      {comp.structure?.[cat]?.length > 0 ? (
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {comp.structure[cat].map((item, idx) => (
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
                        {levels.map(level => {
                          const key = `${cat}_${level}`;
                          return (
                            <div key={key}>
                              <span className="text-xs text-muted-foreground capitalize">{level}</span>
                              <p className="text-sm font-medium">{descriptors[key] || '—'}</p>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            {/* Вкладка Дисциплины и технологии */}
            <TabsContent value="disciplines">
              <h4 className="text-sm font-medium mb-3">Привязка к дисциплинам / модулям</h4>
              {comp.discipline_mapping?.length > 0 ? (
                <ul className="space-y-3">
                  {comp.discipline_mapping.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{item.component || '—'}</Badge>
                      <span className="text-sm font-medium">{item.discipline}</span>
                      <Badge variant="outline" className="text-xs">{item.control || '—'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указано</p>}

              <h4 className="text-sm font-medium mt-6 mb-3">Образовательные технологии</h4>
              {comp.ed_technologies?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {comp.ed_technologies.map((tech, idx) => (
                    <Badge key={idx} variant="success" className="text-xs">{tech}</Badge>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">Не указаны</p>}
            </TabsContent>

            {/* Вкладка Оценочные средства */}
            <TabsContent value="assessment">
              {comp.assessment_tools?.length > 0 ? (
                <ul className="space-y-4">
                  {comp.assessment_tools.map((item, idx) => (
                    <li key={idx} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={item.level === 'базовый' ? 'secondary' : item.level === 'продвинутый' ? 'warning' : 'default'} className="text-xs">
                          {item.level}
                        </Badge>
                        <span className="font-medium text-sm">{item.tool}</span>
                        {item.for_nok && <Badge variant="success" className="text-xs">НОК</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.criteria || 'Критерии не указаны'}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указаны</p>}
            </TabsContent>

            {/* Вкладка Ресурсы */}
            <TabsContent value="resources">
              <h4 className="text-sm font-medium mb-3">Материально-техническая база</h4>
              {comp.resources?.length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {comp.resources.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Не указана</p>}

              <h4 className="text-sm font-medium mt-6 mb-3">Дополнительные метаданные</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <InfoItem label="Создана" value={comp.created_at ? new Date(comp.created_at).toLocaleString() : '—'} />
                <InfoItem label="Обновлена" value={comp.updated_at ? new Date(comp.updated_at).toLocaleString() : '—'} />
                <InfoItem label="Активна" value={comp.is_active ? 'Да' : 'Нет'} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

function InfoItem({ label, value }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default CompetenceDetail;
