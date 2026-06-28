import React, { useState, useEffect } from 'react';
import { Card, List, Button, message, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getCompetences } from '../api';
import { PlusOutlined } from '@ant-design/icons';

const MyProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getCompetences()
      .then(res => {
        setProjects(res.data);
        setLoading(false);
      })
      .catch(() => {
        message.error('Ошибка загрузки проектов');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Мои проекты</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/strategic-session')}>
          Создать новый проект
        </Button>
      </div>
      <Spin spinning={loading}>
        <List
          dataSource={projects}
          renderItem={project => (
            <Card
              hoverable
              onClick={() => navigate(`/competence/${project.id}`)}
              style={{ marginBottom: 12 }}
            >
              <div>
                <strong>{project.name}</strong>
                <div style={{ color: '#888', fontSize: '0.9em' }}>Статус: {project.status}</div>
              </div>
            </Card>
          )}
        />
      </Spin>
    </div>
  );
};

export default MyProjects;