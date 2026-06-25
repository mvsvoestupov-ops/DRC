import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Spin, Button, Tabs, Collapse, Typography, List, Row, Col } from 'antd';
import { getQualification } from '../api';

const { Panel } = Collapse;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const QualificationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qual, setQual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQualification(id)
      .then(res => setQual(res.data))
      .catch(() => setQual(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!qual) return <div style={{ padding: 24 }}>Квалификация не найдена</div>;

  // Преобразование полей
  const laborFunctions = qual.labor_functions || [];
  const possibleJobTitles = qual.possible_job_titles || [];
  const specialAdmission = qual.special_admission || [];
  const examDocuments = qual.exam_documents || [];

  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => navigate('/qualifications')} style={{ marginBottom: 16 }}>
        ← Назад к списку
      </Button>
      <Card title={qual.name}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Код квалификации">{qual.code}</Descriptions.Item>
          <Descriptions.Item label="Уровень квалификации">{qual.level}</Descriptions.Item>
          <Descriptions.Item label="Вид деятельности">{qual.activity_area || '—'}</Descriptions.Item>
          <Descriptions.Item label="Наименование ПС">
            {qual.prof_standard_name || 'Нет связанного ПС'}
            {qual.prof_standard_order && (
              <div style={{ fontSize: '12px', color: '#888' }}>
                {qual.prof_standard_order}
              </div>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Квалификационное требование">
            {qual.qualification_requirement || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Возможные должности">
            {possibleJobTitles.length > 0 ? possibleJobTitles.join('; ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Особые условия допуска">
            {specialAdmission.length > 0 ? (
              <List
                size="small"
                dataSource={specialAdmission}
                renderItem={(item, idx) => <List.Item>{`${idx+1}. ${item}`}</List.Item>}
              />
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Перечень документов для экзамена">
            {examDocuments.length > 0 ? (
              <List
                size="small"
                dataSource={examDocuments}
                renderItem={(item, idx) => <List.Item>{`${idx+1}. ${item}`}</List.Item>}
              />
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Срок действия свидетельства">
            {qual.certificate_validity || '—'}
          </Descriptions.Item>
        </Descriptions>

        {laborFunctions.length > 0 && (
          <>
            <Title level={4} style={{ marginTop: 24 }}>Трудовые функции</Title>
            <Collapse>
              {laborFunctions.map((tf, idx) => (
                <Panel header={`${tf.code} – ${tf.name}`} key={idx}>
                  <div>Номер: {tf.number}</div>
                  <div>Код: {tf.code}</div>
                  <div>Наименование: {tf.name}</div>
                </Panel>
              ))}
            </Collapse>
          </>
        )}

        {/* Дополнительная информация из raw_data */}
        {qual.raw_data && Object.keys(qual.raw_data).length > 0 && (
          <>
            <Title level={4} style={{ marginTop: 24 }}>Дополнительные сведения</Title>
            <Descriptions column={1} bordered>
              {qual.raw_data.description && (
                <Descriptions.Item label="Описание">{qual.raw_data.description}</Descriptions.Item>
              )}
              {qual.raw_data.industry && (
                <Descriptions.Item label="Отрасль">{qual.raw_data.industry}</Descriptions.Item>
              )}
              {qual.raw_data.hours && (
                <Descriptions.Item label="Трудоёмкость">{qual.raw_data.hours} ч.</Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Card>
    </div>
  );
};

export default QualificationDetail;