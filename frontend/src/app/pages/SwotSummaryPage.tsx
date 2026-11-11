import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Eraser, Sparkles } from "lucide-react";
import { apiClient } from "@/api/client";
import { useI18n } from "@/context/I18nContext";
import { PageShell } from "@/app/components/PageShell";
import { Button } from "@/components/ui/button";
import { SWOT_FIELD_ORDER, SWOT_FIELD_STYLES } from "@/lib/swotStyles";

type Summary = {
  id: number | null;
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
  resume: string;
  source_count: number;
  updated_at: string | null;
};

type ArchiveListItem = {
  id: number;
  title: string;
  source_count: number;
  entries_count: number;
  created_at: string | null;
  summary: {
    strengths: string;
    weaknesses: string;
    opportunities: string;
    threats: string;
    resume: string;
  };
};

type ArchiveDetail = {
  id: number;
  title: string;
  source_count: number;
  created_at: string | null;
  summary: ArchiveListItem["summary"];
  entries: {
    id: number;
    table_number: number;
    user_email: string;
    user_label: string;
    topic: string;
    topic_title: string;
    strengths: string;
    weaknesses: string;
    opportunities: string;
    threats: string;
  }[];
};

const emptySummary: Summary = {
  id: null,
  strengths: "",
  weaknesses: "",
  opportunities: "",
  threats: "",
  resume: "",
  source_count: 0,
  updated_at: null,
};

