import { useMemo, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { listCatalogItems } from "@/lib/disciplineCatalog";
import type { StructureABC } from "@/lib/structureFromLaborFunctions";
import { DisciplineCatalogPicker } from "@/app/components/DisciplineCatalogPicker";
import { useI18n } from "@/context/I18nContext";
import { translateKeyed, DESCRIPTOR_I18N_KEYS } from "@/i18n/helpers";

export const DISCIPLINE_CONTROL_OPTIONS = [
  "зачёт",
  "экзамен",
  "защита проекта",
  "курсовая работа",
  "отчёт по практике",
] as const;

const DISCIPLINE_CONTROL_I18N_KEYS: Record<string, string> = {
  "зачёт": "discipline.credit",
  "экзамен": "discipline.exam",
  "защита проекта": "discipline.project",
  "курсовая работа": "discipline.coursework",
  "отчёт по практике": "discipline.practiceReport",
};

export const COMPONENT_SCALE_MAX = 10;
export const COMPONENT_SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type ScaleScore = (typeof COMPONENT_SCALE_VALUES)[number] | "";

export type DisciplineBinding = {
  discipline: string;
  control: string;
};

export type DisciplineMappingRow = {
  id: string;
  component: string;
  category: "A" | "B" | "C";
  text: string;
  bindings: DisciplineBinding[];
  importance: ScaleScore;
  volume: ScaleScore;
  /** @deprecated kept for reading older form state */
  discipline?: string;
  control?: string;
};

const CATEGORY_STYLE: Record<"A" | "B" | "C", string> = {
  A: "bg-blue-50 text-primary border-blue-100",
  B: "bg-green-50 text-green-700 border-green-100",
  C: "bg-purple-50 text-purple-700 border-purple-100",
};

const emptyBinding = (): DisciplineBinding => ({ discipline: "", control: "" });

export function parseScaleScore(value: unknown): ScaleScore {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > COMPONENT_SCALE_MAX) return "";
  return n as ScaleScore;
}

export function formatScaleScore(value: unknown): string {
  const score = parseScaleScore(value);
  return score === "" ? "—" : `${score}/${COMPONENT_SCALE_MAX}`;
}

function normalizeBindings(row: DisciplineMappingRow): DisciplineBinding[] {
  if (Array.isArray(row.bindings) && row.bindings.length > 0) {
    return row.bindings.map((item) => ({
      discipline: item.discipline || "",
      control: item.control || "",
    }));
  }
  if (row.discipline?.trim() || row.control) {
    return [{ discipline: row.discipline || "", control: row.control || "" }];
  }
  return [emptyBinding()];
}

type SyncedRowState = {
  bindings: DisciplineBinding[];
  importance: ScaleScore;
  volume: ScaleScore;
};

export function syncDisciplineMapping(
  structure: StructureABC,
  existing: DisciplineMappingRow[] = [],
): DisciplineMappingRow[] {
  const byId = new Map<string, SyncedRowState>();
  existing.forEach((row) => {
    const current = byId.get(row.id) || { bindings: [], importance: "" as ScaleScore, volume: "" as ScaleScore };
    normalizeBindings(row).forEach((binding) => {
      if (binding.discipline.trim() || binding.control) current.bindings.push(binding);
    });
    if (!current.importance) current.importance = parseScaleScore(row.importance);
    if (!current.volume) current.volume = parseScaleScore(row.volume);
    byId.set(row.id, current);
  });

  const rows: DisciplineMappingRow[] = [];
  (["A", "B", "C"] as const).forEach((category) => {
    structure[category]
      .filter((item) => item.text.trim())
      .forEach((item, index) => {
        const prev = byId.get(item.id);
        rows.push({
          id: item.id,
          component: `${category}${index + 1}`,
          category,
          text: item.text.trim(),
          bindings: prev && prev.bindings.length > 0 ? prev.bindings : [emptyBinding()],
          importance: prev?.importance || "",
          volume: prev?.volume || "",
        });
      });
  });
  return rows;
}

export function flattenDisciplineMapping(rows: DisciplineMappingRow[]) {
  return rows.flatMap((row) => {
    const filled = normalizeBindings(row).filter((binding) => binding.discipline.trim());
    const scores = {
      importance: parseScaleScore(row.importance) || undefined,
      volume: parseScaleScore(row.volume) || undefined,
    };
    const payloadBase = {
      id: row.id,
      component: row.component,
      category: row.category,
      text: row.text,
      ...scores,
    };
    if (filled.length === 0) {
      if (!scores.importance && !scores.volume) return [];
      return [{ ...payloadBase, discipline: "", control: "" }];
    }
    return filled.map((binding) => ({
      ...payloadBase,
      discipline: binding.discipline.trim(),
      control: binding.control,
    }));
  });
}

export function groupDisciplineMapping(
  items: Array<{
    id?: string;
    component?: string;
    text?: string;
    discipline?: string;
    hours?: string | number;
    control?: string;
    importance?: string | number;
    volume?: string | number;
  }> = [],
) {
  const groups: Array<{
    key: string;
    component: string;
    text: string;
    importance: ScaleScore;
    volume: ScaleScore;
    bindings: Array<{ discipline: string; hours?: string | number; control: string }>;
  }> = [];
  const indexByKey = new Map<string, number>();

  items.forEach((item) => {
    const key = String(item.id || `${item.component || ""}|${item.text || ""}`);
    const binding = {
      discipline: item.discipline || "",
      hours: item.hours,
      control: item.control || "",
    };
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        component: item.component || "—",
        text: item.text || "",
        importance: parseScaleScore(item.importance),
        volume: parseScaleScore(item.volume),
        bindings: binding.discipline.trim() || binding.control || binding.hours ? [binding] : [],
      });
    } else {
      const group = groups[existing];
      if (!group.importance) group.importance = parseScaleScore(item.importance);
      if (!group.volume) group.volume = parseScaleScore(item.volume);
      if (binding.discipline.trim() || binding.control || binding.hours) {
        group.bindings.push(binding);
      }
    }
  });

  return groups;
}

