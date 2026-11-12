import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Users, CheckCircle2, Table2, Sparkles } from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { PageShell } from "@/app/components/PageShell";

type SwotTableCard = {
  id: number;
  number: number;
  title: string;
  participants: number;
  my_filled_topics: number;
  my_total_topics: number;
};

export function SwotTablesPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [tables, setTables] = useState<SwotTableCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .listSwotTables()
      .then((res) => {
        if (!cancelled) setTables(res.tables || []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("swot.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <PageShell>
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("swot.title")}</h1>
            <p className="mt-2 text-gray-600 max-w-3xl">{t("swot.lead")}</p>
          </div>
          {isAdmin ? (
            <Link
              to="/admin/swot"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90"
            >
              <Sparkles className="w-4 h-4" />
              {t("swot.summaryTitle")}
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500">{t("swot.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tables.map((table) => {
            const done = table.my_filled_topics >= table.my_total_topics && table.my_total_topics > 0;
            return (
              <Link
                key={table.id}
                to={`/swot/${table.id}`}
                className="surface p-6 shadow-md hover:shadow-lg hover:border-primary/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
                    <Table2 className="w-6 h-6" />
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("swot.done")}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
                  {t(`swot.tableNames.${table.number}`)}
                </h2>
                <p className="mt-2 text-sm text-gray-600">{t("swot.tableHint")}</p>
                <div className="mt-5 flex items-center justify-between text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {t("swot.participants", { count: table.participants })}
                  </span>
                  <span>
                    {t("swot.progress", {
                      filled: table.my_filled_topics,
                      total: table.my_total_topics,
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
