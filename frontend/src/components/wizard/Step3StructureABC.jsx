// Step3StructureABC 
import React, { useState } from 'react';
import { Row, Col, Card, Input, Button, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const StructureItem = ({ category, items, onChange }) => {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      onChange(category, [...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(category, newItems);
  };

  return (
    <Card title={category} style={{ height: '100%' }}>
      <div style={{ marginBottom: 8 }}>
        {items.map((item, idx) => (
          <Tag closable onClose={() => removeItem(idx)} key={idx} style={{ marginBottom: 4 }}>
            {item}
          </Tag>
        ))}
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Добавить пункт..."
          onPressEnter={addItem}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={addItem} />
      </Space.Compact>
    </Card>
  );
};

const Step2StructureABC = ({ data, updateData }) => {
  const handleChange = (category, items) => {
    updateData({
      structure: { ...data.structure, [category]: items }
    });
  };

  return (
    <div>
      <h3>Распределите знания, умения и навыки по трём категориям</h3>
      <Row gutter={16}>
        <Col span={8}>
          <StructureItem
            category="A – Знания"
            items={data.structure.A || []}
            onChange={handleChange}
          />
        </Col>
        <Col span={8}>
          <StructureItem
            category="B – Умения / интеллектуальные навыки"
            items={data.structure.B || []}
            onChange={handleChange}
          />
        </Col>
        <Col span={8}>
          <StructureItem
            category="C – Практические навыки"
            items={data.structure.C || []}
            onChange={handleChange}
          />
        </Col>
      </Row>
    </div>
  );
};

export default Step2StructureABC;