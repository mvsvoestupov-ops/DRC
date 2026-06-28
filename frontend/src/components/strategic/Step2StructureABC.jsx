import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, List, Modal, Input, Select, message, Space, Tag, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

let idCounter = 0;
const genId = () => ++idCounter;

const Step2StructureABC = ({ data, updateData }) => {
  const [structure, setStructure] = useState(() => {
    const initial = data.structure || { A: [], B: [], C: [] };
    ['A', 'B', 'C'].forEach(key => {
      initial[key] = (initial[key] || []).map(item => ({
        ...item,
        id: item.id || genId(),
      }));
    });
    return initial;
  });

  const [laborActionOptions, setLaborActionOptions] = useState([]);

  const [modalVisible, setModalVisible] = useState({ A: false, B: false, C: false });
  const [newItemText, setNewItemText] = useState('');
  const [newItemTfCode, setNewItemTfCode] = useState(null);

  useEffect(() => {
    if (data.structure) {
      const newStructure = { ...data.structure };
      ['A', 'B', 'C'].forEach(key => {
        newStructure[key] = (newStructure[key] || []).map(item => ({
          ...item,
          id: item.id || genId(),
        }));
      });
      setStructure(newStructure);
    }
  }, [data.structure]);

  useEffect(() => {
    const selectedLaborFunctions = data.selected_labor_functions || [];
    console.log('Step2StructureABC: selected_labor_functions', selectedLaborFunctions);
    if (selectedLaborFunctions.length === 0) return;

    const allKnowledge = [];
    const allSkills = [];
    const options = [];

    selectedLaborFunctions.forEach(tf => {
      const tfCode = tf.code;
      (tf.labor_actions || []).forEach((la, idx) => {
        const tdText = la.text || `ТД ${idx+1}`;
        const key = `${tfCode}-${idx}`;
        options.push({
          value: key,
          label: `${tfCode} – ${tdText}`,
        });

        (la.knowledges || []).forEach(k => {
          allKnowledge.push({
            text: k.text || k,
            tfCode: tfCode,
            tdText: tdText,
          });
        });
        (la.skills || []).forEach(s => {
          allSkills.push({
            text: s.text || s,
            tfCode: tfCode,
            tdText: tdText,
          });
        });
      });
    });

    setLaborActionOptions(options);

    setStructure(prev => {
      const newA = prev.A.length === 0 ? allKnowledge.map(item => ({ ...item, id: genId() })) : prev.A;
      const newB = prev.B.length === 0 ? allSkills.map(item => ({ ...item, id: genId() })) : prev.B;
      return { ...prev, A: newA, B: newB };
    });
  }, [data.selected_labor_functions]);

  const updateStructure = (newStructure) => {
    setStructure(newStructure);
    updateData({ structure: newStructure });
  };

  const addItem = (container) => {
    if (!newItemText.trim()) {
      message.warning('Введите текст');
      return;
    }
    let tfCode = null, tdText = null;
    if (container === 'A' || container === 'B') {
      if (!newItemTfCode) {
        message.warning('Выберите трудовое действие');
        return;
      }
      const selected = laborActionOptions.find(opt => opt.value === newItemTfCode);
      if (selected) {
        tfCode = selected.value.split('-')[0];
        tdText = selected.label;
      }
    }
    const newItem = {
      id: genId(),
      text: newItemText.trim(),
      tfCode: container === 'C' ? null : tfCode,
      tdText: container === 'C' ? null : tdText,
    };
    const newStructure = {
      ...structure,
      [container]: [...structure[container], newItem],
    };
    updateStructure(newStructure);
    setNewItemText('');
    setNewItemTfCode(null);
    setModalVisible({ ...modalVisible, [container]: false });
    message.success('Элемент добавлен');
  };

  const deleteItem = (container, id) => {
    const newStructure = {
      ...structure,
      [container]: structure[container].filter(item => item.id !== id),
    };
    updateStructure(newStructure);
  };

  const moveToC = (id) => {
    const item = structure.B.find(el => el.id === id);
    if (!item) return;
    const newB = structure.B.filter(el => el.id !== id);
    const newC = [...structure.C, { ...item, tfCode: null, tdText: null }];
    const newStructure = { ...structure, B: newB, C: newC };
    updateStructure(newStructure);
    message.success('Умение перенесено в практические навыки');
  };

  const renderItemList = (items, container, showTd = true, showMove = false) => {
    if (items.length === 0) {
      return <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>Нет элементов</div>;
    }
    return (
      <List
        size="small"
        dataSource={items}
        renderItem={item => (
          <List.Item
            actions={[
              showMove && (
                <Tooltip title="Перенести в практические навыки">
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    onClick={() => moveToC(item.id)}
                    style={{ color: '#1890ff' }}
                  />
                </Tooltip>
              ),
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => deleteItem(container, item.id)}
                danger
              />,
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={
                <Space>
                  <span>{item.text}</span>
                  {showTd && item.tdText && (
                    <Tag color="blue" style={{ fontSize: '0.7em' }}>{item.tfCode}</Tag>
                  )}
                </Space>
              }
              description={showTd && item.tdText ? `ТД: ${item.tdText}` : null}
            />
          </List.Item>
        )}
      />
    );
  };

  const renderModal = (container) => {
    const isC = container === 'C';
    return (
      <Modal
        title={`Добавить элемент в ${container === 'A' ? 'Знания' : container === 'B' ? 'Умения' : 'Практические навыки'}`}
        open={modalVisible[container]}
        onCancel={() => setModalVisible({ ...modalVisible, [container]: false })}
        onOk={() => addItem(container)}
        okText="Добавить"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 16 }}>
          <label>Текст:</label>
          <TextArea
            rows={3}
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            placeholder="Введите описание..."
          />
        </div>
        {!isC && (
          <div>
            <label>Привязать к трудовому действию:</label>
            <Select
              value={newItemTfCode}
              onChange={setNewItemTfCode}
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Выберите ТД"
            >
              {laborActionOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
    );
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title="A – Знания"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible({ ...modalVisible, A: true })}
              >
                Добавить
              </Button>
            }
            style={{ height: '100%' }}
          >
            {renderItemList(structure.A, 'A', true, false)}
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="B – Умения / интеллектуальные навыки"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible({ ...modalVisible, B: true })}
              >
                Добавить
              </Button>
            }
            style={{ height: '100%' }}
          >
            {renderItemList(structure.B, 'B', true, true)}
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="C – Практические навыки"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible({ ...modalVisible, C: true })}
              >
                Добавить
              </Button>
            }
            style={{ height: '100%' }}
          >
            {renderItemList(structure.C, 'C', false, false)}
          </Card>
        </Col>
      </Row>

      {renderModal('A')}
      {renderModal('B')}
      {renderModal('C')}
    </div>
  );
};

export default Step2StructureABC;