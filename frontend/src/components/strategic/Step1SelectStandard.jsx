import React from 'react';
import { Typography, message, Input, Form, Button } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import SelectStandardForCompetence from '../SelectStandardForCompetence';

const { Title, Paragraph } = Typography;

const Step1SelectStandard = ({ data, updateData, goToNext }) => {
  const handleSelect = (selection) => {
    console.log('Выбранные данные:', selection);
    
    const selectedLaborFunctions = selection.selectedLaborFunctions || [];
    let maxLevel = 0;
    selectedLaborFunctions.forEach(tf => {
      const level = parseInt(tf.level, 10);
      if (!isNaN(level) && level > maxLevel) maxLevel = level;
    });
    const levelStr = maxLevel > 0 ? String(maxLevel) : '';

    updateData({
      prof_standard_id: selection.standard.id,
      selected_tf_codes: selection.selectedTFCodes,
      qualification_id: selection.selectedQualification,
      coverage_data: selection.coverageData,
      qualification_name: selection.standard.name,
      qualification_level: levelStr,
      selected_labor_functions: selection.selectedLaborFunctions || [],
    });
    message.success('Данные сохранены.');
  };

  const handleNameChange = (e) => {
    updateData({ competence_name: e.target.value });
  };

  // Кнопка «Далее» активна только если выбрано название и есть подтверждённый выбор ПС (prof_standard_id)
  const isNextDisabled = !data.competence_name || !data.prof_standard_id || !data.selected_tf_codes?.length;

  return (
    <div>
      <Title level={4}>Шаг 1. Подбор профессионального стандарта и определение квалификации</Title>
      <Paragraph>
        Выберите профессиональный стандарт, трудовые функции и квалификацию. Квалификация будет предложена автоматически на основе покрытия.
      </Paragraph>

      <Form.Item
        label="Название компетенции"
        required
        style={{ maxWidth: 600 }}
        tooltip="Введите название, которое будет отображаться в паспорте компетенции"
      >
        <Input
          placeholder="Например: Специалист по информационной безопасности"
          value={data.competence_name || ''}
          onChange={handleNameChange}
          size="large"
          prefix={<SafetyOutlined />}
        />
      </Form.Item>

      <SelectStandardForCompetence
        onSelect={handleSelect}
        initialStandardId={data.prof_standard_id}
        initialTFCodes={data.selected_tf_codes || []}
        initialCoverage={data.coverage_data || []}
        initialLaborFunctions={data.selected_labor_functions || []}
      />

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button
          type="primary"
          size="large"
          onClick={goToNext}
          disabled={isNextDisabled}
        >
          Далее {data.selected_tf_codes?.length > 0 ? `(выбрано ${data.selected_tf_codes.length} ТФ)` : ''}
        </Button>
      </div>
    </div>
  );
};

export default Step1SelectStandard;