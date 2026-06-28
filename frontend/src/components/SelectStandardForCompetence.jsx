import React, { useState, useEffect } from 'react';
import {
  Input, List, Card, Checkbox, Row, Col, Progress, Typography,
  Spin, Button, message, Select, Modal, Tag, Badge, Empty, Space, Divider, Collapse
} from 'antd';
import {
  SearchOutlined, AppstoreOutlined, FileSearchOutlined,
  SafetyOutlined, CheckCircleOutlined, EyeOutlined,
  FolderOutlined, FileOutlined, DownOutlined, RightOutlined,
  PlusOutlined, MinusOutlined
} from '@ant-design/icons';
import { getStandards, getEnrichedStandard } from '../api';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

// Справочник областей профессиональной деятельности (без изменений, сокращён для экономии места)
const AREAS = [
  { code: '01', name: 'Образование и наука' },
  { code: '02', name: 'Здравоохранение' },
  { code: '03', name: 'Социальное обслуживание' },
  { code: '04', name: 'Культура, искусство' },
  { code: '05', name: 'Физическая культура и спорт' },
  { code: '06', name: 'Связь, информационные и коммуникационные технологии' },
  { code: '07', name: 'Административно-управленческая и офисная деятельность' },
  { code: '08', name: 'Финансы и экономика' },
  { code: '09', name: 'Юриспруденция' },
  { code: '10', name: 'Архитектура, проектирование, геодезия, топография и дизайн' },
  { code: '11', name: 'Средства массовой информации, издательство и полиграфия' },
  { code: '12', name: 'Обеспечение безопасности' },
  { code: '13', name: 'Сельское хозяйство' },
  { code: '14', name: 'Лесное хозяйство, охота' },
  { code: '15', name: 'Рыбоводство и рыболовство' },
  { code: '16', name: 'Строительство и жилищно-коммунальное хозяйство' },
  { code: '17', name: 'Транспорт' },
  { code: '18', name: 'Добыча, переработка угля, руд и других полезных ископаемых' },
  { code: '19', name: 'Добыча, переработка, транспортировка нефти и газа' },
  { code: '20', name: 'Электроэнергетика' },
  { code: '21', name: 'Лёгкая и текстильная промышленность' },
  { code: '22', name: 'Пищевая промышленность, включая производство напитков и табака' },
  { code: '23', name: 'Деревообрабатывающая и целлюлозно-бумажная промышленность, мебельное производство' },
  { code: '24', name: 'Атомная промышленность' },
  { code: '25', name: 'Ракетно-космическая промышленность' },
  { code: '26', name: 'Химическое, химико-технологическое производство' },
  { code: '27', name: 'Металлургическое производство' },
  { code: '28', name: 'Производство машин и оборудования' },
  { code: '29', name: 'Производство электрооборудования, электронного и оптического оборудования' },
  { code: '30', name: 'Судостроение' },
  { code: '31', name: 'Автомобилестроение' },
  { code: '32', name: 'Авиастроение' },
  { code: '33', name: 'Сервис, оказание услуг населению' },
  { code: '40', name: 'Сквозные виды профессиональной деятельности в промышленности' },
];

