import React, { useState } from 'react';
import { Modal, Descriptions, Button } from 'antd';

const CardComponent = ({ label, sub, type, onClick, sticky = false, topOffset = 12 }) => {
  const getColor = () => {
    switch (type) {
      case 'otf': return '#ffffff';
      case 'tf': return '#f3e5f5';
      case 'td': return '#fff3e0';
      case 'skill': return '#e8f5e9';
      case 'knowledge': return '#e3f2fd';
      default: return '#ffffff';
    }
  };

  const borderColor = {
    otf: '#e0e0e0',
    tf: '#ce93d8',
    td: '#ffb74d',
    skill: '#81c784',
    knowledge: '#64b5f6'
  }[type] || '#e0e0e0';

  const stickyStyle = sticky ? {
    position: 'sticky',
    top: `${topOffset}px`,
    zIndex: type === 'otf' ? 3 : type === 'tf' ? 2 : 1,
    background: getColor(),
  } : {};

  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: '8px',
        background: getColor(),
        border: `1px solid ${borderColor}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        width: '100%',
        fontSize: '12px',
        lineHeight: '1.3',
        color: '#333',
        marginBottom: '4px',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        ...stickyStyle,
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: '#888' }}>{sub}</div>}
    </div>
  );
};

const StandardCardGraph = ({ standard }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState(null);

  const showModal = (data, type) => {
    if (!data) return;
    let fields = [];
    let title = '';
    if (type === 'otf') {
      title = `ОТФ ${data.code || ''}: ${data.name || ''}`;
      fields = [
        { label: 'Код', value: data.code || '—' },
        { label: 'Уровень квалификации', value: data.level || '—' },
        { label: 'Возможные должности', value: data.possible_job_titles?.join(', ') || '—' },
        { label: 'ОКЗ', value: data.okz_codes?.length ? data.okz_codes.join(', ') : '—' },
        { label: 'ОКПДТР', value: data.okpdtr_codes?.length ? data.okpdtr_codes.join(', ') : '—' },
        { label: 'ОКСО', value: data.okso_codes?.length ? data.okso_codes.join(', ') : '—' }
      ];
    } else if (type === 'tf') {
      const parentOtf = standard.generalized_functions?.find(gf =>
        gf.particular_functions?.some(pf => pf.code === data.code)
      );
      const gf = parentOtf || {};
      title = `ТФ ${data.code || ''}: ${data.name || ''}`;
      fields = [
        { label: 'Код ТФ', value: data.code || '—' },
        { label: 'Подуровень', value: data.sub_qualification || '—' },
        { label: 'ОКЗ (ОТФ)', value: gf.okz_codes?.length ? gf.okz_codes.join(', ') : '—' },
        { label: 'ОКПДТР (ОТФ)', value: gf.okpdtr_codes?.length ? gf.okpdtr_codes.join(', ') : '—' },
        { label: 'ОКСО (ОТФ)', value: gf.okso_codes?.length ? gf.okso_codes.join(', ') : '—' }
      ];
    }
    setModalData({ title, fields });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalData(null);
  };

  if (!standard || !standard.generalized_functions) {
    return <div>Нет данных для отображения</div>;
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      {standard.generalized_functions.map((gf, gfIdx) => {
        const rows = gf.particular_functions || [];
        if (rows.length === 0) return null;

        return (
          <div
            key={gf.code || gfIdx}
            style={{
              marginBottom: '24px',
              borderBottom: '1px solid #e8e8e8',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Колонка ОТФ */}
              <div style={{ flex: '0 0 180px', minWidth: '180px' }}>
                <CardComponent
                  label={`${gf.code || 'ОТФ'}: ${gf.name}`}
                  sub={`Уровень ${gf.level || ''}`}
                  type="otf"
                  sticky={true}
                  topOffset={12}
                  onClick={() => showModal(gf, 'otf')}
                />
              </div>

              {/* Контейнер для всех ТФ */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {rows.map((pf, pfIdx) => {
                  const laborActions = pf.labor_actions || [];
                  const hasData = laborActions.length > 0;

                  return (
                    <div
                      key={pf.code || pfIdx}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                        minHeight: '40px',
                      }}
                    >
                      {/* Колонка ТФ – здесь должен быть sticky */}
                      <div style={{ flex: '0 0 180px', minWidth: '180px' }}>
                        <CardComponent
                          label={`${pf.code || 'ТФ'}: ${pf.name}`}
                          type="tf"
                          sticky={true}
                          topOffset={12}
                          onClick={() => showModal(pf, 'tf')}
                        />
                      </div>

                      {/* Контейнер для ТД и З/У */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {laborActions.map((la, laIdx) => {
                          const skills = la.skills || [];
                          const knowledges = la.knowledges || [];
                          const allItems = [...skills, ...knowledges];
                          return (
                            <div
                              key={laIdx}
                              style={{
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                marginBottom: '8px',
                              }}
                            >
                              <div style={{ flex: '0 0 30%', minWidth: '200px' }}>
                                <CardComponent
                                  label={`ТД ${laIdx+1}: ${la.text}`}
                                  type="td"
                                  sticky={true}
                                  topOffset={12 + 30 * laIdx}
                                />
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {allItems.length === 0 ? (
                                  <div style={{ height: '24px', fontSize: '11px', color: '#999' }}>—</div>
                                ) : (
                                  allItems.map((item, itemIdx) => {
                                    const isSkill = itemIdx < skills.length;
                                    const prefix = isSkill ? 'У' : 'З';
                                    return (
                                      <CardComponent
                                        key={itemIdx}
                                        label={`${prefix} ${itemIdx+1}: ${item.text}`}
                                        type={isSkill ? 'skill' : 'knowledge'}
                                      />
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!hasData && <div style={{ height: '24px', fontSize: '11px', color: '#999' }}>—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <Modal
        title={modalData?.title || 'Детали'}
        visible={modalVisible}
        onCancel={closeModal}
        footer={[<Button key="close" onClick={closeModal}>Закрыть</Button>]}
        width={600}
      >
        {modalData && (
          <Descriptions column={1} bordered>
            {modalData.fields.map((field, idx) => (
              <Descriptions.Item key={idx} label={field.label}>
                {field.value}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default StandardCardGraph;