type DisciplineMappingEditorProps = {
  rows: DisciplineMappingRow[];
  onChange: (rows: DisciplineMappingRow[]) => void;
  educationKind?: string;
  educationLevel?: string;
};

function ScaleScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ScaleScore;
  onChange: (value: ScaleScore) => void;
}) {
  return (
    <label className="block min-w-[88px]">
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      <select
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(parseScaleScore(e.target.value))}
        className="form-control"
        aria-label={label}
      >
        <option value="">—</option>
        {COMPONENT_SCALE_VALUES.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DisciplineMappingEditor({
  rows,
  onChange,
  educationKind,
  educationLevel,
}: DisciplineMappingEditorProps) {
  const { t } = useI18n();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const catalogItems = useMemo(
    () => listCatalogItems(educationKind, educationLevel),
    [educationKind, educationLevel],
  );
  const extraNames = useMemo(
    () =>
      rows.flatMap((row) =>
        normalizeBindings(row)
          .map((binding) => binding.discipline.trim())
          .filter((name) => name.length >= 3),
      ),
    [rows],
  );

  const setRowBindings = (id: string, bindings: DisciplineBinding[]) => {
    const next = rowsRef.current.map((row) => (row.id === id ? { ...row, bindings } : row));
    rowsRef.current = next;
    onChange(next);
  };

  const updateRowScores = (id: string, patch: Partial<Pick<DisciplineMappingRow, "importance" | "volume">>) => {
    const next = rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row));
    rowsRef.current = next;
    onChange(next);
  };

  const updateBinding = (id: string, index: number, patch: Partial<DisciplineBinding>) => {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row) return;
    const bindings = normalizeBindings(row).map((binding, i) =>
      i === index ? { ...binding, ...patch } : binding,
    );
    setRowBindings(id, bindings);
  };

  const addBinding = (id: string) => {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row) return;
    setRowBindings(id, [...normalizeBindings(row), emptyBinding()]);
  };

  const removeBinding = (id: string, index: number) => {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row) return;
    const bindings = normalizeBindings(row).filter((_, i) => i !== index);
    setRowBindings(id, bindings.length ? bindings : [emptyBinding()]);
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Сначала заполните структуру A/B/C на шаге 3 — сюда подставятся знания, умения и практические навыки.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="data-table min-w-[920px]">
        <thead>
          <tr>
            <th className="w-[32%]">Компонент (A/B/C)</th>
            <th className="w-[180px]">Экспертная оценка (1–10)</th>
            <th>Дисциплины / модули / практики и форма контроля</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bindings = normalizeBindings(row);
            const taken = bindings.map((binding) => binding.discipline.trim()).filter(Boolean);
            return (
              <tr key={row.id}>
                <td className="align-top">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${CATEGORY_STYLE[row.category]}`}
                    >
                      {row.component}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{row.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {row.category} ({translateKeyed(t, DESCRIPTOR_I18N_KEYS, row.category)})
                      </p>
                    </div>
                  </div>
                </td>
                <td className="align-top">
                  <div className="flex items-start gap-2">
                    <ScaleScoreSelect
                      label={t("discipline.importance")}
                      value={parseScaleScore(row.importance)}
                      onChange={(importance) => updateRowScores(row.id, { importance })}
                    />
                    <ScaleScoreSelect
                      label={t("discipline.volume")}
                      value={parseScaleScore(row.volume)}
                      onChange={(volume) => updateRowScores(row.id, { volume })}
                    />
                  </div>
                </td>
                <td className="align-top">
                  <div className="space-y-2">
                    {bindings.map((binding, index) => (
                      <div key={`${row.id}-${index}`} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <DisciplineCatalogPicker
                            value={binding.discipline}
                            items={catalogItems}
                            extraNames={extraNames}
                            excludeNames={taken.filter((name) => name !== binding.discipline.trim())}
                            onChange={(discipline) => updateBinding(row.id, index, { discipline })}
                          />
                        </div>
                        <select
                          value={binding.control}
                          onChange={(e) => updateBinding(row.id, index, { control: e.target.value })}
                          className="form-control w-[150px] shrink-0"
                        >
                          <option value="">{t("discipline.control")}</option>
                          {DISCIPLINE_CONTROL_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {translateKeyed(t, DISCIPLINE_CONTROL_I18N_KEYS, option)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="mt-1.5 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          aria-label="Удалить дисциплину"
                          disabled={bindings.length === 1 && !binding.discipline && !binding.control}
                          onClick={() => removeBinding(row.id, index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
                      onClick={() => addBinding(row.id)}
                    >
                      <Plus className="w-4 h-4" />
                      {t("discipline.add")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
        Эксперты оценивают каждый компонент по двум критериям: важность для компетенции и объём освоения,
        шкала от 1 до 10. К одному З/У/Н можно привязать несколько дисциплин. В справочнике{" "}
        {catalogItems.length} типичных названий для выбранного вида образования.
      </p>
    </div>
  );
}
