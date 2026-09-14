import React from 'react';
import { Input, Typography } from 'antd';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const Step9Revision = ({ data, updateData }) => {
  const handleChange = (e) => {
    updateData({ revision_notes: e.target.value });
  };

  return (
    <div>
      <Title level={4}>Шаг 9. Доработка по замечаниям</Title>
      <Paragraph>Внесите исправления на основе замечаний валидатора. Опишите внесённые изменения.</Paragraph>
      <TextArea rows={6} value={data.revision_notes || ''} onChange={handleChange} placeholder="Описание доработок..." />
    </div>
  );
};

export default Step9Revision;
