import React, { useState } from 'react';
import { Steps, Button, Typography, message, ConfigProvider } from 'antd';
import { useNavigate } from 'react-router';
import { createCompetence } from '@/api/compat';
import Step1SelectStandard from '@/legacy/components/strategic/Step1SelectStandard';
import Step2StructureABC from '@/legacy/components/strategic/Step2StructureABC';
import Step3Descriptors from '@/legacy/components/strategic/Step3Descriptors';
import Step4DisciplineMapping from '@/legacy/components/strategic/Step4DisciplineMapping';
import Step5EdTech from '@/legacy/components/strategic/Step5EdTech';
import Step6AssessmentTools from '@/legacy/components/strategic/Step6AssessmentTools';
import Step7Resources from '@/legacy/components/strategic/Step7Resources';
import Step8Validation from '@/legacy/components/strategic/Step8Validation';
import Step9Revision from '@/legacy/components/strategic/Step9Revision';
import Step10Preview from '@/legacy/components/strategic/Step10Preview';

const { Step } = Steps;
const { Title } = Typography;

const StrategicSession = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionData, setSessionData] = useState({
    prof_standard_id: null,
    selected_tf_codes: [],
    qualification_id: null,
    coverage_data: [],
    structure: { A: [], B: [], C: [] },
    descriptors: {},
    discipline_mapping: [],
    ed_technologies: [],
    ed_technologies_justification: '',
    assessment_tools: {},
    resources: [],
    validation: {},
    revision_notes: '',
    qualification_name: '',
    qualification_level: '',
    selected_labor_functions: [],
    competence_name: '',
    testThreshold: 70,
  });
  const [loading, setLoading] = useState(false);

  const updateSessionData = (newData) => {
    setSessionData(prev => ({ ...prev, ...newData }));
  };

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const toolsArray = [];
      const levels = ['basic', 'advanced', 'expert'];
      const levelNames = { basic: 'Базовый', advanced: 'Продвинутый', expert: 'Экспертный' };

      if (sessionData.assessment_tools) {
        levels.forEach(levelKey => {
          const levelData = sessionData.assessment_tools[levelKey];
          if (levelData) {
            (levelData.tests || []).forEach(test => {
              if (test.selected && test.question) {
                toolsArray.push({
                  level: levelNames[levelKey],
                  type: 'test',
                  componentId: test.knowledgeId,
                  componentText: test.text,
                  taskType: test.type,
                  taskText: test.question,
                  options: test.options || [],
                  threshold: sessionData.testThreshold || 70,
                  for_nok: levelData.nok || false,
                });
              }
            });
            (levelData.practical || []).forEach(practical => {
              toolsArray.push({
                level: levelNames[levelKey],
                type: 'practical',
                componentIds: practical.componentIds,
                componentTexts: practical.componentTexts,
                taskText: practical.taskText,
                criteria: practical.criteria,
                for_nok: levelData.nok || false,
              });
            });
          }
        });
      }

      const structureToStrings = (items) => {
        if (!items || !Array.isArray(items)) return [];
        return items.map(item => typeof item === 'string' ? item : item.text || item);
      };

      const payload = {
        name: sessionData.competence_name || sessionData.qualification_name || 'Компетенция (стратегическая сессия)',
        qualification_name: sessionData.qualification_name || '',
        qualification_level: sessionData.qualification_level || '',
        prof_standard_id: sessionData.prof_standard_id || 0,
        qualification_id: sessionData.qualification_id || null,
        labor_functions: (sessionData.selected_tf_codes || []).map(code => ({ code })),
        structure: {
          A: structureToStrings(sessionData.structure?.A),
          B: structureToStrings(sessionData.structure?.B),
          C: structureToStrings(sessionData.structure?.C),
        },
        descriptors: sessionData.descriptors || {},
        discipline_mapping: sessionData.discipline_mapping || [],
        ed_technologies: sessionData.ed_technologies || [],
        assessment_tools: toolsArray,
        resources: sessionData.resources || [],
        developer: '',
        validator: '',
        status: 'проект',
        description: '',
        industry: '',
        hours: '',
      };

      await createCompetence(payload);
      message.success('Компетенция сохранена');
      navigate('/my-projects');
    } catch (error) {
      console.error('Error saving competence:', error);
      let errorMsg = 'Ошибка сохранения. ';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          const messages = detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'unknown';
            return `${field}: ${err.msg}`;
          });
          errorMsg += messages.join('; ');
        } else {
          errorMsg += detail;
        }
      } else if (error.message) {
        errorMsg += error.message;
      }
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const stepComponents = [
    <Step1SelectStandard key={0} data={sessionData} updateData={updateSessionData} goToNext={nextStep} />,
    <Step2StructureABC key={1} data={sessionData} updateData={updateSessionData} />,
    <Step3Descriptors key={2} data={sessionData} updateData={updateSessionData} />,
    <Step4DisciplineMapping key={3} data={sessionData} updateData={updateSessionData} />,
    <Step5EdTech key={4} data={sessionData} updateData={updateSessionData} />,
    <Step6AssessmentTools key={5} data={sessionData} updateData={updateSessionData} />,
    <Step7Resources key={6} data={sessionData} updateData={updateSessionData} />,
    <Step8Validation key={7} data={sessionData} updateData={updateSessionData} />,
    <Step9Revision key={8} data={sessionData} updateData={updateSessionData} />,
    <Step10Preview key={9} data={sessionData} onFinish={handleFinish} loading={loading} />,
  ];

  const stepTitles = [
    '1. ПС и квалиф.',
    '2. A/B/C',
    '3. Дескрипторы',
    '4. Дисциплины',
    '5. Технологии',
    '6. Оценочные средства',
    '7. Материально-техн.',
    '8. Валидация',
    '9. Доработка',
    '10. Защита'
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1E40AF',
          fontFamily: 'Manrope, sans-serif',
          borderRadius: 12,
        },
      }}
    >
      <div className="page-shell">
        <Title level={2} className="!text-3xl !font-bold !text-gray-900 !tracking-tight !mb-6">
          Стратегическая сессия: разработка компетенции
        </Title>
        <div className="surface-padded">
          <Steps current={currentStep} style={{ marginBottom: 24 }}>
            {stepTitles.map((title, idx) => (
              <Step key={idx} title={title} />
            ))}
          </Steps>
          <div style={{ minHeight: 400 }}>
            {stepComponents[currentStep]}
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={prevStep} disabled={currentStep === 0}>Назад</Button>
            <div>
              {currentStep < 9 && currentStep !== 0 && (
                <Button type="primary" onClick={nextStep}>
                  Далее
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default StrategicSession;
