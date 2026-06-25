import React from 'react';
import { Card, Descriptions, Tag, Space, Button, Row, Col } from 'antd';

const Step5Preview = ({ data, onSubmit, loading }) => {
  return (
    <div>
      <h3>Проверьте данные перед сохранением</h3>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Общая информация">
            <Descriptions column={1}>
              <Descriptions.Item label="Название">{data.name}</Descriptions.Item>
              <Descriptions.Item label="Описание">{data.description || '—'}</Descriptions.Item>
              <Descriptions.Item label="Отрасль">{data.industry || '—'}</Descriptions.Item>
              <Descriptions.Item label="Уровень">{data.level || '—'}</Descriptions.Item>
              <Descriptions.Item label="Трудоёмкость">{data.hours || '—'} ч.</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Структура A/B/C">
            <Descriptions column={1}>
              <Descriptions.Item label="A – Знания">
                <Space wrap>{data.structure.A?.map((item, idx) => <Tag key={idx}>{item}</Tag>) || '—'}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="B – Умения">
                <Space wrap>{data.structure.B?.map((item, idx) => <Tag key={idx} color="blue">{item}</Tag>) || '—'}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="C – Навыки">
                <Space wrap>{data.structure.C?.map((item, idx) => <Tag key={idx} color="green">{item}</Tag>) || '—'}</Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Связь с профстандартом">
            <Descriptions column={1}>
              <Descriptions.Item label="ПС ID">{data.prof_standard_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Выбранные ТФ">
                <Space wrap>{data.selected_tf_codes?.map(code => <Tag key={code}>{code}</Tag>) || '—'}</Space>
              </Descriptions.Item>
              {data.coverage_data?.length > 0 && (
                <Descriptions.Item label="Покрытие квалификаций">
                  {data.coverage_data.map(item => (
                    <div key={item.qualification_id}>
                      {item.qualification_code} – {item.coverage_percent}%
                    </div>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Оценочные средства">
            <Descriptions column={1}>
              <Descriptions.Item label="Количество">{data.assessment_tools?.length || 0}</Descriptions.Item>
              <Descriptions.Item label="Список">
                <Space wrap>
                  {data.assessment_tools?.map((tool, idx) => (
                    <Tag key={idx} color={tool.for_nok ? 'green' : 'blue'}>
                      {tool.level} – {tool.tool || 'не указано'}
                    </Tag>
                  )) || '—'}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={() => onSubmit('проект')} loading={loading}>
            Сохранить как проект
          </Button>
          <Button type="primary" onClick={() => onSubmit('на экспертизе')} loading={loading}>
            Отправить на экспертизу
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default Step5Preview;// Step5Preview 
