import React from 'react';
import { Card, Button, Typography, Descriptions, message } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Step10Preview = ({ data, onFinish, loading }) => {
  const {
    qualification_name,
    qualification_level,
    prof_standard_id,
    selected_tf_codes,
    structure,
    descriptors,
    discipline_mapping,
    assessment_tools,
    resources,
    revision_notes,
    coverage_data
  } = data;

  const coveragePercent = coverage_data && coverage_data.length > 0 ? coverage_data[0]?.coverage_percent : 0;
  const edTechnologies = data.ed_technologies || [];
  const developer = '';
  const validator = '';
  const status = 'проект';

  const formatAssessment = () => {
    if (!assessment_tools || Object.keys(assessment_tools).length === 0) return 'Не разработаны';
    const parts = [];
    Object.entries(assessment_tools).forEach(([levelKey, levelData]) => {
      const levelName = { basic: 'Базовый', advanced: 'Продвинутый', expert: 'Экспертный' }[levelKey];
      const testCount = levelData.tests?.filter(t => t.selected && t.question).length || 0;
      const practicalCount = levelData.practical?.length || 0;
      const nok = levelData.nok ? ' (НОК)' : '';
      parts.push(`${levelName}: тестов ${testCount}, практических ${practicalCount}${nok}`);
    });
    return parts.join('; ');
  };

  const formatStructure = () => {
    if (!structure) return '—';
    const parts = [];
    if (structure.A?.length) parts.push(`A: ${structure.A.map(i => i.text).join(', ')}`);
    if (structure.B?.length) parts.push(`B: ${structure.B.map(i => i.text).join(', ')}`);
    if (structure.C?.length) parts.push(`C: ${structure.C.map(i => i.text).join(', ')}`);
    return parts.join('; ') || '—';
  };

  const formatDescriptors = () => {
    if (!descriptors || Object.keys(descriptors).length === 0) return '—';
    const levels = ['базовый', 'продвинутый', 'экспертный'];
    const cats = ['A', 'B', 'C'];
    const parts = [];
    cats.forEach(cat => {
      const sub = levels.map(level => descriptors[`${cat}_${level}`] ? `${level}: ${descriptors[`${cat}_${level}`]}` : null).filter(Boolean);
      if (sub.length) parts.push(`${cat}: ${sub.join('; ')}`);
    });
    return parts.join('; ') || '—';
  };

  const formatDisciplines = () => {
    if (!discipline_mapping?.length) return '—';
    return discipline_mapping.map(d => `${d.text} → ${d.discipline} (${d.hours || '?'} ч, ${d.control || '—'})`).join('; ');
  };

  const formatResources = () => (!resources?.length ? '—' : resources.join('; '));
  const formatTF = () => (!selected_tf_codes?.length ? '—' : selected_tf_codes.join(', '));
  const psName = 'Профессиональный стандарт (ID: ' + (prof_standard_id || '—') + ')';

  return (
    <div>
      <Title level={4}>Шаг 10. Подготовка к защите</Title>
      <Paragraph>Проверьте итоговые данные компетенции перед сохранением. Ниже приведён паспорт компетенции в соответствии с картой фасилитатора.</Paragraph>
      <Card title="Паспорт компетенции" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Название компетенции">{data.competence_name || data.qualification_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Профессиональный стандарт (код, название)">{psName}</Descriptions.Item>
          <Descriptions.Item label="Название квалификации">{qualification_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Процент сформированности">{coveragePercent ? `${coveragePercent}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Уровень квалификации">{qualification_level || '—'}</Descriptions.Item>
          <Descriptions.Item label="Трудовые функции (коды)">{formatTF()}</Descriptions.Item>
          <Descriptions.Item label="Структура A/B/C">{formatStructure()}</Descriptions.Item>
          <Descriptions.Item label="Уровни с дескрипторами">{formatDescriptors()}</Descriptions.Item>
          <Descriptions.Item label="Привязка к дисциплинам/модулям">{formatDisciplines()}</Descriptions.Item>
          <Descriptions.Item label="Образовательные технологии">{edTechnologies.length ? edTechnologies.join(', ') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Оценочные средства (с отметкой НОК)">{formatAssessment()}</Descriptions.Item>
          <Descriptions.Item label="Материально-техническая база">{formatResources()}</Descriptions.Item>
          <Descriptions.Item label="Разработчик (ОО)">{developer || '—'}</Descriptions.Item>
          <Descriptions.Item label="Валидатор (СПК/работодатель)">{validator || '—'}</Descriptions.Item>
          <Descriptions.Item label="Статус">{status}</Descriptions.Item>
        </Descriptions>
      </Card>
      {revision_notes && (
        <Card title="Замечания валидатора" style={{ marginBottom: 16 }}>
          <Paragraph>{revision_notes}</Paragraph>
        </Card>
      )}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button type="primary" size="large" icon={<FilePdfOutlined />} onClick={() => message.info('Функция генерации паспорта будет добавлена позже')}>
          Сформировать паспорт (PDF)
        </Button>
        <Button type="primary" size="large" onClick={onFinish} loading={loading}>
          Завершить сессию и сохранить компетенцию
        </Button>
      </div>
    </div>
  );
};

export default Step10Preview;