// Компонент для отображения одного трудового действия с его У и З
const LaborActionItem = ({ action, index }) => {
  const [expanded, setExpanded] = useState(false);

  const text = typeof action === 'string' ? action : action.text || action;
  const skills = action.skills || action.required_skills || [];
  const knowledges = action.knowledges || action.necessary_knowledges || [];

  const hasSkills = skills.length > 0;
  const hasKnowledges = knowledges.length > 0;
  const hasContent = hasSkills || hasKnowledges;

  const renderList = (items, label) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginLeft: 16, marginBottom: 4 }}>
        <Text type="secondary" strong>{label}:</Text>
        <ul style={{ marginTop: 2, paddingLeft: 20, marginBottom: 0 }}>
          {items.map((item, idx) => (
            <li key={idx}>{typeof item === 'string' ? item : item.text || item}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div style={{ 
      marginBottom: 6, 
      padding: '6px 0',
      borderBottom: '1px solid #f5f5f5'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ color: '#888', fontWeight: 500, minWidth: 24, fontSize: 13 }}>
          {index + 1}.
        </span>
        <span style={{ flex: 1, fontSize: 14 }}>{text}</span>
        {hasContent && (
          <Button
            type="text"
            size="small"
            icon={expanded ? <MinusOutlined /> : <PlusOutlined />}
            onClick={() => setExpanded(!expanded)}
            style={{ 
              color: '#1890ff',
              padding: '0 8px',
              flexShrink: 0,
              fontSize: 12
            }}
          >
            {expanded ? 'Скрыть З/У' : 'Показать З/У'}
            <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
              ({skills.length + knowledges.length})
            </span>
          </Button>
        )}
      </div>
      
      {expanded && hasContent && (
        <div style={{ marginTop: 6, paddingLeft: 32 }}>
          {renderList(skills, 'Умения (У)')}
          {renderList(knowledges, 'Знания (З)')}
        </div>
      )}
    </div>
  );
};

const SelectStandardForCompetence = ({ onSelect }) => {
  const [allStandards, setAllStandards] = useState([]);
  const [filteredStandards, setFilteredStandards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchContent, setSearchContent] = useState('');
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState(null);
  const [laborFunctions, setLaborFunctions] = useState([]);
  const [selectedTFCodes, setSelectedTFCodes] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [coverageData, setCoverageData] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [expandedTF, setExpandedTF] = useState({});

  useEffect(() => {
    setLoading(true);
    getStandards()
      .then(res => {
        setAllStandards(res.data);
        setFilteredStandards([]);
        setLoading(false);
      })
      .catch(() => {
        message.error('Ошибка загрузки списка ПС');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const hasFilter = searchName.trim() || selectedAreas.length > 0 || searchContent.trim();
    if (!hasFilter || allStandards.length === 0) {
      setFilteredStandards([]);
      return;
    }
    let result = allStandards;
    if (searchName.trim()) {
      const lower = searchName.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lower));
    }
    if (selectedAreas.length > 0) {
      result = result.filter(s => s.professional_area_code && selectedAreas.includes(s.professional_area_code));
    }
    if (searchContent.trim()) {
      const lower = searchContent.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        (s.kind_activity && s.kind_activity.toLowerCase().includes(lower)) ||
        (s.purpose && s.purpose.toLowerCase().includes(lower))
      );
    }
    setFilteredStandards(result);
  }, [searchName, selectedAreas, searchContent, allStandards]);

const handleSelectStandard = async (std) => {
  setSelectedStandard(std);
  setSelectedTFCodes([]);
  setCoverageData([]);
  setExpandedTF({});
  try {
    // Сначала пробуем загрузить обогащённый стандарт
    let fullStandard = null;
    let isEnriched = false;
    try {
      const enrichedRes = await axios.get(`http://localhost:8000/enriched-standards/${std.reg_number}`);
      if (enrichedRes.data && enrichedRes.data.generalized_functions) {
        fullStandard = enrichedRes.data;
        isEnriched = true;
        console.log('Используем ОБОГАЩЁННЫЙ стандарт');
      }
    } catch (e) {
      console.log('Обогащённый стандарт не найден, используем сырой');
    }

    // Если обогащённый не загрузился, используем сырой
    if (!fullStandard) {
      const stdRes = await axios.get(`http://localhost:8000/standards/${std.reg_number}`);
      fullStandard = stdRes.data;
      isEnriched = false;
      console.log('Используем СЫРОЙ стандарт');
    }

    // Диагностика
    console.log('Стандарт:', fullStandard.name, 'Обогащён:', isEnriched);

    const allTFs = [];
    if (fullStandard.generalized_functions) {
      fullStandard.generalized_functions.forEach(gf => {
        if (gf.particular_functions) {
          gf.particular_functions.forEach(pf => {
            // Формируем labor_actions с привязками
            let laborActions = [];
            if (isEnriched) {
              // В обогащённом стандарте labor_actions уже содержат skills и knowledges
              laborActions = (pf.labor_actions || []).map(la => ({
                text: la.text,
                skills: (la.skills || []).map(s => s.text || s),
                knowledges: (la.knowledges || []).map(k => k.text || k)
              }));
            } else {
              // В сыром стандарте labor_actions только текст, skills/knowledges общие для ТФ
              const rawActions = (pf.labor_actions || []).map(la => ({
                text: la.text || la,
                skills: pf.required_skills || [],
                knowledges: pf.necessary_knowledges || []
              }));
              laborActions = rawActions;
            }

            allTFs.push({
              id: pf.code,
              code: pf.code,
              name: pf.name,
              otf_code: gf.code,
              otf_name: gf.name,
              labor_actions: laborActions,
              required_skills: pf.required_skills || [],
              necessary_knowledges: pf.necessary_knowledges || [],
              generalized_function: gf,
              isEnriched: isEnriched,
              level: pf.sub_qualification || '',
            });
          });
        }
      });
    }
    setLaborFunctions(allTFs);

    // Загружаем квалификации (они не зависят от обогащения)
    const qualsRes = await axios.get(`http://localhost:8000/qualifications/by-standard/${std.id}`);
    setQualifications(qualsRes.data);
  } catch (err) {
    console.error(err);
    message.error('Ошибка загрузки данных о стандарте');
  }
};
  const handleToggleTF = (code) => {
    let newSelected = [...selectedTFCodes];
    if (newSelected.includes(code)) {
      newSelected = newSelected.filter(c => c !== code);
    } else {
      newSelected.push(code);
    }
    setSelectedTFCodes(newSelected);

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

  const toggleTFExpand = (code) => {
    setExpandedTF(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

// ... (без изменений до handleConfirm)

const handleConfirm = () => {
  if (onSelect) {
    const bestQual = coverageData.length > 0 ? coverageData[0] : null;
    // Фильтруем выбранные ТФ
    const selectedLaborFunctions = laborFunctions.filter(tf => selectedTFCodes.includes(tf.code));
    console.log('Передаём выбранные ТФ:', selectedLaborFunctions);
    onSelect({
      standard: selectedStandard,
      selectedTFCodes,
      selectedQualification: bestQual ? bestQual.qualification_id : null,
      coverageData,
      selectedLaborFunctions // <-- обязательно
    });
    message.success('Данные сохранены. Нажмите "Далее" для продолжения.');
  }
};

// остальной код без изменений

  const hasFilter = searchName.trim() || selectedAreas.length > 0 || searchContent.trim();

  return (
    <div style={{ padding: '24px', background: '#f0f5ff' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          Выбор профессионального стандарта
        </Title>
        <Badge count={`${allStandards.length} ПС в базе`} style={{ backgroundColor: '#1890ff' }} />
      </div>

      {/* Поля поиска */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Поиск по названию..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              size="large"
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              mode="multiple"
              placeholder="Область профессиональной деятельности"
              value={selectedAreas}
              onChange={setSelectedAreas}
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="children"
              size="large"
            >
              {AREAS.map(area => (
                <Option key={area.code} value={area.code}>{area.code} – {area.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Поиск по содержанию (вид деятельности, цель)..."
              value={searchContent}
              onChange={e => setSearchContent(e.target.value)}
              prefix={<FileSearchOutlined style={{ color: '#bfbfbf' }} />}
              size="large"
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          {!hasFilter ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 12 }}>
              <SearchOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16, fontSize: 16, color: '#8c8c8c' }}>
                Начните поиск, чтобы найти подходящий профессиональный стандарт
              </div>
            </Card>
          ) : (
            <Spin spinning={loading}>
              <List
                dataSource={filteredStandards}
                renderItem={item => (
                  <Card
                    hoverable
                    onClick={() => handleSelectStandard(item)}
                    style={{
                      marginBottom: 12,
                      borderRadius: 12,
                      borderColor: selectedStandard?.id === item.id ? '#1890ff' : '#f0f0f0',
                      boxShadow: selectedStandard?.id === item.id ? '0 0 0 2px #1890ff' : 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                        {item.professional_area_code && (
                          <Tag color="blue" style={{ borderRadius: 12 }}>{item.professional_area_code}</Tag>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: '0.9em' }}>
                        Рег. № {item.reg_number}
                      </Text>
                      {item.kind_activity && (
                        <div style={{ fontSize: '0.8em', color: '#8c8c8c', marginTop: 4 }}>
                          {item.kind_activity}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              />
            </Spin>
          )}
          
          {selectedStandard && laborFunctions.length > 0 && (
            <Card 
              title="Трудовые функции" 
              style={{ marginTop: 16, borderRadius: 12 }}
              extra={<Text type="secondary">Выбрано: {selectedTFCodes.length} ТФ</Text>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {laborFunctions.map(tf => {
                  const isChecked = selectedTFCodes.includes(tf.code);
                  const isExpanded = expandedTF[tf.code] || false;
                  const hasLaborActions = tf.labor_actions && tf.labor_actions.length > 0;

                  return (
                    <div key={tf.id} style={{ 
                      border: '1px solid #e8e8e8', 
                      borderRadius: 8, 
                      padding: '8px 12px',
                      background: isChecked ? '#f6ffed' : 'white',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Checkbox 
                          checked={isChecked}
                          onChange={() => handleToggleTF(tf.code)}
                          style={{ marginTop: 2 }}
                        >
                          <div>
                            <strong>{tf.code}</strong> {tf.name}
                            <br />
                            <Text type="secondary" style={{ fontSize: '0.8em' }}>
                              ОТФ: {tf.otf_code} - {tf.otf_name}
                            </Text>
                          </div>
                        </Checkbox>
                        {hasLaborActions && (
                          <Button
                            type="text"
                            size="small"
                            icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
                            onClick={(e) => { e.stopPropagation(); toggleTFExpand(tf.code); }}
                            style={{ 
                              marginLeft: 'auto', 
                              color: '#1890ff',
                              padding: '0 8px',
                              flexShrink: 0
                            }}
                          >
                            {isExpanded ? 'Скрыть ТД' : 'Показать ТД'}
                            <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
                              ({tf.labor_actions.length})
                            </span>
                          </Button>
                        )}
                      </div>
                      
                      {isExpanded && hasLaborActions && (
                        <div style={{ 
                          marginTop: 8, 
                          marginLeft: 24, 
                          padding: '8px 12px', 
                          background: '#fafafa', 
                          borderRadius: 6,
                          borderLeft: '3px solid #1890ff'
                        }}>
                          {tf.labor_actions.map((action, idx) => (
                            <LaborActionItem 
                              key={idx} 
                              action={action} 
                              index={idx}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={12}>
          {qualifications.length > 0 && (
            <Card title="Квалификации, связанные с ПС" style={{ marginBottom: 16, borderRadius: 12 }}>
              {qualifications.map(q => (
                <div key={q.id} style={{ marginBottom: 8, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <strong>{q.code}</strong> - {q.name}
                </div>
              ))}
            </Card>
          )}
          {loadingCoverage ? (
            <Spin tip="Расчёт покрытия..." />
          ) : (
            coverageData.length > 0 && (
              <Card title="Покрытие квалификаций выбранными ТФ" style={{ borderRadius: 12 }}>
                {coverageData.map(item => (
                  <div key={item.qualification_id} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{item.qualification_code}</strong> {item.qualification_name}</span>
                      <Tag color={item.coverage_percent === 100 ? 'green' : 'blue'}>
                        {item.coverage_percent}%
                      </Tag>
                    </div>
                    <Progress
                      percent={item.coverage_percent}
                      size="small"
                      status={item.coverage_percent === 100 ? 'success' : 'active'}
                      strokeColor={item.coverage_percent === 100 ? '#52c41a' : '#1890ff'}
                    />
                    <Text type="secondary" style={{ fontSize: '0.8em' }}>
                      Покрыто: {item.covered_tf} из {item.total_tf} ТФ
                    </Text>
                  </div>
                ))}
              </Card>
            )
          )}
          {selectedTFCodes.length > 0 && (
            <Card title="Выбранные ТФ и их квалификации" style={{ marginTop: 16, borderRadius: 12 }}>
              {selectedTFCodes.map(code => {
                const tf = laborFunctions.find(t => t.code === code);
                const qualForTF = coverageData.filter(item =>
                  item.missing_tf && !item.missing_tf.includes(code) &&
                  item.total_tf > 0
                );
                return (
                  <div key={code} style={{ marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    <div><strong>{code}</strong> {tf?.name}</div>
                    {qualForTF.length > 0 ? (
                      <div style={{ fontSize: '0.9em', color: '#555' }}>
                        Входит в квалификации:
                        {qualForTF.map(q => (
                          <Tag key={q.qualification_id} color="blue" style={{ margin: '2px 4px' }}>
                            {q.qualification_code} ({q.coverage_percent}%)
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.9em', color: '#999' }}>Не входит ни в одну квалификацию</div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </Col>
      </Row>

      {selectedStandard && selectedTFCodes.length > 0 && (
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleConfirm}>
            Подтвердить выбор
          </Button>
        </div>
      )}
    </div>
  );
};

export default SelectStandardForCompetence;