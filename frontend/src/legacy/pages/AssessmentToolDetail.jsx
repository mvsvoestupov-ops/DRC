import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Briefcase, FileText, ExternalLink, ClipboardList, GraduationCap } from 'lucide-react';
import { getAssessmentTool } from '@/api/compat';

const AssessmentToolDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssessmentTool(id)
      .then((res) => setTool(res.data))
      .catch(() => setTool(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!tool) return <div className="p-6">Оценочное средство не найдено</div>;

  const narkUrl = tool.source_url || `https://nok-nark.ru/os/detail/${tool.code}/`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/assessment-tools')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад к списку
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="font-bold text-2xl">{tool.name}</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {(tool.status || 'active') === 'inactive' && (
                  <Badge variant="outline" className="text-slate-600 border-slate-300">
                    неактивно (есть более новая редакция)
                  </Badge>
                )}
                {tool.document_type && (
                  <Badge variant="secondary">
                    {tool.document_type}
                    {tool.document_number ? ` № ${tool.document_number}` : ''}
                    {tool.document_date ? ` от ${tool.document_date}` : ''}
                  </Badge>
                )}
              </div>
            </div>
            <code className="text-sm bg-muted px-3 py-1 rounded shrink-0">{tool.code}</code>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem icon={<ClipboardList className="w-4 h-4" />} label="Код оценочного средства" value={tool.code} />
            <InfoItem
              icon={<GraduationCap className="w-4 h-4" />}
              label="Квалификация"
              value={
                tool.qualification ? (
                  <Link to={`/qualifications/${tool.qualification.id}`} className="text-primary hover:underline font-medium">
                    {tool.qualification.code} — {tool.qualification.name}
                  </Link>
                ) : (
                  tool.qualification_label || tool.qualification_code || 'Не связана'
                )
              }
            />
            <InfoItem icon={<Briefcase className="w-4 h-4" />} label="СПК" value={tool.spk_name || '—'} />
            <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Вид деятельности" value={tool.activity_area || '—'} />
            <InfoItem
              icon={<FileText className="w-4 h-4" />}
              label="Профессиональный стандарт"
              value={
                <>
                  {tool.prof_standard_name || '—'}
                  {tool.prof_standard_order && (
                    <div className="text-xs text-muted-foreground mt-1">{tool.prof_standard_order}</div>
                  )}
                </>
              }
            />
            <InfoItem
              icon={<ExternalLink className="w-4 h-4" />}
              label="Карточка на НАРК"
              value={
                <a href={narkUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {narkUrl}
                </a>
              }
            />
          </div>

          <Section title="Материально-техническое обеспечение экзамена">
            <p className="text-sm whitespace-pre-wrap">{tool.material_support || '—'}</p>
          </Section>
          <Section title="Кадровое обеспечение экзамена">
            <p className="text-sm whitespace-pre-wrap">{tool.staffing || '—'}</p>
          </Section>
          <Section title="Примеры заданий">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Оценочные средства: </span>
                {tool.sample_tasks_url ? (
                  <a
                    href={tool.sample_tasks_url.startsWith('http') ? tool.sample_tasks_url : `https://${tool.sample_tasks_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {tool.sample_tasks_url}
                  </a>
                ) : (
                  '—'
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">ПМК «Оценка квалификаций»: </span>
                {tool.pmk_sample_tasks_url ? (
                  <a
                    href={
                      tool.pmk_sample_tasks_url.startsWith('http')
                        ? tool.pmk_sample_tasks_url
                        : `https://${tool.pmk_sample_tasks_url}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {tool.pmk_sample_tasks_url}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </Section>
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

export default AssessmentToolDetail;
