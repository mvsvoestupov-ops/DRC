import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Steps, Step } from '@/components/ui/steps';
import Step1GeneralInfo from '@/app/components/wizard/Step1GeneralInfo';
import { apiClient } from '@/api/client';

// Временные заглушки для остальных шагов визарда
const Step2ConnectToStandard = ({ data, updateData }: any) => (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Связь с профстандартами</h3>
    <p className="text-muted-foreground text-sm">Выберите профстандарт и трудовые функции</p>
    <p className="text-sm text-muted-foreground">Компонент в разработке</p>
  </div>
);

const Step3StructureABC = ({ data, updateData }: any) => (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Структура A/B/C</h3>
    <p className="text-muted-foreground text-sm">Определите категории A, B, C</p>
    <p className="text-sm text-muted-foreground">Компонент в разработке</p>
  </div>
);

const Step4AssessmentTools = ({ data, updateData }: any) => (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Оценочные средства</h3>
    <p className="text-muted-foreground text-sm">Добавьте инструменты оценки</p>
    <p className="text-sm text-muted-foreground">Компонент в разработке</p>
  </div>
);

const Step5Preview = ({ data, onSubmit, loading }: any) => (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Предпросмотр</h3>
    <p className="text-muted-foreground text-sm">Проверьте данные перед сохранением</p>
    <div className="bg-muted p-4 rounded-lg">
      <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
    <div className="flex gap-3">
      <Button onClick={() => onSubmit('проект')} disabled={loading}>
        Сохранить как проект
      </Button>
      <Button variant="outline" onClick={() => onSubmit('на экспертизе')} disabled={loading}>
        Отправить на экспертизу
      </Button>
    </div>
  </div>
);

export function CreateCompetenceWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    level: '',
    hours: '',
    prof_standard_id: null as number | null,
    selected_tf_codes: [] as string[],
    qualification_id: null as number | null,
    coverage_data: [] as any[],
    structure: { A: [], B: [], C: [] } as any,
    assessment_tools: [] as any[],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const updateFormData = (data: any) => setFormData(prev => ({ ...prev, ...data }));
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleSubmit = async (status: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await apiClient.createCompetence({
        name: formData.name,
        qualification_name: formData.name,
        qualification_level: formData.level,
        prof_standard_id: formData.prof_standard_id || undefined,
        qualification_id: formData.qualification_id || undefined,
        labor_functions: formData.selected_tf_codes.map(code => ({ code })),
        structure: formData.structure,
        assessment_tools: formData.assessment_tools,
        status,
        developer: 'Организация',
        description: formData.description,
        industry: formData.industry,
        hours: formData.hours,
      });
      setMessage({ type: 'success', text: 'Компетенция сохранена' });
      setTimeout(() => navigate('/my-projects'), 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Ошибка: ' + (err.message || '') });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Общая информация', content: <Step1GeneralInfo data={formData} updateData={updateFormData} /> },
    { title: 'Связь с ПС', content: <Step2ConnectToStandard data={formData} updateData={updateFormData} /> },
    { title: 'Структура A/B/C', content: <Step3StructureABC data={formData} updateData={updateFormData} /> },
    { title: 'Оценочные средства', content: <Step4AssessmentTools data={formData} updateData={updateFormData} /> },
    { title: 'Предпросмотр', content: <Step5Preview data={formData} onSubmit={handleSubmit} loading={loading} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium">Создание компетенции</h2>
        <p className="text-muted-foreground text-sm">Пошаговый мастер для создания новой компетенции</p>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      <Steps className="gap-2">
        {steps.map((step, idx) => (
          <Step
            key={step.title}
            title={step.title}
            number={idx + 1}
            isActive={currentStep === idx}
            isCompleted={currentStep > idx}
          />
        ))}
      </Steps>

      <Card>
        <CardContent className="p-6">
          {steps[currentStep].content}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>
          Назад
        </Button>
        {currentStep < steps.length - 1 && (
          <Button onClick={nextStep}>
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}
