import { useEffect, useState } from 'react';
import type { FormationLevel, MatrixContext } from '@/api/types';
import {
  DESCRIPTOR_CATEGORIES,
  DESCRIPTOR_CATEGORY_LABELS,
  FORMATION_LEVELS,
  FORMATION_LEVEL_LABELS,
  expertFormationAllowed,
  type DescriptorCategory,
} from '@/lib/competenceMappers';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/I18nContext';
import { DESCRIPTOR_I18N_KEYS, FORMATION_I18N_KEYS, translateKeyed } from '@/i18n/helpers';

export type DescriptorMap = Record<DescriptorCategory, Record<FormationLevel, string>>;

type Props = {
  descriptors: DescriptorMap;
  educationLevel?: string;
  matrixContext?: MatrixContext | null;
  qualificationLevelLabel?: string;
  order148nIndicators?: string;
  onChange: (next: DescriptorMap) => void;
  onApplyMatrix?: () => void;
  applying?: boolean;
};

export function DescriptorEditor({
  descriptors,
  educationLevel,
  matrixContext,
  qualificationLevelLabel,
  order148nIndicators,
  onChange,
  onApplyMatrix,
  applying,
}: Props) {
  const { t } = useI18n();
  const [activeLevel, setActiveLevel] = useState<FormationLevel>('базовый');
  const expertBlocked = !expertFormationAllowed(educationLevel);

  useEffect(() => {
    if (expertBlocked && activeLevel === 'экспертный') {
      setActiveLevel('базовый');
    }
  }, [expertBlocked, activeLevel]);

  const update = (cat: DescriptorCategory, level: FormationLevel, value: string) => {
    if (level === 'экспертный' && expertBlocked) return;
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
          <h3 className="text-lg font-semibold text-gray-900">{t("wizard.step4")}</h3>
          <p className="text-sm text-gray-500">
            Принцип «уровень внутри уровня»: базовый соответствует минимуму приказа №148н для выбранной квалификации.
          </p>
        </div>
        {onApplyMatrix && (
          <Button type="button" variant="outline" onClick={onApplyMatrix} disabled={applying}>
            {applying ? t("common.loading") : t("wizard.loadMatrix")}
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
        {FORMATION_LEVELS.map((level) => {
          const blocked = level === 'экспертный' && expertBlocked;
          return (
            <button
              key={level}
              type="button"
              disabled={blocked}
              title={blocked ? t("wizard.expertLevelBlocked") : undefined}
              onClick={() => {
                if (!blocked) setActiveLevel(level);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                blocked
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : activeLevel === level
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {translateKeyed(t, FORMATION_I18N_KEYS, level, FORMATION_LEVEL_LABELS[level])}
            </button>
          );
        })}
      </div>
      {expertBlocked && (
        <p className="text-sm text-gray-500">{t("wizard.expertLevelBlocked")}</p>
      )}

      <div className="space-y-5">
        {DESCRIPTOR_CATEGORIES.map((cat) => (
          <div key={cat}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("detail.category", { cat })} ({translateKeyed(t, DESCRIPTOR_I18N_KEYS, cat, DESCRIPTOR_CATEGORY_LABELS[cat])}) — {translateKeyed(t, FORMATION_I18N_KEYS, activeLevel, FORMATION_LEVEL_LABELS[activeLevel])}
            </label>
            <textarea
              value={descriptors[cat][activeLevel] || ''}
              onChange={(e) => update(cat, activeLevel, e.target.value)}
              rows={3}
              disabled={activeLevel === 'экспертный' && expertBlocked}
              className="form-control w-full disabled:bg-gray-100 disabled:text-gray-400"
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

export function stripBlockedExpertDescriptors(
  descriptors: DescriptorMap,
  educationLevel?: string | null,
): DescriptorMap {
  if (expertFormationAllowed(educationLevel)) return descriptors;
  return {
    A: { ...descriptors.A, экспертный: "" },
    B: { ...descriptors.B, экспертный: "" },
    C: { ...descriptors.C, экспертный: "" },
  };
}
