// Step2ConnectToStandard 
import React from 'react';
import SelectStandardForCompetence from '../SelectStandardForCompetence';

const Step2ConnectToStandard = ({ data, updateData }) => {
  const handleSelect = (selection) => {
    updateData({
      prof_standard_id: selection.standard.id,
      selected_tf_codes: selection.selectedTFCodes,
      qualification_id: selection.selectedQualification,
      coverage_data: selection.coverageData,
    });
  };

  return (
    <div>
      <h3>Выберите профессиональный стандарт и трудовые функции</h3>
      <p>Компетенция будет автоматически привязана к квалификации, для которой она покрывает наибольший процент.</p>
      <SelectStandardForCompetence onSelect={handleSelect} />
    </div>
  );
};

export default Step2ConnectToStandard;