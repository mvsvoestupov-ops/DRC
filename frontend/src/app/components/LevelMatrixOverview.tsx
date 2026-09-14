import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import type { QualificationLevelRef } from '@/api/types';
import { FORMATION_LEVEL_LABELS, FORMATION_LEVELS } from '@/lib/competenceMappers';

export function LevelMatrixOverview() {
  const [levels, setLevels] = useState<QualificationLevelRef[]>([]);
  const [selected, setSelected] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .getQualificationLevels()
      .then((data) => {
        setLevels(data as QualificationLevelRef[]);
        if (data.length > 0) {
          const hasSix = data.some((row: QualificationLevelRef) => row.qualification_level === 6);
          setSelected(hasSix ? 6 : data[0].qualification_level);
        }
      })
      .catch(() => setError('Не удалось загрузить матрицу уровней'))
      .finally(() => setLoading(false));
  }, []);

  const active = levels.find((row) => row.qualification_level === selected);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Загрузка матрицы...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>;
  }

  return (
    <div className="surface p-6 mb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Матрица уровней квалификации и сформированности
        </h2>
        <p className="text-sm text-gray-500 max-w-3xl">
          Соответствие уровней квалификации (приказ Минтруда №148н), уровней сформированности компетенции
          (базовый / продвинутый / экспертный) и универсальных навыков. Принцип: «уровень внутри уровня».
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {levels.map((row) => (
          <button
            key={row.qualification_level}
            type="button"
            onClick={() => setSelected(row.qualification_level)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              selected === row.qualification_level
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary/40'
            }`}
          >
            {row.qualification_level}
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{active.qualification_level_label}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">{active.order_148n_indicators.replace(/\.(?=[А-ЯA-Z])/g, '.\n')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {FORMATION_LEVELS.map((level) => (
              <div key={level} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="text-sm font-semibold text-primary mb-2">{FORMATION_LEVEL_LABELS[level]}</div>
                <p className="text-sm text-gray-700 leading-relaxed">{active.formation_levels[level]}</p>
              </div>
            ))}
          </div>

          {active.universal_skills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Soft skills для уровня {active.qualification_level}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {active.universal_skills.map((skill) => (
                  <div key={skill.category} className="rounded-lg border border-gray-100 p-3 bg-white">
                    <div className="text-sm font-medium">{skill.category}</div>
                    <p className="text-sm text-gray-600 mt-1">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
