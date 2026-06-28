import React from 'react';
import { Collapse, Tag, Space, Typography } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';

const { Panel } = Collapse;
const { Text } = Typography;

const StandardStructureViewer = ({ standard }) => {
  if (!standard) return <div>Нет данных</div>;

  // Диагностика: выводим структуру в консоль
  console.log('StandardStructureViewer получил:', standard);
  console.log('generalized_functions:', standard.generalized_functions);

  const renderList = (items, label) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginLeft: 16, marginBottom: 8 }}>
        <Text type="secondary" strong>{label}:</Text>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          {items.map((item, idx) => {
            const value = typeof item === 'string' ? item : item.text || item;
            return <li key={idx}>{value}</li>;
          })}
        </ul>
      </div>
    );
  };

  const functions = standard.generalized_functions || [];
  if (functions.length === 0) {
    return <div>В этом стандарте нет трудовых функций</div>;
  }

  // Генерируем ключи для внешнего Collapse – все ОТФ открыты по умолчанию
  const outerDefaultActiveKeys = functions.map((_, idx) => String(idx));

  return (
    <Collapse defaultActiveKey={outerDefaultActiveKeys} expandIconPosition="end">
      {functions.map((gf, gfIdx) => {
        const particularFunctions = gf.particular_functions || [];
        // Ключи для внутреннего Collapse – все ТФ открыты
        const innerDefaultActiveKeys = particularFunctions.map((_, idx) => `${gfIdx}-${idx}`);

        console.log(`ОТФ ${gf.code}: ТФ =`, particularFunctions);

        return (
          <Panel
            header={
              <Space>
                <FolderOutlined />
                <Tag color="blue">{gf.code}</Tag>
                <Text strong>{gf.name}</Text>
              </Space>
            }
            key={String(gfIdx)}
          >
            {gf.level && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Уровень квалификации: {gf.level}</Text>
              </div>
            )}
            {gf.possible_job_titles && gf.possible_job_titles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Возможные должности: </Text>
                <Text>{gf.possible_job_titles.join(', ')}</Text>
              </div>
            )}

            <Collapse defaultActiveKey={innerDefaultActiveKeys} expandIconPosition="end">
              {particularFunctions.map((pf, pfIdx) => {
                console.log(`  ТФ ${pf.code}: labor_actions =`, pf.labor_actions);
                return (
                  <Panel
                    header={
                      <Space>
                        <FileOutlined />
                        <Tag color="green">{pf.code}</Tag>
                        <Text strong>{pf.name}</Text>
                      </Space>
                    }
                    key={`${gfIdx}-${pfIdx}`}
                  >
                    {renderList(pf.labor_actions, 'Трудовые действия (ТД)')}
                    {renderList(pf.required_skills || pf.skills, 'Умения (У)')}
                    {renderList(pf.necessary_knowledges || pf.knowledges, 'Знания (З)')}
                  </Panel>
                );
              })}
            </Collapse>
          </Panel>
        );
      })}
    </Collapse>
  );
};

export default StandardStructureViewer;