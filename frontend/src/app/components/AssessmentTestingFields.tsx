import { Plus, Trash2 } from "lucide-react";
import {
  emptyAssessmentOption,
  TEST_ITEM_TYPES,
  type AssessmentOption,
  type AssessmentTask,
  type TestItemType,
} from "@/lib/assessmentConstructor";
import { Button } from "@/components/ui/button";

/** Поля тестового задания — общая форма шагов 6 и 6.1. */
export function AssessmentTestingFields({
  task,
  onChange,
}: {
  task: AssessmentTask;
  onChange: (patch: Partial<AssessmentTask>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Тип задания</label>
        <select
          value={task.itemType}
          onChange={(e) => onChange({ itemType: e.target.value as TestItemType })}
          className="form-control max-w-xs"
        >
          {TEST_ITEM_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Текст вопроса</label>
        <textarea
          value={task.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={2}
          className="form-control"
          placeholder="Сформулируйте вопрос к конкретному знанию или интеллектуальному умению…"
        />
      </div>
      {task.itemType !== "open" ? (
        <OptionsEditor
          taskId={task.id}
          itemType={task.itemType}
          options={task.options}
          onChange={(options) => onChange({ options })}
        />
      ) : null}
    </div>
  );
}

function OptionsEditor({
  taskId,
  itemType,
  options,
  onChange,
}: {
  taskId: string;
  itemType: TestItemType;
  options: AssessmentOption[];
  onChange: (options: AssessmentOption[]) => void;
}) {
  const showCorrect = itemType === "single" || itemType === "multiple";
  const hint =
    itemType === "match"
      ? "Каждый вариант — пара «элемент — соответствие»."
      : itemType === "sequence"
        ? "Порядок вариантов сверху вниз — правильная последовательность."
        : "Отметьте правильный ответ.";

  const updateOption = (id: string, patch: Partial<AssessmentOption>) => {
    onChange(
      options.map((option) => {
        if (option.id !== id) {
          if (showCorrect && itemType === "single" && patch.isCorrect) {
            return { ...option, isCorrect: false };
          }
          return option;
        }
        return { ...option, ...patch };
      }),
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Варианты ответов</p>
      <p className="text-xs text-gray-500">{hint}</p>
      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          {showCorrect ? (
            <input
              type={itemType === "single" ? "radio" : "checkbox"}
              name={`correct-${taskId}`}
              checked={option.isCorrect}
              onChange={(e) => updateOption(option.id, { isCorrect: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
              aria-label={`Правильный вариант ${index + 1}`}
            />
          ) : (
            <span className="w-6 text-xs text-gray-400">{index + 1}.</span>
          )}
          <input
            value={option.text}
            onChange={(e) => updateOption(option.id, { text: e.target.value })}
            className="form-control"
            placeholder={`Вариант ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(options.filter((item) => item.id !== option.id))}
            className="text-red-600 shrink-0"
            aria-label="Удалить вариант"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, emptyAssessmentOption()])}
      >
        <Plus className="w-3.5 h-3.5" />
        Добавить вариант
      </Button>
    </div>
  );
}
