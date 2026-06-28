import React, { useState, useEffect } from 'react';
import { Tabs, Table, Checkbox, Input, Button, Typography, message, Select, Space, Tag, Row, Col, Card, List, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Типы тестовых заданий
const TEST_TYPES = [
  { value: 'single', label: 'Одиночный выбор' },
  { value: 'multiple', label: 'Множественный выбор' },
  { value: 'match', label: 'Соответствие' },
  { value: 'sequence', label: 'Упорядочивание' },
  { value: 'open', label: 'Открытый вопрос' },
];

// Уровни
const LEVELS = [
  { value: 'basic', label: 'Базовый' },
  { value: 'advanced', label: 'Продвинутый' },
  { value: 'expert', label: 'Экспертный' },
];

const Step6AssessmentTools = ({ data, updateData }) => {
  // Получаем структуру
  const knowledgeItems = data.structure?.A || [];
  const skillsB = data.structure?.B || [];
  const skillsC = data.structure?.C || [];

  // Загружаем сохранённые данные
  const savedTools = data.assessment_tools || {};

  // --- Состояние для выбранного уровня ---
  const [selectedLevel, setSelectedLevel] = useState(null);

  // --- Данные по уровням ---
  // Преобразуем savedTools в структуру по уровням
  const initializeLevelData = () => {
    const levelData = {};
    LEVELS.forEach(level => {
      const levelKey = level.value;
      const savedLevel = savedTools[levelKey] || {};
      // Тесты
      const tests = savedLevel.tests || [];
      // Если тесты пустые, создаём пустые записи для каждого знания
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
      // Практические задания
      const practical = savedLevel.practical || [];
      // Флаг НОК
      const nok = savedLevel.nok || false;

      levelData[levelKey] = {
        tests: testItems,
        practical: practical,
        nok: nok,
        // Для создания нового практического задания – временные поля
        selectedSkillIds: [],
        newTaskText: '',
        newTaskCriteria: '',
      };
    });
    return levelData;
  };

  const [levelData, setLevelData] = useState(() => initializeLevelData());

  // При изменении структуры (добавление/удаление знаний) обновляем тесты
  useEffect(() => {
    setLevelData(prev => {
      const newLevelData = { ...prev };
      LEVELS.forEach(level => {
        const levelKey = level.value;
        const currentTests = newLevelData[levelKey]?.tests || [];
        const existingIds = new Set(currentTests.map(t => t.knowledgeId));
        const newItems = knowledgeItems
          .filter(k => !existingIds.has(k.id))
          .map(k => ({
            knowledgeId: k.id,
            text: k.text,
            selected: false,
            type: 'single',
            question: '',
            options: [],
          }));
        if (newItems.length > 0) {
          newLevelData[levelKey] = {
            ...newLevelData[levelKey],
            tests: [...currentTests, ...newItems],
          };
        }
        // Удаляем знания, которых уже нет
        const knowledgeIds = new Set(knowledgeItems.map(k => k.id));
        const filteredTests = (newLevelData[levelKey]?.tests || []).filter(t => knowledgeIds.has(t.knowledgeId));
        if (filteredTests.length !== (newLevelData[levelKey]?.tests || []).length) {
          newLevelData[levelKey] = {
            ...newLevelData[levelKey],
            tests: filteredTests,
          };
        }
      });
      return newLevelData;
    });
  }, [knowledgeItems]);

  // Сохранение данных в родительское состояние
  useEffect(() => {
    const saved = {};
    LEVELS.forEach(level => {
      const levelKey = level.value;
      const lvl = levelData[levelKey];
      if (!lvl) return;
      // Сохраняем только выбранные и заполненные тесты
      const tests = lvl.tests
        .filter(t => t.selected && t.question.trim())
        .map(t => ({
          knowledgeId: t.knowledgeId,
          componentText: t.text,
          taskType: t.type,
          taskText: t.question,
          options: t.options,
        }));
      const practical = lvl.practical || [];
      saved[levelKey] = {
        tests,
        practical,
        nok: lvl.nok || false,
      };
    });
    updateData({ assessment_tools: saved });
  }, [levelData]);

  // --- Функции для управления тестами в конкретном уровне ---
  const updateTest = (levelKey, knowledgeId, field, value) => {
    setLevelData(prev => {
      const newTests = (prev[levelKey]?.tests || []).map(t =>
        t.knowledgeId === knowledgeId ? { ...t, [field]: value } : t
      );
      return {
        ...prev,
        [levelKey]: { ...prev[levelKey], tests: newTests },
      };
    });
  };

  const addOption = (levelKey, knowledgeId) => {
    setLevelData(prev => {
      const newTests = (prev[levelKey]?.tests || []).map(t =>
        t.knowledgeId === knowledgeId
          ? { ...t, options: [...t.options, { text: '', isCorrect: false }] }
          : t
      );
      return {
        ...prev,
        [levelKey]: { ...prev[levelKey], tests: newTests },
      };
    });
  };

  const removeOption = (levelKey, knowledgeId, index) => {
    setLevelData(prev => {
      const newTests = (prev[levelKey]?.tests || []).map(t =>
        t.knowledgeId === knowledgeId
          ? { ...t, options: t.options.filter((_, i) => i !== index) }
          : t
      );
      return {
        ...prev,
        [levelKey]: { ...prev[levelKey], tests: newTests },
      };
    });
  };

  const updateOption = (levelKey, knowledgeId, index, field, value) => {
    setLevelData(prev => {
      const newTests = (prev[levelKey]?.tests || []).map(t =>
        t.knowledgeId === knowledgeId
          ? { ...t, options: t.options.map((opt, i) => i === index ? { ...opt, [field]: value } : opt) }
          : t
      );
      return {
        ...prev,
        [levelKey]: { ...prev[levelKey], tests: newTests },
      };
    });
  };

  // --- Функции для практических заданий в конкретном уровне ---
  const toggleSkill = (levelKey, skillId) => {
    setLevelData(prev => {
      const lvl = prev[levelKey];
      const currentSelected = lvl.selectedSkillIds || [];
      const newSelected = currentSelected.includes(skillId)
        ? currentSelected.filter(id => id !== skillId)
        : [...currentSelected, skillId];
      return {
        ...prev,
        [levelKey]: { ...lvl, selectedSkillIds: newSelected },
      };
    });
  };

  const addPracticalTask = (levelKey) => {
    const lvl = levelData[levelKey];
    const selectedIds = lvl.selectedSkillIds || [];
    if (selectedIds.length === 0) {
      message.warning('Выберите хотя бы одно умение/навык');
      return;
    }
    const taskText = lvl.newTaskText || '';
    const criteria = lvl.newTaskCriteria || '';
    if (!taskText.trim()) {
      message.warning('Введите текст задания');
      return;
    }
    if (!criteria.trim()) {
      message.warning('Введите критерии оценки');
      return;
    }
    const newTask = {
      id: Date.now() + Math.random(),
      componentIds: selectedIds,
      componentTexts: selectedIds.map(id => {
        const found = [...skillsB, ...skillsC].find(s => s.id === id);
        return found ? found.text : '';
      }),
      taskText,
      criteria,
    };
    setLevelData(prev => {
      const lvl = prev[levelKey];
      const updatedPractical = [...(lvl.practical || []), newTask];
      return {
        ...prev,
        [levelKey]: {
          ...lvl,
          practical: updatedPractical,
          selectedSkillIds: [],
          newTaskText: '',
          newTaskCriteria: '',
        },
      };
    });
    message.success('Задание добавлено');
  };

  const removePracticalTask = (levelKey, taskId) => {
    setLevelData(prev => {
      const lvl = prev[levelKey];
      const updatedPractical = (lvl.practical || []).filter(t => t.id !== taskId);
      return {
        ...prev,
        [levelKey]: { ...lvl, practical: updatedPractical },
      };
    });
    message.success('Задание удалено');
  };

  const updatePracticalField = (levelKey, field, value) => {
    setLevelData(prev => {
      const lvl = prev[levelKey];
      return {
        ...prev,
        [levelKey]: { ...lvl, [field]: value },
      };
    });
  };

  // --- Вспомогательные функции для отображения ---
  const usedSkillIds = (levelKey) => {
    const practical = levelData[levelKey]?.practical || [];
    const ids = new Set();
    practical.forEach(task => task.componentIds.forEach(id => ids.add(id)));
    return ids;
  };

  const isSkillUsed = (levelKey, skillId) => {
    return usedSkillIds(levelKey).has(skillId);
  };

  // --- Рендер тестовой таблицы для уровня ---
  const renderTestTable = (levelKey) => {
    const tests = levelData[levelKey]?.tests || [];
    if (knowledgeItems.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Нет знаний для разработки тестовых заданий.</div>;
    }

    const testColumns = [
      {
        title: 'Выбрать',
        dataIndex: 'selected',
        key: 'selected',
        width: 80,
        render: (selected, record) => (
          <Checkbox
            checked={selected}
            onChange={(e) => updateTest(levelKey, record.knowledgeId, 'selected', e.target.checked)}
          />
        ),
      },
      {
        title: 'Знание',
        dataIndex: 'text',
        key: 'text',
        render: (text) => <strong>{text}</strong>,
      },
      {
        title: 'Тип задания',
        dataIndex: 'type',
        key: 'type',
        width: 180,
        render: (type, record) => (
          <Select
            value={type}
            onChange={(val) => updateTest(levelKey, record.knowledgeId, 'type', val)}
            style={{ width: '100%' }}
            disabled={!record.selected}
          >
            {TEST_TYPES.map(t => (
              <Option key={t.value} value={t.value}>{t.label}</Option>
            ))}
          </Select>
        ),
      },
      {
        title: 'Текст вопроса',
        dataIndex: 'question',
        key: 'question',
        render: (text, record) => (
          <TextArea
            rows={2}
            value={text}
            onChange={(e) => updateTest(levelKey, record.knowledgeId, 'question', e.target.value)}
            placeholder="Введите текст вопроса..."
            disabled={!record.selected}
          />
        ),
      },
    ];

    const expandedRowRender = (record) => {
      if (!record.selected) return null;
      const isSingleOrMultiple = ['single', 'multiple'].includes(record.type);

      return (
        <div style={{ margin: '16px 0', padding: '16px', background: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
            {record.type === 'match' || record.type === 'sequence' ? 'Варианты (порядок = правильный ответ)' : 'Варианты ответов:'}
          </div>
          {record.options.map((opt, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
              {isSingleOrMultiple && (
                <Col span={2}>
                  <Checkbox
                    checked={opt.isCorrect}
                    onChange={(e) => updateOption(levelKey, record.knowledgeId, idx, 'isCorrect', e.target.checked)}
                  />
                </Col>
              )}
              <Col span={isSingleOrMultiple ? 20 : 22}>
                <Input
                  value={opt.text}
                  onChange={(e) => updateOption(levelKey, record.knowledgeId, idx, 'text', e.target.value)}
                  placeholder={`Вариант ${idx+1}`}
                />
              </Col>
              <Col span={2}>
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => removeOption(levelKey, record.knowledgeId, idx)}
                  danger
                />
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => addOption(levelKey, record.knowledgeId)}
          >
            Добавить вариант
          </Button>
          {record.type === 'match' && (
            <div style={{ marginTop: 8, color: '#888', fontSize: '0.8em' }}>
              Для соответствия: каждая пара — это вариант, где левая часть = правая часть (записывайте в одном варианте как "левая → правая").
            </div>
          )}
          {record.type === 'sequence' && (
            <div style={{ marginTop: 8, color: '#888', fontSize: '0.8em' }}>
              Для упорядочивания: варианты должны быть перечислены в правильном порядке.
            </div>
          )}
        </div>
      );
    };

    return (
      <Table
        dataSource={tests}
        columns={testColumns}
        pagination={false}
        rowKey="knowledgeId"
        expandable={{
          expandedRowRender,
          rowExpandable: record => record.selected,
        }}
        style={{ marginTop: 16 }}
      />
    );
  };

  // --- Рендер практической части для уровня ---
  const renderPractical = (levelKey) => {
    const lvl = levelData[levelKey];
    if (!lvl) return null;
    const used = usedSkillIds(levelKey);
    const selectedIds = lvl.selectedSkillIds || [];

    return (
      <div>
        <Row gutter={16}>
          <Col span={12}>
            <Card title="B – Умения / интеллектуальные навыки" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skillsB.map(skill => {
                  const usedFlag = used.has(skill.id);
                  const selected = selectedIds.includes(skill.id);
                  return (
                    <Button
                      key={skill.id}
                      type={usedFlag ? 'default' : (selected ? 'primary' : 'default')}
                      onClick={() => !usedFlag && toggleSkill(levelKey, skill.id)}
                      style={{
                        marginBottom: 4,
                        backgroundColor: usedFlag ? '#f6ffed' : (selected ? '' : ''),
                        borderColor: usedFlag ? '#b7eb8f' : '',
                        color: usedFlag ? '#389e0d' : '',
                        cursor: usedFlag ? 'not-allowed' : 'pointer',
                      }}
                      disabled={usedFlag}
                    >
                      {skill.text} {usedFlag && <CheckCircleOutlined />}
                    </Button>
                  );
                })}
                {skillsB.length === 0 && <span style={{ color: '#999' }}>Нет умений</span>}
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="C – Практические навыки" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skillsC.map(skill => {
                  const usedFlag = used.has(skill.id);
                  const selected = selectedIds.includes(skill.id);
                  return (
                    <Button
                      key={skill.id}
                      type={usedFlag ? 'default' : (selected ? 'primary' : 'default')}
                      onClick={() => !usedFlag && toggleSkill(levelKey, skill.id)}
                      style={{
                        marginBottom: 4,
                        backgroundColor: usedFlag ? '#f6ffed' : (selected ? '' : ''),
                        borderColor: usedFlag ? '#b7eb8f' : '',
                        color: usedFlag ? '#389e0d' : '',
                        cursor: usedFlag ? 'not-allowed' : 'pointer',
                      }}
                      disabled={usedFlag}
                    >
                      {skill.text} {usedFlag && <CheckCircleOutlined />}
                    </Button>
                  );
                })}
                {skillsC.length === 0 && <span style={{ color: '#999' }}>Нет навыков</span>}
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}><strong>Выбрано умений/навыков: {selectedIds.length}</strong></div>
          {selectedIds.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <label>Текст комплексного задания:</label>
                <TextArea
                  rows={4}
                  value={lvl.newTaskText || ''}
                  onChange={(e) => updatePracticalField(levelKey, 'newTaskText', e.target.value)}
                  placeholder="Опишите задание, которое проверяет выбранные умения..."
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>Критерии оценки:</label>
                <TextArea
                  rows={3}
                  value={lvl.newTaskCriteria || ''}
                  onChange={(e) => updatePracticalField(levelKey, 'newTaskCriteria', e.target.value)}
                  placeholder="Опишите критерии оценки выполнения..."
                />
              </div>
              <Button type="primary" onClick={() => addPracticalTask(levelKey)} icon={<PlusOutlined />}>
                Добавить задание
              </Button>
            </div>
          )}
        </div>

        {/* Список добавленных практических заданий для этого уровня */}
        {(lvl.practical || []).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Title level={5}>Созданные практические задания</Title>
            <List
              dataSource={lvl.practical || []}
              renderItem={task => (
                <List.Item
                  actions={[
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removePracticalTask(levelKey, task.id)}>
                      Удалить
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={task.taskText}
                    description={
                      <div>
                        <div><strong>Умения:</strong> {task.componentTexts.join(', ')}</div>
                        <div><strong>Критерии:</strong> {task.criteria}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    );
  };

  // --- Сводка по всем уровням ---
  const renderSummary = () => {
    const summaryData = LEVELS.map(level => {
      const levelKey = level.value;
      const lvl = levelData[levelKey];
      if (!lvl) return null;
      const testCount = lvl.tests.filter(t => t.selected && t.question.trim()).length;
      const practicalCount = (lvl.practical || []).length;
      const nok = lvl.nok || false;
      return { levelKey, label: level.label, testCount, practicalCount, nok };
    }).filter(Boolean);

    return (
      <Card title="Сводка по уровням" style={{ marginTop: 24 }}>
        <Table
          dataSource={summaryData}
          pagination={false}
          rowKey="levelKey"
          columns={[
            { title: 'Уровень', dataIndex: 'label', key: 'label' },
            { title: 'Тестовых заданий', dataIndex: 'testCount', key: 'testCount' },
            { title: 'Практических заданий', dataIndex: 'practicalCount', key: 'practicalCount' },
            {
              title: 'Пригодно для НОК',
              dataIndex: 'nok',
              key: 'nok',
              render: (nok, record) => (
                <Checkbox
                  checked={nok}
                  onChange={(e) => {
                    setLevelData(prev => ({
                      ...prev,
                      [record.levelKey]: { ...prev[record.levelKey], nok: e.target.checked },
                    }));
                  }}
                >
                  {nok ? 'Да' : 'Нет'}
                </Checkbox>
              ),
            },
          ]}
        />
      </Card>
    );
  };

  // --- Рендер конструктора для выбранного уровня ---
  const renderLevelConstructor = () => {
    if (!selectedLevel) return null;
    const levelKey = selectedLevel;
    const levelLabel = LEVELS.find(l => l.value === levelKey)?.label;

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Разработка заданий для уровня: {levelLabel}</h3>
          <Button onClick={() => setSelectedLevel(null)}>Вернуться к выбору уровня</Button>
        </div>
        <Tabs defaultActiveKey="test" type="card">
          <Tabs.TabPane tab="Тестовые задания" key="test">
            {renderTestTable(levelKey)}
          </Tabs.TabPane>
          <Tabs.TabPane tab="Практические задания" key="practical">
            {renderPractical(levelKey)}
          </Tabs.TabPane>
        </Tabs>
      </div>
    );
  };

  // --- Главный рендер ---
  return (
    <div>
      <Title level={4}>Шаг 6. Разработка оценочных средств</Title>
      <Paragraph>
        Сначала выберите уровень (Базовый, Продвинутый или Экспертный), для которого будут разрабатываться задания.
        После выбора уровня вы сможете создавать тестовые и практические задания. В сводке внизу вы увидите количество заданий по каждому уровню и сможете отметить, пригодно ли оценочное средство для НОК.
      </Paragraph>

      {!selectedLevel ? (
        // Выбор уровня
        <div style={{ marginBottom: 24 }}>
          <Card title="Выберите уровень для разработки оценочных средств">
            <Radio.Group
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              buttonStyle="solid"
            >
              {LEVELS.map(level => (
                <Radio.Button key={level.value} value={level.value}>
                  {level.label}
                </Radio.Button>
              ))}
            </Radio.Group>
            <div style={{ marginTop: 8, color: '#888' }}>
              Выберите уровень, затем перейдите к разработке заданий.
            </div>
          </Card>
          {renderSummary()}
        </div>
      ) : (
        renderLevelConstructor()
      )}

      {selectedLevel && renderSummary()}

      <style>{`
        .ant-table-expanded-row > td {
          padding: 0 !important;
        }
        .ant-table-expanded-row .ant-table-cell {
          padding: 16px !important;
        }
      `}</style>
    </div>
  );
};

export default Step6AssessmentTools;