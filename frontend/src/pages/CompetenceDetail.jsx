import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Spin, Button } from 'antd';
import { getCompetence } from '../api';

const CompetenceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompetence(id).then(res => {
      setComp(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin />;
  if (!comp) return <div>Компетенция не найдена</div>;

  return (
    <div style={{ padding: 24 }}>
      <Card title={comp.name}>
        <Descriptions column={1}>
          <Descriptions.Item label="Код">{comp.code || '—'}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            <Tag color={comp.status === 'утверждена' ? 'green' : 'gold'}>
              {comp.status || 'проект'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Уровень">{comp.qualification_level || '—'}</Descriptions.Item>
          <Descriptions.Item label="Отрасль">{comp.industry || '—'}</Descriptions.Item>
          <Descriptions.Item label="Трудоёмкость">{comp.hours || '—'} ч.</Descriptions.Item>
          <Descriptions.Item label="Структура A/B/C">
            <div><strong>A:</strong> {comp.structure?.A?.join(', ') || '—'}</div>
            <div><strong>B:</strong> {comp.structure?.B?.join(', ') || '—'}</div>
            <div><strong>C:</strong> {comp.structure?.C?.join(', ') || '—'}</div>
          </Descriptions.Item>
          <Descriptions.Item label="Трудовые функции">
            {comp.labor_functions?.map(tf => <Tag key={tf.code}>{tf.code}</Tag>) || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Оценочные средства">
            {comp.assessment_tools?.map((tool, idx) => (
              <div key={idx}>
                {tool.level}: {tool.tool} {tool.for_nok && <Tag color="green">НОК</Tag>}
              </div>
            )) || '—'}
          </Descriptions.Item>
        </Descriptions>
        <Button onClick={() => navigate(-1)}>Назад</Button>
      </Card>
    </div>
  );
};

export default CompetenceDetail;