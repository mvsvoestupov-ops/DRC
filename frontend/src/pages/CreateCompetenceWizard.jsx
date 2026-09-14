import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Step } from '../components/ui/Steps';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Step1GeneralInfo from '../components/wizard/Step1GeneralInfo';
import Step2ConnectToStandard from '../components/wizard/Step2ConnectToStandard';
import Step3StructureABC from '../components/wizard/Step3StructureABC';
import Step4AssessmentTools from '../components/wizard/Step4AssessmentTools';
import Step5Preview from '../components/wizard/Step5Preview';
import { createCompetence } from '../api';

const CreateCompetenceWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '', description: '', industry: '', level: '', hours: '',
    prof_standard_id: null, selected_tf_codes: [], qualification_id: null, coverage_data: [],
    structure: { A: [], B: [], C: [] },
    assessment_tools: [],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const updateFormData = (data) => setFormData(prev => ({ ...prev, ...data }));
  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async (status) => {
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        name: formData.name,
        qualification_name: formData.name,
        qualification_level: formData.level,
        prof_standard_id: formData.prof_standard_id,
        qualification_id: formData.qualification_id,
        labor_functions: formData.selected_tf_codes.map(code => ({ code })),
        structure: formData.structure,
        assessment_tools: formData.assessment_tools,
        status,
        developer: 'Организация',
        description: formData.description,
        industry: formData.industry,
        hours: formData.hours,
      };
      await createCompetence(payload);
      setMessage({ type: 'success', text: 'Компетенция сохранена' });
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка: ' + (err.message || '') });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Общая информация', content: <Step1GeneralInfo data={formData} updateData={updateFormData} /> },
    { title: 'Связь с профстандартами', content: <Step2ConnectToStandard data={formData} updateData={updateFormData} /> },
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
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      <Steps current={currentStep}>
        {steps.map(item => <Step key={item.title} title={item.title} />)}
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
};

export default CreateCompetenceWizard;
