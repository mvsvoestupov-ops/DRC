import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/Accordion';
import { ArrowLeft, Briefcase, FileText, Shield, Clock, BookOpen } from 'lucide-react';
import { getQualification } from '../api';

const QualificationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qual, setQual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQualification(id)
      .then(res => setQual(res.data))
      .catch(() => setQual(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  if (!qual) return <div className="p-6">Квалификация не найдена</div>;

  const laborFunctions = qual.labor_functions || [];
  const possibleJobTitles = qual.possible_job_titles || [];
  const specialAdmission = qual.special_admission || [];
  const examDocuments = qual.exam_documents || [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/qualifications')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад к списку
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{qual.name}</CardTitle>
              {qual.level && <Badge className="mt-2" variant="secondary">{qual.level}</Badge>}
            </div>
            <code className="text-sm bg-muted px-3 py-1 rounded">{qual.code}</code>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Описание */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem icon={<BookOpen className="w-4 h-4" />} label="Код квалификации" value={qual.code} />
            <InfoItem icon={<Shield className="w-4 h-4" />} label="Уровень квалификации" value={qual.level} />
            <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Вид деятельности" value={qual.activity_area || '—'} />
            <InfoItem
              icon={<FileText className="w-4 h-4" />}
              label="Наименование ПС"
              value={
                <>
                  {qual.prof_standard_name || 'Нет связанного ПС'}
                  {qual.prof_standard_order && (
                    <div className="text-xs text-muted-foreground mt-1">{qual.prof_standard_order}</div>
                  )}
                </>
              }
            />
            <InfoItem icon={<FileText className="w-4 h-4" />} label="Квалификационное требование" value={qual.qualification_requirement || '—'} />
            <InfoItem icon={<Clock className="w-4 h-4" />} label="Срок действия свидетельства" value={qual.certificate_validity || '—'} />
          </div>

          {/* Возможные должности */}
          <Section title="Возможные должности">
            {possibleJobTitles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {possibleJobTitles.map((title, idx) => (
                  <Badge key={idx} variant="outline">{title}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </Section>

          {/* Особые условия допуска */}
          <Section title="Особые условия допуска">
            {specialAdmission.length > 0 ? (
              <ul className="list-decimal list-inside text-sm space-y-1">
                {specialAdmission.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </Section>

          {/* Перечень документов */}
          <Section title="Перечень документов для экзамена">
            {examDocuments.length > 0 ? (
              <ul className="list-decimal list-inside text-sm space-y-1">
                {examDocuments.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </Section>

          {/* Трудовые функции */}
          {laborFunctions.length > 0 && (
            <Section title="Трудовые функции">
              <Accordion type="single" collapsible className="w-full">
                {laborFunctions.map((tf, idx) => (
                  <AccordionItem key={idx} value={`tf-${idx}`}>
                    <AccordionTrigger>
                      <span className="text-left">{tf.code} – {tf.name}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Номер:</strong> {tf.number}</div>
                        <div><strong>Код:</strong> {tf.code}</div>
                        <div><strong>Наименование:</strong> {tf.name}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>
          )}

          {/* Дополнительные сведения */}
          {qual.raw_data && Object.keys(qual.raw_data).length > 0 && (
            <Section title="Дополнительные сведения">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {qual.raw_data.description && (
                  <div>
                    <span className="text-xs text-muted-foreground">Описание</span>
                    <p className="text-sm">{qual.raw_data.description}</p>
                  </div>
                )}
                {qual.raw_data.industry && (
                  <div>
                    <span className="text-xs text-muted-foreground">Отрасль</span>
                    <p className="text-sm">{qual.raw_data.industry}</p>
                  </div>
                )}
                {qual.raw_data.hours && (
                  <div>
                    <span className="text-xs text-muted-foreground">Трудоёмкость</span>
                    <p className="text-sm">{qual.raw_data.hours} ч.</p>
                  </div>
                )}
              </div>
            </Section>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-muted rounded-lg shrink-0">{icon}</div>
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-3">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

export default QualificationDetail;
