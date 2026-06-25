import React from 'react';
import { Form, Input, Select, InputNumber } from 'antd';

const { TextArea } = Input;

const Step1GeneralInfo = ({ data, updateData }) => {
  const [form] = Form.useForm();

  const onValuesChange = (changedValues, allValues) => {
    updateData(allValues);
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={onValuesChange} initialValues={data}>
      <Form.Item
        name="name"
        label="Название компетенции"
        rules={[{ required: true, message: 'Введите название' }]}
      >
        <Input placeholder="Например: Способен применять..." />
      </Form.Item>
      <Form.Item
        name="description"
        label="Описание компетенции"
      >
        <TextArea rows={4} placeholder="Подробное описание компетенции..." />
      </Form.Item>
      <Form.Item
        name="industry"
        label="Отрасль"
        rules={[{ required: true, message: 'Выберите отрасль' }]}
      >
        <Select placeholder="Выберите отрасль">
          <Select.Option value="19">Добыча нефти и газа</Select.Option>
          <Select.Option value="40">Сквозные виды деятельности</Select.Option>
          <Select.Option value="01">Образование</Select.Option>
          {/* добавить другие из справочника */}
        </Select>
      </Form.Item>
      <Form.Item
        name="level"
        label="Уровень квалификации"
        rules={[{ required: true, message: 'Выберите уровень' }]}
      >
        <Select placeholder="Выберите уровень">
          {[1,2,3,4,5,6,7,8].map(l => (
            <Select.Option key={l} value={String(l)}>{l}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="hours"
        label="Рекомендуемая трудоёмкость (часы)"
      >
        <InputNumber min={0} style={{ width: '100%' }} placeholder="Например: 180" />
      </Form.Item>
    </Form>
  );
};

export default Step1GeneralInfo;// Step1GeneralInfo 
