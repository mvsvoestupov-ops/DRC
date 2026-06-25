// Step4AssessmentTools 
import React, { useState } from 'react';
import { Table, Input, Select, Button, Checkbox, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;

const Step4AssessmentTools = ({ data, updateData }) => {
  const [tools, setTools] = useState(data.assessment_tools || []);

  const addRow = () => {
    const newTools = [...tools, { level: 'базовый', tool: '', criteria: '', for_nok: false }];
    setTools(newTools);
    updateData({ assessment_tools: newTools });
  };

  const updateRow = (index, field, value) => {
    const newTools = tools.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setTools(newTools);
    updateData({ assessment_tools: newTools });
  };

  const deleteRow = (index) => {
    const newTools = tools.filter((_, i) => i !== index);
    setTools(newTools);
    updateData({ assessment_tools: newTools });
  };

  const columns = [
    {
      title: 'Уровень',
      dataIndex: 'level',
      key: 'level',
      render: (text, record, index) => (
        <Select
          value={text}
          onChange={(val) => updateRow(index, 'level', val)}
          style={{ width: 120 }}
        >
          <Option value="базовый">Базовый</Option>
          <Option value="продвинутый">Продвинутый</Option>
          <Option value="экспертный">Экспертный</Option>
        </Select>
      ),
    },
    {
      title: 'Оценочное средство',
      dataIndex: 'tool',
      key: 'tool',
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => updateRow(index, 'tool', e.target.value)}
          placeholder="Кейс, тест, практическое задание..."
        />
      ),
    },
    {
      title: 'Критерии оценки',
      dataIndex: 'criteria',
      key: 'criteria',
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => updateRow(index, 'criteria', e.target.value)}
          placeholder="Критерии..."
        />
      ),
    },
    {
      title: 'Пригодно для НОК',
      dataIndex: 'for_nok',
      key: 'for_nok',
      render: (text, record, index) => (
        <Checkbox
          checked={text}
          onChange={(e) => updateRow(index, 'for_nok', e.target.checked)}
        />
      ),
    },
    {
      title: 'Действие',
      key: 'action',
      render: (text, record, index) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => deleteRow(index)}
        />
      ),
    },
  ];

  return (
    <div>
      <h3>Разработайте оценочные средства для каждого уровня</h3>
      <Table
        dataSource={tools}
        columns={columns}
        pagination={false}
        rowKey={(record, index) => index}
        footer={() => (
          <Button type="dashed" onClick={addRow} icon={<PlusOutlined />} block>
            Добавить оценочное средство
          </Button>
        )}
      />
    </div>
  );
};

export default Step4AssessmentTools;