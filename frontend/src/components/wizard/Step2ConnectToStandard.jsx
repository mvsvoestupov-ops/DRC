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
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Выберите профессиональный стандарт и трудовые функции</h3>
        <p className="text-muted-foreground text-sm">
          Компетенция будет автоматически привязана к квалификации, для которой она покрывает наибольший процент.
        </p>
      </div>
      <SelectStandardForCompetence
        onSelect={handleSelect}
        initialStandardId={data.prof_standard_id}
        initialTFCodes={data.selected_tf_codes || []}
        initialCoverage={data.coverage_data || []}
        initialLaborFunctions={data.selected_labor_functions || []}
      />
    </div>
  );
};

export default Step2ConnectToStandard;
