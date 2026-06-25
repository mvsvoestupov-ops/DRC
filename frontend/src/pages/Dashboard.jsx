import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, List, Tag, Space, Typography } from 'antd';
import { SearchOutlined, PlusOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getCompetences, getCompetenceStats } from '../api';

const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [competences, setCompetences] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    review: 0,
    archived: 0,
  });

  useEffect(() => {
    // Загрузка статистики (пока мок)
    getCompetenceStats().then(res => setStats(res.data)).catch(() => {
      setStats({ total: 1240, active: 982, review: 34, archived: 224 });
    });
    getCompetences().then(res => setCompetences(res.data.slice(0, 3))).catch(() => {
      setCompetences([
        { id: 1, code: 'RUS-PK-05-v1', name: 'Способен применять нормативные правовые акты...', status: 'утверждена', qualification_name: 'Организация' },
        { id: 2, code: 'RUS-OK-01-v2', name: 'Способен анализировать сомнительные операции...', status: 'утверждена', qualification_name: 'Финансы' },
        { id: 3, code: 'RUS-DIG-01-v1', name: 'Способен применять методы анализа больших данных...', status: 'на экспертизе', qualification_name: 'Финансы' },
      ]);
    });
  }, []);

  // ... (функции getStatusColor, getStatusText – без изменений)

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>Национальный реестр компетенций</Title>
      <Text type="secondary">
        Единая система управления компетенциями для гармонизации образовательных программ, профессиональных стандартов и требований работодателей
      </Text>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card hoverable style={{ background: '#e6f7ff', border: 'none' }} onClick={() => navigate('/standards')}>
            <Space direction="vertical" size={8}>
              <ApartmentOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <Text strong>Парсинг профстандартов</Text>
              <Text type="secondary">Загрузка и обогащение профессиональных стандартов</Text>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ background: '#f6ffed', border: 'none' }} onClick={() => navigate('/create-competence')}>
            <Space direction="vertical" size={8}>
              <PlusOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <Text strong>Предложить компетенцию</Text>
              <Text type="secondary">Создать новую компетенцию на основе профессионального стандарта</Text>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ background: '#fff7e6', border: 'none' }} onClick={() => navigate('/competences')}>
            <Space direction="vertical" size={8}>
              <SearchOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
              <Text strong>Поиск компетенций</Text>
              <Text type="secondary">Найти компетенции по ключевым словам или коду</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Блок статистики и список компетенций (как было) */}
      {/* ... */}
    </div>
  );
};

export default Dashboard;