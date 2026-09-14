import type { Competence, FormationLevel, MatrixContext } from '@/api/types';
import {
  DESCRIPTOR_CATEGORIES,
  FORMATION_LEVELS,
  FORMATION_LEVEL_LABELS,
  getDescriptorText,
  type DescriptorCategory,
} from '@/lib/competenceMappers';

type FormationLevelsPanelProps = {
  comp: Competence;
};

function splitIndicators(text: string): string[] {
  return text
    .split(/\.(?=[А-ЯA-Z])/)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

export function FormationLevelsPanel({ comp }: FormationLevelsPanelProps) {
  const matrix: MatrixContext | null | undefined = comp.matrix_context;
  const qlLabel =
    matrix?.qualification_level_label ||
    (comp.qualification_level_code ? `${comp.qualification_level_code}-й уровень` : null) ||
    comp.qualification_level ||
    '—';

  return (
    <div className="space-y-8">
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Уровень квалификации (приказ №148н)</h4>
        <p className="text-lg font-medium text-primary mb-3">{qlLabel}</p>
        {matrix?.order_148n_indicators ? (
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {splitIndicators(matrix.order_148n_indicators).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Укажите уровень квалификации трудовой функции, чтобы показать эталон из матрицы.
          </p>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Шкала сформированности (уровень внутри уровня)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(matrix?.formation_level_definitions || FORMATION_LEVELS.map((code) => ({
            code,
            label: FORMATION_LEVEL_LABELS[code],
            description: '',
          }))).map((def) => (
            <div key={def.code} className="surface p-4 rounded-lg border border-gray-100">
              <div className="text-sm font-semibold text-primary mb-2">{def.label}</div>
              {def.description && (
                <p className="text-xs text-gray-500 mb-3">{def.description}</p>
              )}
              {matrix?.formation_levels?.[def.code as FormationLevel] && (
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="text-xs uppercase tracking-wide text-gray-400 block mb-1">
                    Эталон для уровня {matrix.qualification_level}
                  </span>
                  {matrix.formation_levels[def.code as FormationLevel]}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Дескрипторы компетенции (A / B / C)</h4>
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr>
                <th>Категория</th>
                {FORMATION_LEVELS.map((level) => (
                  <th key={level}>{FORMATION_LEVEL_LABELS[level]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DESCRIPTOR_CATEGORIES.map((cat: DescriptorCategory) => (
                <tr key={cat}>
                  <td className="font-medium">{cat}</td>
                  {FORMATION_LEVELS.map((level) => (
                    <td key={level} className="align-top text-gray-700">
                      {getDescriptorText(comp.descriptors, cat, level) || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {matrix?.universal_skills && matrix.universal_skills.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Универсальные (надпрофессиональные) навыки
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matrix.universal_skills.map((skill) => (
              <div key={skill.category} className="surface p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">{skill.category}</div>
                <p className="text-sm text-gray-600">{skill.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!matrix?.universal_skills?.length &&
        comp.formation_profile?.universal_skills &&
        comp.formation_profile.universal_skills.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Универсальные (надпрофессиональные) навыки
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comp.formation_profile.universal_skills.map((skill) => (
              <div key={skill.category} className="surface p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">{skill.category}</div>
                <p className="text-sm text-gray-600">{skill.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
