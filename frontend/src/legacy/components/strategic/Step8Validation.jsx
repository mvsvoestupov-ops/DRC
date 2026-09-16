import React, { useState } from 'react';
import { Table, Select, Input, Typography } from 'antd';
import { EXPERTISE_CRITERIA } from '@/lib/expertiseCriteria';

const { Title, Paragraph } = Typography;

const Step8Validation = ({ data, updateData }) => {
  const criteria = EXPERTISE_CRITERIA;

  const [validation, setValidation] = useState(data.validation || {});

  const handleChange = (index, field, value) => {
    const key = `criterion_${index}`;
    const newValidation = { ...validation, [key]: { ...validation[key], [field]: value } };
    setValidation(newValidation);
    updateData({ validation: newValidation });
  };

  const columns = [
    { title: 'Критерий', dataIndex: 'text', key: 'text' },
    {
      title: 'Да / Нет',
      key: 'value',
      render: (text, record, index) => (
        <Select value={validation[`criterion_${index}`]?.value || ''} onChange={(val) => handleChange(index, 'value', val)} style={{ width: 120 }}>
          <Select.Option value="да">Да</Select.Option>
          <Select.Option value="нет">Нет</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Комментарий / Замечание',
      key: 'comment',
      render: (text, record, index) => (
        <Input value={validation[`criterion_${index}`]?.comment || ''} onChange={(e) => handleChange(index, 'comment', e.target.value)} placeholder="Комментарий" />
      ),
    },
  ];

  const dataSource = criteria.map((text, idx) => ({ key: idx, text }));

  return (
    <div>
      <Title level={4}>Шаг 8. Экспертиза и валидация</Title>
      <Paragraph>Заполните чек-лист валидатора. Для каждого критерия укажите «Да»/«Нет» и при необходимости комментарий.</Paragraph>
      <Table dataSource={dataSource} columns={columns} pagination={false} />
    </div>
  );
};

export default Step8Validation;
