import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Save } from "lucide-react";
import { apiClient } from "@/api/client";
import { useI18n } from "@/context/I18nContext";
import { PageShell } from "@/app/components/PageShell";
import { Button } from "@/components/ui/button";
import { SWOT_FIELD_ORDER, SWOT_FIELD_STYLES, type SwotField } from "@/lib/swotStyles";

const TOPICS = [
  "network_programs",
  "graduate_selection",
  "education_export",
  "migration_regulation",
] as const;

type Topic = (typeof TOPICS)[number];

type AnalysisForm = {
  topic: string;
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

const emptyForm = (topic: string): AnalysisForm => ({
  topic,
  strengths: "",
  weaknesses: "",
  opportunities: "",
  threats: "",
});

const AUTOSAVE_MS = 1500;

export function SwotTableWorkspacePage() {
  const { tableId: tableIdParam } = useParams<{ tableId: string }>();
  const tableId = Number(tableIdParam);
  const { t } = useI18n();
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<string, AnalysisForm>>({});
  const [activeTopic, setActiveTopic] = useState<Topic>("network_programs");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [autoNote, setAutoNote] = useState(false);

  const formsRef = useRef(forms);
  const activeTopicRef = useRef(activeTopic);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  formsRef.current = forms;
  activeTopicRef.current = activeTopic;
  dirtyRef.current = dirty;
  savingRef.current = saving;

  const load = useCallback(async () => {
    if (!Number.isFinite(tableId) || tableId <= 0) {
      setError(t("swot.tableNotFound"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.getSwotTable(tableId);
      setTableNumber(data.number);
      const next: Record<string, AnalysisForm> = {};
      for (const topic of TOPICS) {
        const row = data.analyses.find((item) => item.topic === topic);
        next[topic] = {
          topic,
          strengths: row?.strengths || "",
          weaknesses: row?.weaknesses || "",
          opportunities: row?.opportunities || "",
          threats: row?.threats || "",
        };
      }
      setForms(next);
      setDirty(false);
      setSavedAt(null);
      setAutoNote(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("swot.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tableId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (opts?: { manual?: boolean }) => {
      if (!Number.isFinite(tableId) || tableId <= 0) return;
      if (savingRef.current) return;
      const topic = activeTopicRef.current;
      const form = formsRef.current[topic] || emptyForm(topic);
      setSaving(true);
      setError("");
      try {
        await apiClient.saveSwotAnalysis(tableId, topic, {
          strengths: form.strengths,
          weaknesses: form.weaknesses,
          opportunities: form.opportunities,
          threats: form.threats,
        });
        setDirty(false);
        setAutoNote(!opts?.manual);
        setSavedAt(
          new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("swot.saveError"));
      } finally {
        setSaving(false);
      }
    },
    [tableId, t],
  );

  // Автосохранение текущей темы через 1.5 с после изменений
  useEffect(() => {
    if (loading || !dirty) return;
    const timer = window.setTimeout(() => {
      void persist({ manual: false });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, forms, activeTopic, loading, persist]);

  // При смене темы — сразу сохранить предыдущую, если была грязная
  const prevTopicRef = useRef(activeTopic);
  useEffect(() => {
    const prev = prevTopicRef.current;
    if (prev !== activeTopic && dirtyRef.current) {
      const form = formsRef.current[prev] || emptyForm(prev);
      void (async () => {
        try {
          await apiClient.saveSwotAnalysis(tableId, prev, {
            strengths: form.strengths,
            weaknesses: form.weaknesses,
            opportunities: form.opportunities,
            threats: form.threats,
          });
        } catch {
          /* не блокируем переключение темы */
        }
      })();
    }
    prevTopicRef.current = activeTopic;
  }, [activeTopic, tableId]);

  const current = forms[activeTopic] || emptyForm(activeTopic);

  const topicFilled = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const topic of TOPICS) {
      const form = forms[topic];
      map[topic] = Boolean(
        form &&
          [form.strengths, form.weaknesses, form.opportunities, form.threats].some((v) =>
            v.trim(),
          ),
      );
    }
    return map;
  }, [forms]);

  const updateField = (field: keyof Omit<AnalysisForm, "topic">, value: string) => {
    setForms((prev) => ({
      ...prev,
      [activeTopic]: {
        ...(prev[activeTopic] || emptyForm(activeTopic)),
        [field]: value,
      },
    }));
    setDirty(true);
    setSavedAt(null);
    setAutoNote(false);
  };

  return (
    <PageShell narrow>
      <div className="mb-6">
        <Link
          to="/swot"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("swot.backToTables")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {tableNumber != null
            ? t(`swot.tableNames.${tableNumber}`)
            : t("swot.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("swot.workspaceLead")}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500">{t("swot.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {TOPICS.map((topic) => {
              const active = topic === activeTopic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setActiveTopic(topic)}
                  className={`text-left rounded-xl border px-4 py-3 transition-all ${
                    active
                      ? "border-primary bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-gray-900 text-sm leading-snug">
                      {t(`swot.topics.${topic}`)}
                    </span>
                    {topicFilled[topic] ? (
                      <span className="shrink-0 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        {t("swot.filled")}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                        {t("swot.empty")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="surface p-6 shadow-md space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {t(`swot.topics.${activeTopic}`)}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SWOT_FIELD_ORDER.map((field) => {
                const style = SWOT_FIELD_STYLES[field];
                const labelKey = `swot.${field}` as const;
                const hintKey = `swot.${field}Hint` as const;
                return (
                  <div key={field} className={style.panel}>
                    <label
                      className={`mb-2 flex items-center gap-2 text-sm font-semibold ${style.title}`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${style.badge}`}
                        aria-hidden
                      >
                        {style.letter}
                      </span>
                      {t(labelKey)}
                    </label>
                    <textarea
                      value={current[field]}
                      onChange={(e) => updateField(field as SwotField, e.target.value)}
                      rows={5}
                      className={style.input}
                      placeholder={t(hintKey)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-sm text-gray-500">
                {saving
                  ? t("swot.saving")
                  : savedAt
                    ? autoNote
                      ? t("swot.autoSavedAt", { time: savedAt })
                      : t("swot.savedAt", { time: savedAt })
                    : dirty
                      ? t("swot.unsaved")
                      : t("swot.idle")}
              </span>
              <Button
                className="gap-2"
                disabled={saving}
                onClick={() => void persist({ manual: true })}
              >
                <Save className="w-4 h-4" />
                {saving ? t("swot.saving") : t("swot.save")}
              </Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
