import React, { useState } from 'react';
import { Checkbox, Form, Input, Typography } from 'antd';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const Step5EdTech = ({ data, updateData }) => {
  const options = [
    'Проблемное обучение',
    'Кейс-метод (анализ конкретных ситуаций)',
    'Деловая / ролевая игра',
    'Проектная деятельность',
    'Работа в малых группах',
    'Тренинги / симуляции',
    'Мастер-классы практиков',
    'Электронное обучение (LMS, онлайн-курсы)',
  ];

  const [selected, setSelected] = useState(data.ed_technologies || []);
  const [justification, setJustification] = useState(data.ed_technologies_justification || '');

  const handleChange = (checkedValues) => {
    setSelected(checkedValues);
    updateData({ ed_technologies: checkedValues });
  };

  const handleJustification = (e) => {
    setJustification(e.target.value);
    updateData({ ed_technologies_justification: e.target.value });
  };

  return (
    <div>
      <Title level={4}>Шаг 5. Подбор образовательных технологий</Title>
      <Paragraph>Выберите 2–3 технологии и кратко обоснуйте выбор.</Paragraph>
      <Checkbox.Group options={options} value={selected} onChange={handleChange} style={{ display: 'flex', flexDirection: 'column' }} />
      <Form.Item label="Обоснование выбора" style={{ marginTop: 16 }}>
        <TextArea rows={3} value={justification} onChange={handleJustification} placeholder="Обоснуйте, почему выбраны именно эти технологии..." />
      </Form.Item>
    </div>
  );
};

export default Step5EdTech;
