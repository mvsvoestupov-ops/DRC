import { useState } from 'react';
import type { FormationLevel, MatrixContext } from '@/api/types';
import {
  DESCRIPTOR_CATEGORIES,
  DESCRIPTOR_CATEGORY_LABELS,
  FORMATION_LEVELS,
  FORMATION_LEVEL_LABELS,
  type DescriptorCategory,
} from '@/lib/competenceMappers';
import { Button } from '@/components/ui/button';

export type DescriptorMap = Record<DescriptorCategory, Record<FormationLevel, string>>;

type Props = {
  descriptors: DescriptorMap;
  matrixContext?: MatrixContext | null;
  qualificationLevelLabel?: string;
  order148nIndicators?: string;
  onChange: (next: DescriptorMap) => void;
  onApplyMatrix?: () => void;
  applying?: boolean;
};

export function DescriptorEditor({
  descriptors,
  matrixContext,
  qualificationLevelLabel,
  order148nIndicators,
  onChange,
  onApplyMatrix,
  applying,
}: Props) {
  const [activeLevel, setActiveLevel] = useState<FormationLevel>('базовый');

  const update = (cat: DescriptorCategory, level: FormationLevel, value: string) => {
    onChange({
      ...descriptors,
      [cat]: {
        ...descriptors[cat],
        [level]: value,
      },
    });
  };

  const levelLabel =
    qualificationLevelLabel ||
    matrixContext?.qualification_level_label ||
    '';
  const order148n =
    (order148nIndicators || matrixContext?.order_148n_indicators || '').trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Дескрипторы уровней сформированности</h3>
          <p className="text-sm text-gray-500">
            Принцип «уровень внутри уровня»: базовый соответствует минимуму приказа №148н для выбранной квалификации.
          </p>
        </div>
        {onApplyMatrix && (
          <Button type="button" variant="outline" onClick={onApplyMatrix} disabled={applying}>
            {applying ? 'Загрузка…' : 'Загрузить из матрицы'}
          </Button>
        )}
      </div>

      {order148n && (
        <div className="rounded-xl border border-primary/20 bg-secondary/40 p-4 text-sm text-gray-700">
          <div className="font-medium text-primary mb-2">
            Показатели {levelLabel || 'уровня'} по приказу Минтруда №148н
          </div>
          <div className="whitespace-pre-line leading-relaxed">{order148n}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FORMATION_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(level)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              activeLevel === level
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {FORMATION_LEVEL_LABELS[level]}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {DESCRIPTOR_CATEGORIES.map((cat) => (
          <div key={cat}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория {cat} ({DESCRIPTOR_CATEGORY_LABELS[cat]}) — {FORMATION_LEVEL_LABELS[activeLevel]}
            </label>
            <textarea
              value={descriptors[cat][activeLevel] || ''}
              onChange={(e) => update(cat, activeLevel, e.target.value)}
              rows={3}
              className="form-control w-full"
              placeholder={`Опишите ${FORMATION_LEVEL_LABELS[activeLevel].toLowerCase()} уровень для категории ${cat}…`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function createEmptyDescriptors(): DescriptorMap {
  return {
    A: { базовый: '', продвинутый: '', экспертный: '' },
    B: { базовый: '', продвинутый: '', экспертный: '' },
    C: { базовый: '', продвинутый: '', экспертный: '' },
  };
}

export function normalizeDescriptorMap(input: unknown): DescriptorMap {
  const base = createEmptyDescriptors();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Record<string, unknown>;
  for (const cat of DESCRIPTOR_CATEGORIES) {
    const nested = raw[cat];
    if (nested && typeof nested === 'object') {
      for (const level of FORMATION_LEVELS) {
        const value = (nested as Record<string, string>)[level];
        if (value) base[cat][level] = value;
      }
    }
    for (const level of FORMATION_LEVELS) {
      const flat = raw[`${cat}_${level}`];
      if (typeof flat === 'string' && flat) base[cat][level] = flat;
    }
  }
  return base;
}
