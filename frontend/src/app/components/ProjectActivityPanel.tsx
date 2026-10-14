import { useEffect, useState } from "react";
import { CalendarClock, ClipboardList, Undo2 } from "lucide-react";
import { apiClient } from "@/api/client";
import type {
  Competence,
  CompetenceActivity,
  CompetenceActivityEvent,
  CompetenceContribution,
  CompetenceProgress,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import { presenceShortName } from "@/lib/collaborationPresence";

function fieldLabel(t: (key: string, vars?: Record<string, string | number>) => string, field: string) {
  const key = `activity.field.${field}`;
  const translated = t(key);
  return translated === key ? field : translated;
}

function eventText(
  t: (key: string, vars?: Record<string, string | number>) => string,
  event: CompetenceActivityEvent,
) {
  if (event.action === "create") return t("activity.eventCreate");
  if (event.action === "chat") return t("activity.eventChat", { n: event.step || 0 });
  if (event.action === "invite") return t("activity.eventInvite", { name: event.summary || "" });
  if (event.action === "remove") return t("activity.eventRemove", { name: event.summary || "" });
  if (event.action === "deadline") {
    return event.summary ? t("activity.eventDeadline", { date: event.summary }) : t("activity.eventDeadlineClear");
  }
  if (event.action === "status") return t("activity.eventStatus");
  if (event.action === "revert") {
    const fields = (event.fields || []).map((field) => fieldLabel(t, field)).join(", ");
    return t("activity.eventRevert", { fields: fields || "—" });
  }
  const fields = (event.fields || []).map((field) => fieldLabel(t, field)).join(", ");
  return fields ? t("activity.eventEdit", { fields }) : t("activity.eventEditEmpty");
}

export function DevelopmentProgressBar({
  progress,
  dueDate,
  compact,
}: {
  progress?: CompetenceProgress | null;
  dueDate?: string | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  if (!progress) return null;
  const overdue = Boolean(dueDate && dueDate < new Date().toISOString().slice(0, 10) && progress.percent < 100);
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
        <span>
          {t("activity.progressValue", { n: progress.percent, filled: progress.filled, total: progress.total })}
        </span>
        {dueDate ? (
          <span className={overdue ? "font-medium text-red-600" : ""}>
            {overdue ? t("activity.overdue") : t("activity.dueOn", { date: dueDate })}
          </span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${overdue ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
        />
      </div>
    </div>
  );
}

export function DevelopmentDeadlineCard({
  competenceId,
  dueDate,
  progress,
  onUpdated,
}: {
  competenceId: number;
  dueDate?: string | null;
  progress?: CompetenceProgress | null;
  onUpdated?: (comp: Competence) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(dueDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(dueDate || "");
  }, [dueDate]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await apiClient.updateCompetenceDevelopment(competenceId, value || null);
      onUpdated?.(saved as Competence);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activity.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <DevelopmentProgressBar progress={progress} dueDate={dueDate || value || null} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-600">{t("activity.deadline")}</span>
          <Input type="date" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? t("common.saving") : t("activity.setDeadline")}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function ContributionRow({ row }: { row: CompetenceContribution }) {
  const { t, intlLocale } = useI18n();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="truncate font-medium">
            {presenceShortName(row.name)}
            {row.role === "leader" ? ` · ${t("activity.leader")}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-xs text-gray-500">{row.share}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${row.share}%`, backgroundColor: row.color }} />
      </div>
      <p className="text-[11px] text-gray-500">
        {t("activity.contribMeta", { edits: row.edits, messages: row.messages })}
        {row.last_at
          ? ` · ${new Date(row.last_at).toLocaleString(intlLocale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
          : ""}
      </p>
    </div>
  );
}

export function ProjectActivityPanel({
  competenceId,
  dueDate,
  progress,
  onUpdated,
}: {
  competenceId: number;
  dueDate?: string | null;
  progress?: CompetenceProgress | null;
  onUpdated?: (comp: Competence) => void;
}) {
  const { t, intlLocale } = useI18n();
  const [data, setData] = useState<CompetenceActivity | null>(null);
  const [error, setError] = useState("");
  const [revertingId, setRevertingId] = useState<number | null>(null);

  const load = () => {
    apiClient
      .getCompetenceActivity(competenceId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("activity.loadError")));
  };

  const revert = async (eventId: number) => {
    if (!window.confirm(t("activity.revertConfirm"))) return;
    setRevertingId(eventId);
    setError("");
    try {
      const saved = await apiClient.revertCompetenceActivity(competenceId, eventId);
      onUpdated?.(saved as Competence);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activity.revertError"));
    } finally {
      setRevertingId(null);
    }
  };

  useEffect(() => {
    load();
  }, [competenceId]);

  const currentProgress = data?.progress || progress;
  const currentDue = data?.due_date ?? dueDate;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <CalendarClock className="h-4 w-4 text-primary" />
          {t("activity.planTitle")}
        </div>
        <DevelopmentDeadlineCard
          competenceId={competenceId}
          dueDate={currentDue}
          progress={currentProgress}
          onUpdated={(comp) => {
            onUpdated?.(comp);
            load();
          }}
        />
        {currentProgress?.steps?.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {currentProgress.steps.map((row) => (
              <li key={row.step} className="flex items-center gap-2 text-xs text-gray-600">
                <span className={`h-2 w-2 rounded-full ${row.done ? "bg-green-500" : "bg-gray-300"}`} />
                {t("activity.stepN", { n: row.step })} · {t(`activity.step.${row.key}`)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">{t("activity.contribTitle")}</h4>
        {data?.contributions?.length ? (
          <div className="space-y-3">
            {data.contributions.map((row) => (
              <ContributionRow key={row.user_id} row={row} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("activity.contribEmpty")}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ClipboardList className="h-4 w-4 text-primary" />
          {t("activity.journalTitle")}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {data?.events?.length ? (
          <ul className="space-y-3">
            {data.events.map((event) => (
              <li key={event.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: event.user?.color || "#2563EB" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={`text-sm text-gray-900 ${event.reverted ? "opacity-60" : ""}`}>
                        <span className="font-medium">{presenceShortName(event.user?.name || event.user?.email || "")}</span>
                        {" — "}
                        {eventText(t, event)}
                        {event.reverted ? (
                          <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                            {t("activity.reverted")}
                          </span>
                        ) : null}
                      </p>
                      {event.can_revert ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 gap-1 text-xs"
                          disabled={revertingId === event.id}
                          onClick={() => void revert(event.id)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          {revertingId === event.id ? t("activity.reverting") : t("activity.revert")}
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {event.created_at ? new Date(event.created_at).toLocaleString(intlLocale) : ""}
                      {!event.changes?.length && event.step ? ` · ${t("activity.stepN", { n: event.step })}` : ""}
                    </p>
                    {event.changes && event.changes.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {event.changes.map((change) => (
                          <div key={`${event.id}-${change.key || change.field}`} className="rounded-lg bg-gray-50 p-2">
                            <p className="mb-1 text-[11px] font-semibold text-gray-700">
                              {change.step
                                ? t("activity.stepField", {
                                    n: change.step,
                                    field: fieldLabel(t, change.field || change.key || ""),
                                  })
                                : fieldLabel(t, change.field || change.key || "")}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] font-medium text-red-700">{t("activity.before")}</p>
                                <p className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-800">
                                  {change.before_preview || t("activity.emptyValue")}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium text-green-700">{t("activity.after")}</p>
                                <p className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-800">
                                  {change.after_preview || t("activity.emptyValue")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : event.action === "edit" || event.action === "status" || event.action === "deadline" ? (
                      <p className="mt-1 text-[11px] text-gray-400">{t("activity.noDetails")}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t("activity.journalEmpty")}</p>
        )}
      </div>
    </div>
  );
}
