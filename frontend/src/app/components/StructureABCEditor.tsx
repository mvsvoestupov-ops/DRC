import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LaborFunctionDetail, StructureABC, StructureItem } from '@/lib/structureFromLaborFunctions';
import { createStructureItemId, isManualStructureItem } from '@/lib/structureFromLaborFunctions';

type Container = 'A' | 'B' | 'C';

type Props = {
  structure: StructureABC;
  selectedLaborFunctions: LaborFunctionDetail[];
  onChange: (next: StructureABC) => void;
};

const CONTAINER_META: Record<Container, { title: string; subtitle: string; badge: string; badgeClass: string }> = {
  A: {
    title: 'A – Знания',
    subtitle: 'Из трудовых действий выбранных функций',
    badge: 'A',
    badgeClass: 'bg-blue-100 text-primary',
  },
  B: {
    title: 'B – Умения / интеллектуальные навыки',
    subtitle: 'Часть умений можно перенести в практические навыки',
    badge: 'B',
    badgeClass: 'bg-green-100 text-green-700',
  },
  C: {
    title: 'C – Практические навыки',
    subtitle: 'Перенесённые из B или добавленные вручную. Можно вернуть в B.',
    badge: 'C',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
};

export function StructureABCEditor({ structure, selectedLaborFunctions, onChange }: Props) {
  const [addTarget, setAddTarget] = useState<Container | null>(null);
  const [newText, setNewText] = useState('');
  const [newTdKey, setNewTdKey] = useState('');

  const laborActionOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; tfCode: string; tdText: string }> = [];
    selectedLaborFunctions.forEach((tf) => {
      (tf.labor_actions || []).forEach((la, idx) => {
        const tdText = la.text?.trim() || `ТД ${idx + 1}`;
        options.push({
          value: `${tf.code}-${idx}`,
          label: `${tf.code} – ${tdText}`,
          tfCode: tf.code,
          tdText,
        });
      });
    });
    return options;
  }, [selectedLaborFunctions]);

  const updateContainer = (container: Container, items: StructureItem[]) => {
    onChange({ ...structure, [container]: items });
  };

  const deleteItem = (container: Container, id: string) => {
    updateContainer(container, structure[container].filter((item) => item.id !== id));
  };

  const moveToC = (id: string) => {
    const item = structure.B.find((el) => el.id === id);
    if (!item) return;
    onChange({
      ...structure,
      B: structure.B.filter((el) => el.id !== id),
      C: [...structure.C, item],
    });
  };

  const moveToB = (id: string) => {
    const item = structure.C.find((el) => el.id === id);
    if (!item) return;
    onChange({
      ...structure,
      C: structure.C.filter((el) => el.id !== id),
      B: [...structure.B, item],
    });
  };

  const openAdd = (container: Container) => {
    setAddTarget(container);
    setNewText('');
    setNewTdKey(laborActionOptions[0]?.value || '');
  };

  const confirmAdd = () => {
    if (!addTarget || !newText.trim()) return;
    let tfCode: string | null = null;
    let tdText: string | null = null;
    if (addTarget !== 'C' && laborActionOptions.length > 0) {
      const selected = laborActionOptions.find((opt) => opt.value === newTdKey);
      if (!selected) return;
      tfCode = selected.tfCode;
      tdText = selected.tdText;
    }
    updateContainer(addTarget, [
      ...structure[addTarget],
      {
        id: createStructureItemId(),
        text: newText.trim(),
        tfCode,
        tdText,
        origin: 'manual',
      },
    ]);
    setAddTarget(null);
    setNewText('');
  };

  const renderList = (container: Container) => {
    const items = structure[container];
    const showMoveToC = container === 'B';
    const showMoveToB = container === 'C';

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
          {container === 'A' || container === 'B'
            ? 'Выберите трудовые функции на предыдущем шаге или добавьте элемент вручную'
            : 'Перенесите умения из колонки B, верните их обратно или добавьте навык вручную'}
        </div>
      );
    }

    return (
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{item.text}</p>
              {item.tfCode && (
                <p className="text-xs text-gray-500 mt-1">
                  {item.tfCode}
                  {item.tdText ? ` · ТД: ${item.tdText}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {showMoveToC && (
                <button
                  type="button"
                  title="Перенести в практические навыки"
                  onClick={() => moveToC(item.id)}
                  className="p-1.5 rounded-md text-primary hover:bg-primary/10"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {showMoveToB && (
                <button
                  type="button"
                  title="Вернуть в умения"
                  onClick={() => moveToB(item.id)}
                  className="p-1.5 rounded-md text-primary hover:bg-primary/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {isManualStructureItem(item) && (
                <button
                  type="button"
                  title="Удалить"
                  onClick={() => deleteItem(container, item.id)}
                  className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Структура компетенции (A/B/C)</h2>
        <p className="text-sm text-gray-500">
          Знания и умения из профстандарта нельзя удалить — только перенести умение в практические навыки и вернуть обратно.
          Удаляются лишь элементы, добавленные вручную.
        </p>
      </div>

      {selectedLaborFunctions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-secondary/30 px-4 py-3 text-sm text-gray-700">
          <span className="font-medium text-primary">Выбрано функций: {selectedLaborFunctions.length}</span>
          <span className="text-gray-500 ml-2">
            ({selectedLaborFunctions.map((tf) => tf.code).join(', ')})
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as Container[]).map((container) => {
          const meta = CONTAINER_META[container];
          return (
            <div key={container} className="surface border border-gray-100 rounded-xl p-4 flex flex-col min-h-[320px]">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${meta.badgeClass}`}>
                      {meta.badge}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">{meta.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{meta.subtitle}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => openAdd(container)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">{renderList(container)}</div>
            </div>
          );
        })}
      </div>

      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Добавить в {CONTAINER_META[addTarget].title}
              </h3>
              <button type="button" onClick={() => setAddTarget(null)} className="p-1 rounded-md hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Текст</label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
                className="form-control w-full"
                placeholder="Введите описание..."
              />
            </div>
            {addTarget !== 'C' && laborActionOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Привязать к трудовому действию</label>
                <select
                  value={newTdKey}
                  onChange={(e) => setNewTdKey(e.target.value)}
                  className="form-control w-full"
                >
                  {laborActionOptions.length === 0 ? (
                    <option value="">Нет трудовых действий — выберите функции на шаге 2</option>
                  ) : (
                    laborActionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddTarget(null)}>
                Отмена
              </Button>
              <Button type="button" onClick={confirmAdd} disabled={!newText.trim() || (addTarget !== 'C' && laborActionOptions.length > 0 && !newTdKey)}>
                Добавить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
