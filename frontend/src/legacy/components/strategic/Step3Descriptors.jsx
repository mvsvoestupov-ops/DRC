import React from 'react';
import { Card, Form, Input, Typography } from 'antd';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const Step3Descriptors = ({ data, updateData }) => {
  const setDescriptor = (category, level, value) => {
    const key = `${category}_${level}`;
    updateData({
      descriptors: { ...data.descriptors, [key]: value }
    });
  };

  const categories = [
    { id: 'A', name: 'Знания' },
    { id: 'B', name: 'Умения / интеллектуальные навыки' },
    { id: 'C', name: 'Практические навыки' }
  ];

  const levels = ['базовый', 'продвинутый', 'экспертный'];

  return (
    <div>
      <Title level={4}>Шаг 3. Разработка дескрипторов уровней</Title>
      <Paragraph>
        Для каждой категории (A, B, C) опишите дескрипторы для трёх уровней. Дескрипторы должны быть измеримы.
      </Paragraph>
      {categories.map(cat => (
        <Card key={cat.id} title={`Категория ${cat.id} – ${cat.name}`} style={{ marginBottom: 16 }}>
          {levels.map(level => (
            <Form.Item key={`${cat.id}_${level}`} label={`${cat.id} – ${level}`}>
              <TextArea
                rows={2}
                value={data.descriptors[`${cat.id}_${level}`] || ''}
                onChange={(e) => setDescriptor(cat.id, level, e.target.value)}
                placeholder={`Опишите ${level} уровень для категории ${cat.id} (${cat.name})`}
              />
            </Form.Item>
          ))}
        </Card>
      ))}
    </div>
  );
};

export default Step3Descriptors;
