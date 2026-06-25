import React, { useState, useEffect } from 'react';
import { Input, Select, Card, Row, Col, Tag, Spin, Empty, Pagination, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getQualifications } from '../api';

const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const QualificationsList = () => {
  const [allQualifications, setAllQualifications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const navigate = useNavigate();

  useEffect(() => {
    getQualifications()
      .then(res => {
        setAllQualifications(res.data);
        setFiltered(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Фильтрация
    let result = allQualifications;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(q =>
        q.name?.toLowerCase().includes(lower) ||
        q.code?.toLowerCase().includes(lower) ||
        q.prof_standard_name?.toLowerCase().includes(lower)
      );
    }
    if (levelFilter) {
      result = result.filter(q => q.level === levelFilter);
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [searchText, levelFilter, allQualifications]);

  const handleCardClick = (id) => {
    navigate(`/qualifications/${id}`);
  };

  // Уникальные уровни для фильтра
  const levels = [...new Set(allQualifications.map(q => q.level).filter(Boolean))];

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Сведения о квалификациях</Title>
      <Text type="secondary">Найдите квалификацию по названию, коду или профессиональному стандарту</Text>

      <div style={{ display: 'flex', gap: '16px', margin: '16px 0', flexWrap: 'wrap' }}>
        <Search
          placeholder="Поиск..."
          allowClear
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        <Select
          placeholder="Уровень квалификации"
          allowClear
          value={levelFilter}
          onChange={setLevelFilter}
          style={{ width: 200 }}
        >
          {levels.map(lv => (
            <Option key={lv} value={lv}>{lv}</Option>
          ))}
        </Select>
        <span style={{ marginLeft: 'auto', color: '#888' }}>
          Найдено: {filtered.length}
        </span>
      </div>

      <Spin spinning={loading}>
        {filtered.length === 0 ? (
          <Empty description="Квалификации не найдены" />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {paginated.map(q => (
                <Col xs={24} sm={12} md={8} lg={6} key={q.id}>
                  <Card
                    hoverable
                    onClick={() => handleCardClick(q.id)}
                    style={{ height: '100%' }}
                    extra={q.level && <Tag color="blue">{q.level}</Tag>}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                      {q.code}
                    </div>
                    <div style={{ minHeight: '48px' }}>{q.name}</div>
                    {q.prof_standard_name && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                        <Tag color="green">ПС: {q.prof_standard_name?.slice(0, 40)}...</Tag>
                      </div>
                    )}
                    {q.activity_area && (
                      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                        {q.activity_area}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filtered.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </Spin>
    </div>
  );
};

export default QualificationsList;