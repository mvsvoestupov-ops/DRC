import React, { useState, useEffect } from 'react';
import { Input, List, Card, Checkbox, Row, Col, Progress, Typography, Spin, Button, message } from 'antd';
import { getStandards } from '../api';
import axios from 'axios';

const { Title, Text } = Typography;

const SelectStandardForCompetence = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [standards, setStandards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState(null);
  const [laborFunctions, setLaborFunctions] = useState([]);
  const [selectedTFCodes, setSelectedTFCodes] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [coverageData, setCoverageData] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Поиск стандартов
  useEffect(() => {
    if (searchTerm.trim()) {
      setLoading(true);
      getStandards()
        .then(res => {
          const filtered = res.data.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          setStandards(filtered);
        })
        .catch(() => message.error('Ошибка загрузки списка ПС'))
        .finally(() => setLoading(false));
    } else {
      setStandards([]);
    }
  }, [searchTerm]);

  // Выбор стандарта – загружаем ТФ и квалификации
  const handleSelectStandard = async (std) => {
    setSelectedStandard(std);
    setSelectedTFCodes([]);
    setCoverageData([]);
    try {
      const [tfRes, qualsRes] = await Promise.all([
        axios.get(`http://localhost:8000/standards/${std.id}/labor-functions`),
        axios.get(`http://localhost:8000/qualifications/by-standard/${std.id}`)
      ]);
      setLaborFunctions(tfRes.data);
      setQualifications(qualsRes.data);
    } catch (err) {
      message.error('Ошибка загрузки данных о стандарте');
    }
  };

  // Переключение выбора ТФ
  const handleToggleTF = (code) => {
    let newSelected = [...selectedTFCodes];
    if (newSelected.includes(code)) {
      newSelected = newSelected.filter(c => c !== code);
    } else {
      newSelected.push(code);
    }
    setSelectedTFCodes(newSelected);

    // Пересчёт покрытия при изменении выбора
    if (selectedStandard && newSelected.length > 0) {
      setLoadingCoverage(true);
      axios.post('http://localhost:8000/competence/coverage', {
        standard_id: selectedStandard.id,
        selected_tf_codes: newSelected
      })
        .then(res => setCoverageData(res.data))
        .catch(() => message.error('Ошибка расчёта покрытия'))
        .finally(() => setLoadingCoverage(false));
    } else {
      setCoverageData([]);
    }
  };

  // Подтверждение выбора
  const handleConfirm = () => {
    if (onSelect) {
      const bestQual = coverageData.length > 0 ? coverageData[0] : null;
      onSelect({
        standard: selectedStandard,
        selectedTFCodes,
        selectedQualification: bestQual ? bestQual.qualification_id : null,
        coverageData
      });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Input.Search
            placeholder="Поиск профессионального стандарта..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Spin spinning={loading}>
            <List
              dataSource={standards}
              renderItem={item => (
                <List.Item
                  onClick={() => handleSelectStandard(item)}
                  style={{
                    cursor: 'pointer',
                    background: selectedStandard?.id === item.id ? '#e6f7ff' : 'white',
                    padding: '8px 16px',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                >
                  <strong>{item.name}</strong> (рег. № {item.reg_number})
                </List.Item>
              )}
            />
          </Spin>
          {selectedStandard && (
            <Card title="Трудовые функции" style={{ marginTop: 16 }}>
              <Checkbox.Group value={selectedTFCodes} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {laborFunctions.map(tf => (
                  <Checkbox key={tf.id} value={tf.code} onChange={() => handleToggleTF(tf.code)}>
                    <strong>{tf.code}</strong> {tf.name}
                    <br />
                    <Text type="secondary" style={{ fontSize: '0.8em' }}>
                      ОТФ: {tf.otf_code} - {tf.otf_name}
                    </Text>
                  </Checkbox>
                ))}
              </Checkbox.Group>
              <div style={{ marginTop: 8, color: '#888' }}>
                Выбрано: {selectedTFCodes.length} ТФ
              </div>
            </Card>
          )}
        </Col>
        <Col span={12}>
          {qualifications.length > 0 && (
            <Card title="Квалификации, связанные с ПС" style={{ marginBottom: 16 }}>
              {qualifications.map(q => (
                <div key={q.id} style={{ marginBottom: 8 }}>
                  <strong>{q.code}</strong> - {q.name}
                </div>
              ))}
            </Card>
          )}
          {loadingCoverage ? (
            <Spin tip="Расчёт покрытия..." />
          ) : (
            coverageData.length > 0 && (
              <Card title="Процент покрытия квалификаций">
                {coverageData.map(item => (
                  <div key={item.qualification_id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.qualification_code} - {item.qualification_name}</span>
                      <span style={{ fontWeight: 'bold' }}>{item.coverage_percent}%</span>
                    </div>
                    <Progress
                      percent={item.coverage_percent}
                      size="small"
                      status={item.coverage_percent === 100 ? 'success' : 'active'}
                    />
                    <div style={{ fontSize: '0.8em', color: '#888' }}>
                      Покрыто: {item.covered_tf} из {item.total_tf} ТФ
                    </div>
                  </div>
                ))}
              </Card>
            )
          )}
        </Col>
      </Row>
      {selectedStandard && selectedTFCodes.length > 0 && (
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Button type="primary" size="large" onClick={handleConfirm}>
            Подтвердить выбор
          </Button>
        </div>
      )}
    </div>
  );
};

export default SelectStandardForCompetence;