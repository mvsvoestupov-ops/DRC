import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Table, Input, Select, Button, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const CONTROL_OPTIONS = ['зачёт', 'экзамен', 'защита проекта', 'курсовая работа', 'отчёт по практике'];

// Компонент для ресайза заголовка
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

const Step4DisciplineMapping = ({ data, updateData }) => {
  // Получаем все компоненты из A, B и C
  const componentsFromABC = useMemo(() => {
    const A = data.structure?.A || [];
    const B = data.structure?.B || [];
    const C = data.structure?.C || [];
    const list = [];
    A.forEach(item => {
      list.push({ ...item, category: 'A (Знания)' });
    });
    B.forEach(item => {
      list.push({ ...item, category: 'B (Умения / интеллектуальные навыки)' });
    });
    C.forEach(item => {
      list.push({ ...item, category: 'C (Практические навыки)' });
    });
    return list;
  }, [data.structure]);

  // Инициализация mapping – только компоненты из A/B/C
  const initializeMapping = () => {
    const existing = data.discipline_mapping || [];
    const existingIds = new Set(existing.map(item => item.id));
    // Оставляем только те записи, которые есть в componentsFromABC
    const filteredExisting = existing.filter(item => componentsFromABC.some(c => c.id === item.id));
    // Добавляем новые компоненты, которых ещё нет в mapping
    const newItems = componentsFromABC
      .filter(c => !existingIds.has(c.id))
      .map(c => ({
        id: c.id,
        text: c.text,
        category: c.category,
        discipline: '',
        hours: '',
        control: '',
      }));
    return [...filteredExisting, ...newItems];
  };

  const [mapping, setMapping] = useState(() => initializeMapping());
  const [allDisciplines, setAllDisciplines] = useState(() => {
    const existing = data.discipline_mapping || [];
    const disciplines = existing.map(item => item.discipline).filter(Boolean);
    return [...new Set(disciplines)];
  });

  // Состояние для ширины колонок
  const [columnWidths, setColumnWidths] = useState({
    component: 250,
    discipline: 280,
    hours: 120,
    control: 150,
  });

  const currentRowIndex = useRef(null);

  // Обновление родительского состояния при изменении mapping
  useEffect(() => {
    updateData({ discipline_mapping: mapping });
  }, [mapping]);

  // Если componentsFromABC изменился (например, вернулись на шаг 2), обновляем mapping
  useEffect(() => {
    const currentIds = new Set(mapping.map(item => item.id));
    const newComponents = componentsFromABC.filter(c => !currentIds.has(c.id));
    if (newComponents.length > 0) {
      const newItems = newComponents.map(c => ({
        id: c.id,
        text: c.text,
        category: c.category,
        discipline: '',
        hours: '',
        control: '',
      }));
      setMapping(prev => [...prev, ...newItems]);
    }
    // Удаляем компоненты, которых уже нет в A/B/C
    const componentIds = new Set(componentsFromABC.map(c => c.id));
    setMapping(prev => prev.filter(item => componentIds.has(item.id)));
  }, [componentsFromABC]);

  const updateRow = (index, field, value) => {
    const newMapping = mapping.map((row, i) => i === index ? { ...row, [field]: value } : row);
    setMapping(newMapping);
  };

  // Функция добавления новой дисциплины (только в список, не добавляет строки)
  const addDiscipline = (index, inputValue) => {
    const val = inputValue?.trim();
    if (!val || val.length < 3) {
      message.warning('Введите не менее 3 символов для новой дисциплины');
      return;
    }
    setAllDisciplines(prev => {
      if (!prev.includes(val)) {
        return [...prev, val];
      }
      return prev;
    });
    updateRow(index, 'discipline', val);
    currentRowIndex.current = null;
    message.success(`Дисциплина "${val}" добавлена`);
  };

  // Обработчик изменения ширины колонки
  const handleResize = (key) => (e, { size }) => {
    setColumnWidths(prev => ({
      ...prev,
      [key]: size.width,
    }));
  };

  const columns = [
    {
      title: 'Компонент (A/B/C)',
      dataIndex: 'text',
      key: 'component',
      width: columnWidths.component,
      render: (text, record) => (
        <div>
          <div><strong>{text}</strong></div>
          <div style={{ fontSize: '0.8em', color: '#888' }}>{record.category}</div>
        </div>
      ),
    },
    {
      title: 'Дисциплина / Модуль / Практика',
      dataIndex: 'discipline',
      key: 'discipline',
      width: columnWidths.discipline,
      render: (text, record, index) => (
        <Select
          value={text || undefined}
          onChange={(value) => updateRow(index, 'discipline', value)}
          style={{ width: '100%' }}
          placeholder="Введите или выберите"
          showSearch
          allowClear
          optionFilterProp="children"
          onSearch={(value) => {
            currentRowIndex.current = index;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const input = e.target;
              const val = input.value;
              if (val && val.trim().length >= 3) {
                addDiscipline(index, val);
                e.preventDefault();
                input.blur();
              } else {
                message.warning('Введите не менее 3 символов для новой дисциплины');
                e.preventDefault();
              }
            }
          }}
          dropdownRender={(menu) => (
            <div>
              {menu}
              <div style={{ padding: '4px 8px', borderTop: '1px solid #e8e8e8' }}>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const input = document.querySelector('.ant-select-selection-search-input');
                    const val = input ? input.value : '';
                    if (val && val.trim().length >= 3) {
                      addDiscipline(index, val);
                    } else {
                      message.warning('Введите не менее 3 символов для новой дисциплины');
                    }
                  }}
                >
                  Добавить новую дисциплину
                </Button>
              </div>
            </div>
          )}
        >
          {allDisciplines.map(d => (
            <Option key={d} value={d}>{d}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Примерный объём (часы)',
      dataIndex: 'hours',
      key: 'hours',
      width: columnWidths.hours,
      render: (text, record, index) => (
        <Input
          type="number"
          value={text}
          onChange={(e) => updateRow(index, 'hours', e.target.value)}
          placeholder="Напр. 72"
          min={0}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Форма контроля',
      dataIndex: 'control',
      key: 'control',
      width: columnWidths.control,
      render: (text, record, index) => (
        <Select
          value={text || undefined}
          onChange={(value) => updateRow(index, 'control', value)}
          style={{ width: '100%' }}
          placeholder="Выберите"
          allowClear
        >
          {CONTROL_OPTIONS.map(opt => (
            <Option key={opt} value={opt}>{opt}</Option>
          ))}
        </Select>
      ),
    },
  ];

  // Применяем resizable к заголовкам
  const resizableColumns = columns.map((col) => ({
    ...col,
    onHeaderCell: (column) => ({
      width: column.width,
      onResize: handleResize(col.key),
    }),
  }));

  return (
    <div>
      <Title level={4}>Шаг 4. Привязка знаний, умений и навыков к дисциплинам/модулям/практикам</Title>
      <Paragraph>
        Для каждого компонента (знания, умения, практические навыки) укажите дисциплину, модуль или практику, форму контроля и примерный объём в часах.
        Дисциплины сохраняются в список для повторного использования. Нажмите <strong>Enter</strong> или кнопку <strong>«Добавить новую дисциплину»</strong>, чтобы добавить новую дисциплину (минимальная длина 3 символа).
        <strong>Изменяйте ширину столбцов, перетаскивая правый край заголовка.</strong>
      </Paragraph>
      <Table
        dataSource={mapping}
        columns={resizableColumns}
        pagination={false}
        rowKey={(row) => row.id}
        style={{ marginTop: 16 }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
      />
    </div>
  );
};

export default Step4DisciplineMapping;