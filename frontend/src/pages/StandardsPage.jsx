import React, { useState, useEffect } from 'react';
import { Upload, Button, List, message, Tabs, Modal, Spin, Switch } from 'antd';
import { UploadOutlined, ReloadOutlined, ThunderboltOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import {
  uploadFile,
  getStandards,
  getStandard,
  fetchBulkRegistry,
  getEnrichedStandards,
  getEnrichedStandard,
  runEnrichment
} from '../api';
import StandardTree from '../components/StandardTree';
import StandardCardGraph from '../components/StandardCardGraph';

const { TabPane } = Tabs;

const MIN_MODAL_DISPLAY_TIME = 800;

const StandardsPage = () => {
  const [standards, setStandards] = useState([]);
  const [enrichedStandards, setEnrichedStandards] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('raw');
  const [viewMode, setViewMode] = useState('tree');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalText, setModalText] = useState('');
  const [modalSpinning, setModalSpinning] = useState(false);

  // Загрузка списка сырых стандартов
  const loadRawList = async () => {
    try {
      const res = await getStandards();
      setStandards(res.data);
    } catch (err) {
      message.error('Ошибка загрузки сырых стандартов');
    }
  };

  // Загрузка списка обогащённых стандартов
  const loadEnrichedList = async () => {
    try {
      const res = await getEnrichedStandards();
      setEnrichedStandards(res.data);
    } catch (err) {
      message.error('Ошибка загрузки обогащённых стандартов');
    }
  };

  useEffect(() => {
    loadRawList();
    loadEnrichedList();
  }, []);

  // Обработчик загрузки XML-файла
  const handleUpload = async (file) => {
    setLoading(true);
    try {
      await uploadFile(file);
      message.success('Файл загружен');
      await loadRawList();
    } catch (err) {
      message.error('Ошибка загрузки: ' + err.response?.data?.detail);
    } finally {
      setLoading(false);
    }
    return false;
  };

  // Массовая загрузка из реестра
  const handleFetchBulk = async () => {
    setBulkLoading(true);
    setModalVisible(true);
    setModalTitle('Загрузка стандартов из реестра');
    setModalText('Идёт сбор и загрузка данных...');
    setModalSpinning(true);
    const startTime = Date.now();

    try {
      const res = await fetchBulkRegistry();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

      setModalText(`Загружено ${res.data.loaded?.length || 0} стандартов`);
      message.success(`Загружено ${res.data.loaded?.length || 0} стандартов`);
      await loadRawList();
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

      message.error('Ошибка при массовой загрузке');
      setModalText('Ошибка загрузки');
    } finally {
      setBulkLoading(false);
      setModalSpinning(false);
      setModalVisible(false);
    }
  };

  // Запуск обогащения
  const handleRunEnrichment = async () => {
    setEnrichLoading(true);
    setModalVisible(true);
    setModalTitle('Обогащение стандартов');
    setModalText('Идёт обогащение данных...');
    setModalSpinning(true);
    const startTime = Date.now();

    try {
      const res = await runEnrichment();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

      setModalText(`Обогащено ${res.data.processed?.length || 0} стандартов`);
      message.success(`Обогащено ${res.data.processed?.length || 0} стандартов`);
      await loadEnrichedList();
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

      message.error('Ошибка при обогащении');
      setModalText('Ошибка обогащения');
    } finally {
      setEnrichLoading(false);
      setModalSpinning(false);
      setModalVisible(false);
    }
  };

  // Выбор сырого стандарта
  const handleSelectRaw = async (regNumber) => {
    try {
      const res = await getStandard(regNumber);
      setSelected({ ...res.data, type: 'raw' });
    } catch (err) {
      message.error('Ошибка получения данных');
    }
  };

  // Выбор обогащённого стандарта
  const handleSelectEnriched = async (regNumber) => {
    try {
      const res = await getEnrichedStandard(regNumber);
      setSelected({ ...res.data, type: 'enriched' });
    } catch (err) {
      message.error('Ошибка получения обогащённых данных');
    }
  };

  // Рендер списка стандартов
  const renderStandardList = (items, onSelect) => (
    <List
      dataSource={items}
      renderItem={item => (
        <List.Item
          onClick={() => onSelect(item.reg_number)}
          style={{ cursor: 'pointer', borderBottom: '1px solid #ddd' }}
        >
          <div>
            <strong>{item.name}</strong><br />
            <small>Рег. № {item.reg_number}</small>
          </div>
        </List.Item>
      )}
    />
  );

  return (
    <div style={{ padding: '24px' }}>
      {/* Кнопки управления */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />} loading={loading}>Загрузить XML</Button>
        </Upload>
        <Button onClick={handleFetchBulk} loading={bulkLoading} type="primary" icon={<ReloadOutlined />}>
          Загрузить все стандарты (bulk)
        </Button>
        <Button onClick={handleRunEnrichment} loading={enrichLoading} icon={<ThunderboltOutlined />}>
          Обогатить все
        </Button>
        <Switch
          checkedChildren={<AppstoreOutlined />}
          unCheckedChildren={<UnorderedListOutlined />}
          checked={viewMode === 'cards'}
          onChange={(checked) => setViewMode(checked ? 'cards' : 'tree')}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Основная область */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Левый список стандартов */}
        <div style={{ flex: '0 0 300px', background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: '80vh', overflow: 'auto' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="Сырые" key="raw">
              {renderStandardList(standards, handleSelectRaw)}
            </TabPane>
            <TabPane tab="Обогащённые" key="enriched">
              {renderStandardList(enrichedStandards, handleSelectEnriched)}
            </TabPane>
          </Tabs>
        </div>

        {/* Правая область отображения выбранного стандарта */}
        <div style={{ flex: 1, background: '#fff', padding: 16, borderRadius: 8, maxHeight: '80vh', overflow: 'auto' }}>
          {selected ? (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>{selected.name}</span>
                <span style={{ fontSize: '12px', color: '#888' }}>Рег. № {selected.reg_number}</span>
              </div>
              {viewMode === 'tree' ? (
                <StandardTree data={selected} />
              ) : (
                <StandardCardGraph standard={selected} />
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
              Выберите стандарт из списка слева
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно прогресса */}
      <Modal
        title={modalTitle}
        visible={modalVisible}
        footer={null}
        closable={false}
        maskClosable={false}
        width={400}
        centered
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin spinning={modalSpinning} size="large" />
          <div style={{ marginTop: 16, fontSize: 14, color: '#888' }}>
            {modalText}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StandardsPage;