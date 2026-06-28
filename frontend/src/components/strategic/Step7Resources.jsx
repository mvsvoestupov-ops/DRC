import React, { useState } from 'react';
import { Input, Button, Space, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const Step7Resources = ({ data, updateData }) => {
  const [resources, setResources] = useState(data.resources || []);

  const addResource = () => {
    const newResources = [...resources, ''];
    setResources(newResources);
    updateData({ resources: newResources });
  };

  const updateResource = (index, value) => {
    const newResources = resources.map((item, i) => i === index ? value : item);
    setResources(newResources);
    updateData({ resources: newResources });
  };

  const removeResource = (index) => {
    const newResources = resources.filter((_, i) => i !== index);
    setResources(newResources);
    updateData({ resources: newResources });
  };

  return (
    <div>
      <Title level={4}>Шаг 7. Определение материально-технической базы</Title>
      <Paragraph>Опишите необходимые ресурсы (оборудование, ПО, учебные материалы, помещения). Минимум 3 позиции.</Paragraph>
      {resources.map((item, idx) => (
        <Space key={idx} style={{ display: 'flex', marginBottom: 8 }}>
          <Input value={item} onChange={(e) => updateResource(idx, e.target.value)} placeholder="Ресурс..." style={{ width: 400 }} />
          <Button type="link" danger onClick={() => removeResource(idx)}>Удалить</Button>
        </Space>
      ))}
      <Button type="dashed" onClick={addResource}>Добавить ресурс</Button>
    </div>
  );
};

export default Step7Resources;
