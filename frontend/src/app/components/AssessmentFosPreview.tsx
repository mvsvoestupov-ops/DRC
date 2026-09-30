import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FORMATION_LEVELS, FORMATION_LEVEL_LABELS } from "@/lib/competenceMappers";
import type { FormationLevel } from "@/api/types";
import {
  ASSESSMENT_MEDIA_KIND_LABELS,
  TEST_ITEM_TYPES,
  assessmentMediaUrl,
  assessmentMethodLabel,
  formatAttachmentSize,
  isAssessmentTaskComplete,
  type AssessmentAttachment,
  type AssessmentByLevel,
  type AssessmentTask,
  type StructureComponent,
} from "@/lib/assessmentConstructor";

const ACCEPT_MEDIA =
  "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp,application/pdf,.pdf,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,audio/aac,.mp3,.wav,.ogg,.m4a,.aac,video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov";

export function FosAttachments({
  attachments,
  compact = false,
}: {
  attachments: AssessmentAttachment[];
  compact?: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <p className="text-sm font-semibold text-gray-800">Материалы к заданию</p>
      <ul className="space-y-3">
        {attachments.map((item) => {
          const src = assessmentMediaUrl(item.url);
          const size = formatAttachmentSize(item.size);
          return (
            <li key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 mb-2">
                {ASSESSMENT_MEDIA_KIND_LABELS[item.kind]}
                {item.name ? ` · ${item.name}` : ""}
                {size ? ` · ${size}` : ""}
              </div>
              {item.kind === "image" ? (
                <img src={src} alt={item.name || "Иллюстрация к заданию"} className="max-h-72 rounded-md border border-gray-200 bg-white" />
              ) : null}
              {item.kind === "pdf" ? (
                <a href={src} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  Открыть PDF
                </a>
              ) : null}
              {item.kind === "video" ? (
                <video src={src} controls className="w-full max-h-80 rounded-md bg-black" />
              ) : null}
              {item.kind === "audio" ? (
                <audio src={src} controls className="w-full" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FosTaskArticle({
  task,
  index,
  components,
}: {
  task: AssessmentTask;
  index: number;
  components: StructureComponent[];
}) {
  const byId = new Map(components.map((item) => [item.id, item]));
  const itemType = TEST_ITEM_TYPES.find((item) => item.value === task.itemType)?.label;
  const covered = task.componentIds
    .map((id) => byId.get(id))
    .filter((item): item is StructureComponent => Boolean(item));
  const complete = isAssessmentTaskComplete(task);

  return (
    <article className="space-y-3 break-inside-avoid">
      <h3 className="text-base font-semibold text-gray-900">
        {index}. {assessmentMethodLabel(task.method)}
        {task.method === "testing" && itemType ? ` (${itemType})` : ""}
        {!complete ? (
          <span className="ml-2 text-xs font-normal text-amber-800">черновик</span>
        ) : null}
        {task.forNok ? <span className="ml-2 text-xs font-normal text-primary">для НОК</span> : null}
      </h3>
      {covered.length > 0 ? (
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">Оцениваемые З/У/Н: </span>
          {covered.map((item) => `${item.code}. ${item.text}`).join("; ")}
        </p>
      ) : (
        <p className="text-sm text-amber-800">Компоненты структуры не указаны.</p>
      )}
      {task.context.trim() ? (
        <DocBlock label="Ситуация / бриф" text={task.context} />
      ) : null}
      {task.roles.trim() ? <DocBlock label="Роли" text={task.roles} /> : null}
      {task.prompt.trim() ? <DocBlock label="Задание" text={task.prompt} /> : null}
      {task.options.some((opt) => opt.text.trim()) ? (
        <div>
          <p className="text-sm font-medium text-gray-800 mb-1">Варианты ответов</p>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
            {task.options
              .filter((opt) => opt.text.trim())
              .map((opt) => (
                <li key={opt.id}>
                  {opt.text}
                  {opt.isCorrect ? <span className="ml-1 text-xs text-green-700">верный</span> : null}
                </li>
              ))}
          </ol>
        </div>
      ) : null}
      {task.product.trim() ? <DocBlock label="Ожидаемый результат" text={task.product} /> : null}
      {task.criteria.trim() ? <DocBlock label="Критерии оценки" text={task.criteria} /> : null}
      <FosAttachments attachments={task.attachments || []} />
    </article>
  );
}

function DocBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed mt-0.5">{text}</p>
    </div>
  );
}

export function AssessmentFosPreview({
  byLevel,
  components,
  coverageLine,
  onEdit,
}: {
  byLevel: AssessmentByLevel;
  components: StructureComponent[];
  coverageLine: string;
  onEdit: (level: FormationLevel, taskId: string) => void;
}) {
  const [open, setOpen] = useState<Record<FormationLevel, boolean>>({
    базовый: true,
    продвинутый: false,
    экспертный: false,
  });

  const toggle = (level: FormationLevel) => {
    setOpen((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const expandAll = () => {
    setOpen({ базовый: true, продвинутый: true, экспертный: true });
  };

  const collapseAll = () => {
    setOpen({ базовый: false, продвинутый: false, экспертный: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Предварительный просмотр комплекта</h3>
          <p className="text-sm text-gray-600 mt-1">{coverageLine}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="text-xs text-primary hover:underline" onClick={expandAll}>
            Развернуть все
          </button>
          <button type="button" className="text-xs text-gray-500 hover:underline" onClick={collapseAll}>
            Свернуть все
          </button>
        </div>
      </div>
      {FORMATION_LEVELS.map((level) => {
        const block = byLevel[level];
        const expanded = open[level];
        const methods = Array.from(new Set(block.tasks.map((task) => assessmentMethodLabel(task.method))));
        return (
          <section key={level} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => toggle(level)}
              aria-expanded={expanded}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <ChevronDown
                className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
              />
              <span className="text-sm font-semibold text-gray-900">{FORMATION_LEVEL_LABELS[level]} уровень</span>
              <span className="text-xs text-gray-500">
                {block.tasks.length
                  ? `${block.tasks.length} ${taskWord(block.tasks.length)}`
                  : "нет заданий"}
              </span>
              {block.forNok ? (
                <span className="text-[11px] font-medium text-primary border border-blue-100 rounded-full px-2 py-0.5">
                  НОК
                </span>
              ) : null}
            </button>
            {expanded ? (
              <div className="border-t border-gray-100 bg-[#fbfaf7] px-4 py-5 sm:px-6">
                <article className="mx-auto max-w-3xl bg-white border border-gray-200 shadow-sm px-6 py-7 sm:px-9 space-y-6">
                  <header className="text-center border-b border-gray-200 pb-4 space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">Комплект оценочных средств</p>
                    <h2 className="text-lg font-semibold text-gray-900">{FORMATION_LEVEL_LABELS[level]} уровень сформированности</h2>
                    {methods.length > 0 ? (
                      <p className="text-sm text-gray-600">Методы: {methods.join(", ")}</p>
                    ) : null}
                    {block.forNok ? (
                      <p className="text-xs text-primary">Комплект уровня пригоден для независимой оценки квалификации</p>
                    ) : null}
                  </header>
                  {block.tasks.length === 0 ? (
                    <p className="text-sm text-gray-500">Для этого уровня задания ещё не распределены.</p>
                  ) : (
                    <div className="space-y-8">
                      {block.tasks.map((task, index) => (
                        <div key={task.id} className="space-y-2">
                          <FosTaskArticle task={task} index={index + 1} components={components} />
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() => onEdit(level, task.id)}
                          >
                            Редактировать задание
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export const ASSESSMENT_MEDIA_ACCEPT = ACCEPT_MEDIA;

function taskWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "задание";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "задания";
  return "заданий";
}