function QuadrantGrid({
  data,
}: {
  data: {
    strengths: string;
    weaknesses: string;
    opportunities: string;
    threats: string;
  };
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SWOT_FIELD_ORDER.map((field) => {
        const style = SWOT_FIELD_STYLES[field];
        return (
          <div key={field} className={style.panel}>
            <h3 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${style.title}`}>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${style.badge}`}
                aria-hidden
              >
                {style.letter}
              </span>
              {t(`swot.${field}`)}
            </h3>
            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
              {data[field] || "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function SwotSummaryPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);
  const [openArchiveId, setOpenArchiveId] = useState<number | null>(null);
  const [archiveDetail, setArchiveDetail] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, archivesData] = await Promise.all([
        apiClient.getSwotSummary(),
        apiClient.listSwotArchives(),
      ]);
      setSummary({ ...emptySummary, ...summaryData });
      setArchives(archivesData.archives || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("swot.summaryLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSynthesize = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await apiClient.synthesizeSwotSummary();
      setSummary({ ...emptySummary, ...data });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("swot.summarySynthError"));
    } finally {
      setBusy(false);
    }
  };

  const handleClearTables = async () => {
    if (!window.confirm(t("swot.clearConfirm"))) return;
    setClearing(true);
    setError("");
    setNotice("");
    try {
      const result = await apiClient.clearSwotTables();
      setSummary(emptySummary);
      setOpenArchiveId(result.archive.id);
      setArchiveDetail(null);
      await load();
      const detail = await apiClient.getSwotArchive(result.archive.id);
      setArchiveDetail(detail);
      setNotice(
        t("swot.clearDone", {
          archived: result.archived,
          title: result.archive.title,
        }),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("swot.clearError"));
    } finally {
      setClearing(false);
    }
  };

  const toggleArchive = async (archiveId: number) => {
    if (openArchiveId === archiveId) {
      setOpenArchiveId(null);
      return;
    }
    setOpenArchiveId(archiveId);
    setArchiveLoading(true);
    setError("");
    try {
      const detail = await apiClient.getSwotArchive(archiveId);
      setArchiveDetail(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("swot.archiveLoadError"));
      setOpenArchiveId(null);
    } finally {
      setArchiveLoading(false);
    }
  };

  const hasResult = Boolean(
    summary.resume.trim() ||
      summary.strengths.trim() ||
      summary.weaknesses.trim() ||
      summary.opportunities.trim() ||
      summary.threats.trim(),
  );

  const groupedEntries =
    archiveDetail?.entries.reduce<Record<number, ArchiveDetail["entries"]>>((acc, entry) => {
      (acc[entry.table_number] ||= []).push(entry);
      return acc;
    }, {}) || {};

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
        <h1 className="text-3xl font-bold text-gray-900">{t("swot.summaryTitle")}</h1>
        <p className="mt-2 text-gray-600">{t("swot.summaryLead")}</p>
      </div>

      <div className="surface p-6 shadow-md mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-gray-600 space-y-1">
            {summary.source_count > 0 ? (
              <p>{t("swot.summarySources", { count: summary.source_count })}</p>
            ) : (
              <p>{t("swot.summaryNoSourcesYet")}</p>
            )}
            {summary.updated_at ? (
              <p className="text-gray-500">
                {t("swot.summaryUpdated", {
                  time: new Date(summary.updated_at).toLocaleString(),
                })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              className="gap-2"
              disabled={clearing || loading || busy}
              onClick={() => void handleClearTables()}
            >
              <Eraser className="w-4 h-4" />
              {clearing ? t("swot.clearing") : t("swot.clearTables")}
            </Button>
            <Button
              className="gap-2"
              disabled={busy || loading || clearing}
              onClick={() => void handleSynthesize()}
            >
              <Sparkles className="w-4 h-4" />
              {busy ? t("swot.summaryWorking") : t("swot.summaryRun")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">{t("swot.clearHint")}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500">{t("swot.loading")}</p>
      ) : !hasResult ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-gray-600 mb-8">
          {t("swot.summaryEmpty")}
        </div>
      ) : (
        <div className="space-y-5 mb-8">
          <QuadrantGrid data={summary} />
          <div className="surface p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("swot.resume")}</h2>
            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
              {summary.resume || "—"}
            </p>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("swot.archivesTitle")}</h2>
          <p className="mt-1 text-sm text-gray-600">{t("swot.archivesLead")}</p>
        </div>

        {archives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center text-gray-600">
            {t("swot.archivesEmpty")}
          </div>
        ) : (
          <div className="space-y-3">
            {archives.map((archive) => {
              const open = openArchiveId === archive.id;
              return (
                <div key={archive.id} className="surface shadow-sm overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-gray-50"
                    onClick={() => void toggleArchive(archive.id)}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{archive.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {t("swot.archiveMeta", {
                          count: archive.source_count || archive.entries_count,
                          time: archive.created_at
                            ? new Date(archive.created_at).toLocaleString()
                            : "—",
                        })}
                      </div>
                    </div>
                    <span className="text-sm text-primary shrink-0">
                      {open ? t("swot.archiveHide") : t("swot.archiveShow")}
                    </span>
                  </button>

                  {open ? (
                    <div className="border-t border-gray-100 px-5 py-5 space-y-6 bg-gray-50/50">
                      {archiveLoading && archiveDetail?.id !== archive.id ? (
                        <p className="text-sm text-gray-500">{t("swot.loading")}</p>
                      ) : archiveDetail?.id === archive.id ? (
                        <>
                          {(archiveDetail.summary.strengths ||
                            archiveDetail.summary.weaknesses ||
                            archiveDetail.summary.opportunities ||
                            archiveDetail.summary.threats ||
                            archiveDetail.summary.resume) && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-semibold text-gray-800">
                                {t("swot.archiveSavedSummary")}
                              </h3>
                              <QuadrantGrid data={archiveDetail.summary} />
                              {archiveDetail.summary.resume ? (
                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                  <h4 className="text-sm font-semibold text-gray-800 mb-2">
                                    {t("swot.resume")}
                                  </h4>
                                  <p className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                                    {archiveDetail.summary.resume}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-800">
                              {t("swot.archiveTableEntries")}
                            </h3>
                            {Object.keys(groupedEntries)
                              .map(Number)
                              .sort((a, b) => a - b)
                              .map((tableNo) => (
                                <div key={tableNo} className="space-y-3">
                                  <h4 className="text-sm font-medium text-gray-700">
                                    {t("swot.tableName", { n: tableNo })}
                                  </h4>
                                  {groupedEntries[tableNo].map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
                                    >
                                      <div className="text-sm text-gray-700">
                                        <div className="font-medium">{entry.topic_title}</div>
                                        <div className="text-gray-500 mt-0.5">
                                          {entry.user_label || entry.user_email || "—"}
                                          {entry.user_label && entry.user_email
                                            ? ` · ${entry.user_email}`
                                            : ""}
                                        </div>
                                      </div>
                                      <QuadrantGrid data={entry} />
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
