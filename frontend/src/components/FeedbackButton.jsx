import React, { useState } from 'react';
import { Button, Modal, Select, Input, message } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const { TextArea } = Input;
const { Option } = Select;

const FeedbackButton = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Показываем кнопку только на странице стратегической сессии
  if (!location.pathname.includes('/strategic-session')) {
    return null;
  }

  const handleSubmit = async () => {
    if (!text.trim()) {
      message.warning('Введите текст предложения');
      return;
    }
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/feedback', {
        section: `step-${step}`,
        text,
      });
      message.success('Спасибо за ваше предложение!');
      setVisible(false);
      setText('');
    } catch (error) {
      message.error('Ошибка отправки. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        icon={<BulbOutlined />}
        size="large"
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}
      />
      <Modal
        title="Предложить идею по шагу стратегической сессии"
        open={visible}
        onCancel={() => setVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setVisible(false)}>Отмена</Button>,
          <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
            Отправить
          </Button>,
        ]}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <label>Шаг (1–10):</label>
          <Select value={step} onChange={setStep} style={{ width: '100%', marginTop: 4 }}>
            {[...Array(10).keys()].map((i) => (
              <Option key={i + 1} value={i + 1}>Шаг {i + 1}</Option>
            ))}
          </Select>
        </div>
        <div>
          <label>Ваше предложение по улучшению шага:</label>
          <TextArea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите, что можно улучшить или добавить в этом шаге..."
            style={{ marginTop: 4 }}
          />
        </div>
      </Modal>
    </>
  );
};

export default FeedbackButton;