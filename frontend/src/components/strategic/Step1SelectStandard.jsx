import React from 'react';
import { Typography, message } from 'antd';
import SelectStandardForCompetence from '../SelectStandardForCompetence';

const { Title, Paragraph } = Typography;

const Step1SelectStandard = ({ data, updateData, goToNext }) => {
  const handleSelect = (selection) => {
    console.log('Выбранные данные:', selection);
    
    // Вычисляем максимальный уровень квалификации из выбранных ТФ
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
      qualification_level: levelStr, // теперь не пустая строка
      selected_labor_functions: selection.selectedLaborFunctions || [],
    });
    message.success('Данные сохранены. Нажмите "Далее" для продолжения.');
  };

  return (
    <div>
      <Title level={4}>Шаг 1. Подбор профессионального стандарта и определение квалификации</Title>
      <Paragraph>
        Выберите профессиональный стандарт, трудовые функции и квалификацию. Квалификация будет предложена автоматически на основе покрытия.
      </Paragraph>
      <SelectStandardForCompetence onSelect={handleSelect} />
    </div>
  );
};

export default Step1SelectStandard;