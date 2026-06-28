import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Spin, Button, Tabs, Collapse,
  Typography, List, Row, Col, Badge, Space, Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { getCompetence } from '../api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const CompetenceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompetence(id)
      .then(res => setComp(res.data))
      .catch(() => setComp(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!comp) return <div style={{ padding: 24 }}>Компетенция не найдена</div>;

  // Статус
  const statusMap = {
    'проект': { color: 'default', icon: <ClockCircleOutlined />, text: 'Проект' },
    'на экспертизе': { color: 'processing', icon: <ExclamationCircleOutlined />, text: 'На экспертизе' },
    'утверждена': { color: 'success', icon: <CheckCircleOutlined />, text: 'Утверждена' },
  };
  const statusInfo = statusMap[comp.status] || statusMap['проект'];

  // Дескрипторы – ожидаем структуру { "A_базовый": "...", "B_продвинутый": "...", ... }
  const descriptors = comp.descriptors || {};
  const categories = ['A', 'B', 'C'];
  const levels = ['базовый', 'продвинутый', 'экспертный'];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        Назад
      </Button>

      <Card
        title={
          <Space size="middle">
            <span style={{ fontSize: 20, fontWeight: 600 }}>{comp.name}</span>
            <Badge
              status={statusInfo.color === 'success' ? 'success' : 'processing'}
              text={statusInfo.text}
            />
          </Space>
        }
        extra={
          <Space>
            <Tag color="blue">Уровень: {comp.qualification_level || '—'}</Tag>
            <Tag color="purple">ID: {comp.id}</Tag>
          </Space>
        }
      >
        <Tabs defaultActiveKey="1">
          {/* Вкладка 1: Основная информация */}
          <TabPane tab="Основное" key="1">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Код квалификации">{comp.qualification_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Уровень квалификации">{comp.qualification_level || '—'}</Descriptions.Item>
              <Descriptions.Item label="Профстандарт ID">{comp.prof_standard_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Квалификация ID">{comp.qualification_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Разработчик">{comp.developer || '—'}</Descriptions.Item>
              <Descriptions.Item label="Валидатор">{comp.validator || '—'}</Descriptions.Item>
              <Descriptions.Item label="Отрасль">{comp.raw_data?.industry || comp.industry || '—'}</Descriptions.Item>
              <Descriptions.Item label="Трудоёмкость">{comp.raw_data?.hours || comp.hours || '—'} ч.</Descriptions.Item>
              <Descriptions.Item label="Описание" span={2}>{comp.raw_data?.description || comp.description || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Трудовые функции</Divider>
            {comp.labor_functions?.length > 0 ? (
              <List
                dataSource={comp.labor_functions}
                renderItem={item => (
                  <List.Item>
                    <Tag color="cyan">{item.code}</Tag> {item.name || item.code}
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">Не указаны</Text>}
          </TabPane>

          {/* Вкладка 2: Структура A/B/C и дескрипторы */}
          <TabPane tab="Структура A/B/C" key="2">
            <Row gutter={16}>
              {categories.map(cat => (
                <Col span={8} key={cat}>
                  <Card title={`Категория ${cat}`} size="small">
                    <List
                      dataSource={comp.structure?.[cat] || []}
                      renderItem={item => <List.Item>{item}</List.Item>}
                      locale={{ emptyText: 'Нет данных' }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider orientation="left">Дескрипторы уровней</Divider>
            <Collapse>
              {categories.map(cat => (
                <Panel header={`Категория ${cat}`} key={cat}>
                  <Descriptions column={1} bordered size="small">
                    {levels.map(level => {
                      const key = `${cat}_${level}`;
                      return (
                        <Descriptions.Item label={level.charAt(0).toUpperCase() + level.slice(1)} key={key}>
                          {descriptors[key] || '—'}
                        </Descriptions.Item>
                      );
                    })}
                  </Descriptions>
                </Panel>
              ))}
            </Collapse>
          </TabPane>

          {/* Вкладка 3: Дисциплины и технологии */}
          <TabPane tab="Дисциплины и технологии" key="3">
            <Title level={5}>Привязка к дисциплинам / модулям</Title>
            {comp.discipline_mapping?.length > 0 ? (
              <List
                dataSource={comp.discipline_mapping}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      <Tag color="geekblue">{item.component || '—'}</Tag>
                      <Text strong>{item.discipline}</Text>
                      <Tag color="orange">{item.control || '—'}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">Не указано</Text>}

            <Divider orientation="left">Образовательные технологии</Divider>
            {comp.ed_technologies?.length > 0 ? (
              <Space wrap>
                {comp.ed_technologies.map((tech, idx) => (
                  <Tag color="green" key={idx}>{tech}</Tag>
                ))}
              </Space>
            ) : <Text type="secondary">Не указаны</Text>}
          </TabPane>

          {/* Вкладка 4: Оценочные средства */}
          <TabPane tab="Оценочные средства" key="4">
            {comp.assessment_tools?.length > 0 ? (
              <List
                dataSource={comp.assessment_tools}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={item.level === 'базовый' ? 'blue' : item.level === 'продвинутый' ? 'orange' : 'red'}>
                            {item.level}
                          </Tag>
                          <Text strong>{item.tool}</Text>
                          {item.for_nok && <Tag color="magenta">НОК</Tag>}
                        </Space>
                      }
                      description={item.criteria || 'Критерии не указаны'}
                    />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">Не указаны</Text>}
          </TabPane>

          {/* Вкладка 5: Ресурсы и прочее */}
          <TabPane tab="Ресурсы" key="5">
            <Title level={5}>Материально-техническая база</Title>
            {comp.resources?.length > 0 ? (
              <List
                dataSource={comp.resources}
                renderItem={item => <List.Item><Text>{item}</Text></List.Item>}
              />
            ) : <Text type="secondary">Не указана</Text>}

            <Divider orientation="left">Дополнительные метаданные</Divider>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Создана">{comp.created_at ? new Date(comp.created_at).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Обновлена">{comp.updated_at ? new Date(comp.updated_at).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Активна">{comp.is_active ? 'Да' : 'Нет'}</Descriptions.Item>
            </Descriptions>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CompetenceDetail;