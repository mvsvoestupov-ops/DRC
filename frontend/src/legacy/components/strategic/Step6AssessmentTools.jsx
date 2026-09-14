import React, { useState, useEffect } from 'react';
import { Tabs, Table, Checkbox, Input, Button, Typography, message, Select, Space, Row, Col, Card, List, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TEST_TYPES = [
  { value: 'single', label: 'Одиночный выбор' },
  { value: 'multiple', label: 'Множественный выбор' },
  { value: 'match', label: 'Соответствие' },
  { value: 'sequence', label: 'Упорядочивание' },
  { value: 'open', label: 'Открытый вопрос' },
];

const LEVELS = [
  { value: 'basic', label: 'Базовый' },
  { value: 'advanced', label: 'Продвинутый' },
  { value: 'expert', label: 'Экспертный' },
];

const Step6AssessmentTools = ({ data, updateData }) => {
  const knowledgeItems = data.structure?.A || [];
  const skillsB = data.structure?.B || [];
  const skillsC = data.structure?.C || [];
  const savedTools = data.assessment_tools || {};
  const [selectedLevel, setSelectedLevel] = useState(null);

  const initializeLevelData = () => {
    const levelData = {};
    LEVELS.forEach(level => {
      const levelKey = level.value;
      const savedLevel = savedTools[levelKey] || {};
      const tests = savedLevel.tests || [];
      const testItems = knowledgeItems.map(k => {
        const existing = tests.find(t => t.knowledgeId === k.id);
        return {
          knowledgeId: k.id,
          text: k.text,
          selected: !!existing && existing.selected !== false,
          type: existing?.taskType || 'single',
          question: existing?.taskText || '',
          options: existing?.options || [],
        };
      });
      levelData[levelKey] = {
        tests: testItems,
        practical: savedLevel.practical || [],
        nok: savedLevel.nok || false,
        selectedSkillIds: [],
        newTaskText: '',
        newTaskCriteria: '',
      };
    });
    return levelData;
  };

  const [levelData, setLevelData] = useState(() => initializeLevelData());

  useEffect(() => {
    setLevelData(prev => {
      const newLevelData = { ...prev };
      LEVELS.forEach(level => {
        const levelKey = level.value;
        const currentTests = newLevelData[levelKey]?.tests || [];
        const existingIds = new Set(currentTests.map(t => t.knowledgeId));
        const newItems = knowledgeItems.filter(k => !existingIds.has(k.id)).map(k => ({ knowledgeId: k.id, text: k.text, selected: false, type: 'single', question: '', options: [] }));
        if (newItems.length > 0) newLevelData[levelKey] = { ...newLevelData[levelKey], tests: [...currentTests, ...newItems] };
        const knowledgeIds = new Set(knowledgeItems.map(k => k.id));
        const filteredTests = (newLevelData[levelKey]?.tests || []).filter(t => knowledgeIds.has(t.knowledgeId));
        if (filteredTests.length !== (newLevelData[levelKey]?.tests || []).length) newLevelData[levelKey] = { ...newLevelData[levelKey], tests: filteredTests };
      });
      return newLevelData;
    });
  }, [knowledgeItems]);

  useEffect(() => {
    const saved = {};
    LEVELS.forEach(level => {
      const levelKey = level.value;
      const lvl = levelData[levelKey];
      if (!lvl) return;
      saved[levelKey] = {
        tests: lvl.tests.filter(t => t.selected && t.question.trim()).map(t => ({ knowledgeId: t.knowledgeId, componentText: t.text, taskType: t.type, taskText: t.question, options: t.options })),
        practical: lvl.practical || [],
        nok: lvl.nok || false,
      };
    });
    updateData({ assessment_tools: saved });
  }, [levelData]);

  const updateTest = (levelKey, knowledgeId, field, value) => {
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], tests: (prev[levelKey]?.tests || []).map(t => t.knowledgeId === knowledgeId ? { ...t, [field]: value } : t) } }));
  };

  const addOption = (levelKey, knowledgeId) => {
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], tests: (prev[levelKey]?.tests || []).map(t => t.knowledgeId === knowledgeId ? { ...t, options: [...t.options, { text: '', isCorrect: false }] } : t) } }));
  };

  const removeOption = (levelKey, knowledgeId, index) => {
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], tests: (prev[levelKey]?.tests || []).map(t => t.knowledgeId === knowledgeId ? { ...t, options: t.options.filter((_, i) => i !== index) } : t) } }));
  };

  const updateOption = (levelKey, knowledgeId, index, field, value) => {
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], tests: (prev[levelKey]?.tests || []).map(t => t.knowledgeId === knowledgeId ? { ...t, options: t.options.map((opt, i) => i === index ? { ...opt, [field]: value } : opt) } : t) } }));
  };

  const toggleSkill = (levelKey, skillId) => {
    setLevelData(prev => {
      const lvl = prev[levelKey];
      const currentSelected = lvl.selectedSkillIds || [];
      const newSelected = currentSelected.includes(skillId) ? currentSelected.filter(id => id !== skillId) : [...currentSelected, skillId];
      return { ...prev, [levelKey]: { ...lvl, selectedSkillIds: newSelected } };
    });
  };

  const addPracticalTask = (levelKey) => {
    const lvl = levelData[levelKey];
    const selectedIds = lvl.selectedSkillIds || [];
    if (selectedIds.length === 0) { message.warning('Выберите хотя бы одно умение/навык'); return; }
    if (!lvl.newTaskText?.trim()) { message.warning('Введите текст задания'); return; }
    if (!lvl.newTaskCriteria?.trim()) { message.warning('Введите критерии оценки'); return; }
    const newTask = {
      id: Date.now() + Math.random(),
      componentIds: selectedIds,
      componentTexts: selectedIds.map(id => { const found = [...skillsB, ...skillsC].find(s => s.id === id); return found ? found.text : ''; }),
      taskText: lvl.newTaskText,
      criteria: lvl.newTaskCriteria,
    };
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], practical: [...(prev[levelKey].practical || []), newTask], selectedSkillIds: [], newTaskText: '', newTaskCriteria: '' } }));
    message.success('Задание добавлено');
  };

  const removePracticalTask = (levelKey, taskId) => {
    setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], practical: (prev[levelKey].practical || []).filter(t => t.id !== taskId) } }));
    message.success('Задание удалено');
  };

  const updatePracticalField = (levelKey, field, value) => setLevelData(prev => ({ ...prev, [levelKey]: { ...prev[levelKey], [field]: value } }));

  const usedSkillIds = (levelKey) => {
    const ids = new Set();
    (levelData[levelKey]?.practical || []).forEach(task => task.componentIds.forEach(id => ids.add(id)));
    return ids;
  };

  const renderTestTable = (levelKey) => {
    const tests = levelData[levelKey]?.tests || [];
    if (knowledgeItems.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Нет знаний для разработки тестовых заданий.</div>;
    const testColumns = [
      { title: 'Выбрать', dataIndex: 'selected', key: 'selected', width: 80, render: (selected, record) => <Checkbox checked={selected} onChange={(e) => updateTest(levelKey, record.knowledgeId, 'selected', e.target.checked)} /> },
      { title: 'Знание', dataIndex: 'text', key: 'text', render: (text) => <strong>{text}</strong> },
      { title: 'Тип задания', dataIndex: 'type', key: 'type', width: 180, render: (type, record) => <Select value={type} onChange={(val) => updateTest(levelKey, record.knowledgeId, 'type', val)} style={{ width: '100%' }} disabled={!record.selected}>{TEST_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}</Select> },
      { title: 'Текст вопроса', dataIndex: 'question', key: 'question', render: (text, record) => <TextArea rows={2} value={text} onChange={(e) => updateTest(levelKey, record.knowledgeId, 'question', e.target.value)} placeholder="Введите текст вопроса..." disabled={!record.selected} /> },
    ];
    const expandedRowRender = (record) => {
      if (!record.selected) return null;
      const isSingleOrMultiple = ['single', 'multiple'].includes(record.type);
      return (
        <div style={{ margin: '16px 0', padding: '16px', background: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Варианты ответов:</div>
          {record.options.map((opt, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
              {isSingleOrMultiple && <Col span={2}><Checkbox checked={opt.isCorrect} onChange={(e) => updateOption(levelKey, record.knowledgeId, idx, 'isCorrect', e.target.checked)} /></Col>}
              <Col span={isSingleOrMultiple ? 20 : 22}><Input value={opt.text} onChange={(e) => updateOption(levelKey, record.knowledgeId, idx, 'text', e.target.value)} placeholder={`Вариант ${idx+1}`} /></Col>
              <Col span={2}><Button type="text" icon={<DeleteOutlined />} onClick={() => removeOption(levelKey, record.knowledgeId, idx)} danger /></Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => addOption(levelKey, record.knowledgeId)}>Добавить вариант</Button>
        </div>
      );
    };
    return <Table dataSource={tests} columns={testColumns} pagination={false} rowKey="knowledgeId" expandable={{ expandedRowRender, rowExpandable: record => record.selected }} style={{ marginTop: 16 }} />;
  };

  const renderPractical = (levelKey) => {
    const lvl = levelData[levelKey];
    if (!lvl) return null;
    const used = usedSkillIds(levelKey);
    const selectedIds = lvl.selectedSkillIds || [];
    const renderSkills = (skills, title) => (
      <Card title={title} size="small">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {skills.map(skill => {
            const usedFlag = used.has(skill.id);
            const selected = selectedIds.includes(skill.id);
            return (
              <Button key={skill.id} type={usedFlag ? 'default' : (selected ? 'primary' : 'default')} onClick={() => !usedFlag && toggleSkill(levelKey, skill.id)} disabled={usedFlag} style={{ marginBottom: 4, backgroundColor: usedFlag ? '#f6ffed' : undefined, borderColor: usedFlag ? '#b7eb8f' : undefined, color: usedFlag ? '#389e0d' : undefined }}>
                {skill.text} {usedFlag && <CheckCircleOutlined />}
              </Button>
            );
          })}
          {skills.length === 0 && <span style={{ color: '#999' }}>Нет элементов</span>}
        </div>
      </Card>
    );
    return (
      <div>
        <Row gutter={16}>
          <Col span={12}>{renderSkills(skillsB, 'B – Умения / интеллектуальные навыки')}</Col>
          <Col span={12}>{renderSkills(skillsC, 'C – Практические навыки')}</Col>
        </Row>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}><strong>Выбрано умений/навыков: {selectedIds.length}</strong></div>
          {selectedIds.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}><label>Текст комплексного задания:</label><TextArea rows={4} value={lvl.newTaskText || ''} onChange={(e) => updatePracticalField(levelKey, 'newTaskText', e.target.value)} /></div>
              <div style={{ marginBottom: 8 }}><label>Критерии оценки:</label><TextArea rows={3} value={lvl.newTaskCriteria || ''} onChange={(e) => updatePracticalField(levelKey, 'newTaskCriteria', e.target.value)} /></div>
              <Button type="primary" onClick={() => addPracticalTask(levelKey)} icon={<PlusOutlined />}>Добавить задание</Button>
            </div>
          )}
        </div>
        {(lvl.practical || []).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Title level={5}>Созданные практические задания</Title>
            <List dataSource={lvl.practical || []} renderItem={task => (
              <List.Item actions={[<Button type="text" danger icon={<DeleteOutlined />} onClick={() => removePracticalTask(levelKey, task.id)}>Удалить</Button>]}>
                <List.Item.Meta title={task.taskText} description={<div><div><strong>Умения:</strong> {task.componentTexts.join(', ')}</div><div><strong>Критерии:</strong> {task.criteria}</div></div>} />
              </List.Item>
            )} />
          </div>
        )}
      </div>
    );
  };

  const renderSummary = () => {
    const summaryData = LEVELS.map(level => {
      const levelKey = level.value;
      const lvl = levelData[levelKey];
      if (!lvl) return null;
      return { levelKey, label: level.label, testCount: lvl.tests.filter(t => t.selected && t.question.trim()).length, practicalCount: (lvl.practical || []).length, nok: lvl.nok || false };
    }).filter(Boolean);
    return (
      <Card title="Сводка по уровням" style={{ marginTop: 24 }}>
        <Table dataSource={summaryData} pagination={false} rowKey="levelKey" columns={[
          { title: 'Уровень', dataIndex: 'label', key: 'label' },
          { title: 'Тестовых заданий', dataIndex: 'testCount', key: 'testCount' },
          { title: 'Практических заданий', dataIndex: 'practicalCount', key: 'practicalCount' },
          { title: 'Пригодно для НОК', dataIndex: 'nok', key: 'nok', render: (nok, record) => <Checkbox checked={nok} onChange={(e) => setLevelData(prev => ({ ...prev, [record.levelKey]: { ...prev[record.levelKey], nok: e.target.checked } }))}>{nok ? 'Да' : 'Нет'}</Checkbox> },
        ]} />
      </Card>
    );
  };

  const renderLevelConstructor = () => {
    if (!selectedLevel) return null;
    const levelLabel = LEVELS.find(l => l.value === selectedLevel)?.label;
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Разработка заданий для уровня: {levelLabel}</h3>
          <Button onClick={() => setSelectedLevel(null)}>Вернуться к выбору уровня</Button>
        </div>
        <Tabs defaultActiveKey="test" type="card">
          <Tabs.TabPane tab="Тестовые задания" key="test">{renderTestTable(selectedLevel)}</Tabs.TabPane>
          <Tabs.TabPane tab="Практические задания" key="practical">{renderPractical(selectedLevel)}</Tabs.TabPane>
        </Tabs>
      </div>
    );
  };

  return (
    <div>
      <Title level={4}>Шаг 6. Разработка оценочных средств</Title>
      <Paragraph>Сначала выберите уровень, для которого будут разрабатываться задания.</Paragraph>
      {!selectedLevel ? (
        <div style={{ marginBottom: 24 }}>
          <Card title="Выберите уровень для разработки оценочных средств">
            <Radio.Group value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} buttonStyle="solid">
              {LEVELS.map(level => <Radio.Button key={level.value} value={level.value}>{level.label}</Radio.Button>)}
            </Radio.Group>
          </Card>
          {renderSummary()}
        </div>
      ) : renderLevelConstructor()}
      {selectedLevel && renderSummary()}
    </div>
  );
};

export default Step6AssessmentTools;
