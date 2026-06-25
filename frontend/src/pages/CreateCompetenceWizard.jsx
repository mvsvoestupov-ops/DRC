import React, { useState } from 'react';
import { Steps, Button, message, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import Step1GeneralInfo from '../components/wizard/Step1GeneralInfo';
import Step2ConnectToStandard from '../components/wizard/Step2ConnectToStandard';
import Step3StructureABC from '../components/wizard/Step3StructureABC';
import Step4AssessmentTools from '../components/wizard/Step4AssessmentTools';
import Step5Preview from '../components/wizard/Step5Preview';
import { createCompetence } from '../api';

const { Step } = Steps;

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

  const updateFormData = (data) => setFormData(prev => ({ ...prev, ...data }));
  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async (status) => {
    setLoading(true);
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
      message.success('Компетенция сохранена');
      navigate('/');
    } catch (err) {
      message.error('Ошибка: ' + err.message);
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
    <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
      <Steps current={currentStep}>
        {steps.map(item => <Step key={item.title} title={item.title} />)}
      </Steps>
      <div style={{ minHeight: 300, marginTop: 24 }}>{steps[currentStep].content}</div>
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={prevStep} disabled={currentStep === 0}>Назад</Button>
        {currentStep < steps.length - 1 && <Button type="primary" onClick={nextStep}>Далее</Button>}
      </div>
      {loading && <Spin tip="Сохранение..." />}
    </div>
  );
};

export default CreateCompetenceWizard;