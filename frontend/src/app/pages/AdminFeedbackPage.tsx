import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { apiClient } from "@/api/client";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";

type FeedbackItem = {
  id: number;
  section: string;
  text: string;
  attachments: Array<{
    id: string;
    kind: string;
    name: string;
    mime: string;
    url: string;
    size: number;
  }>;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string | null;
};

const SECTION_KEYS: Record<string, string> = {
  project: "feedback.sectionProject",
  methodology: "feedback.sectionMethodology",
  wizard: "feedback.sectionWizard",
  bug: "feedback.sectionBug",
  other: "feedback.sectionOther",
};

export function AdminFeedbackPage() {
  const { t, intlLocale } = useI18n();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient
      .getFeedback()
      .then((data) => setItems(data || []))
      .catch(() => setError(t("feedback.adminLoadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(intlLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  return (
    <PageShell>
      <PageHeader title={t("feedback.adminTitle")} description={t("feedback.adminLead")} />
      {loading ? <p className="text-sm text-gray-500">{t("common.loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("feedback.adminEmpty")}</p>
      ) : null}
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="surface p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {item.user_name || item.user_email || t("feedback.anonymous")}
                </div>
                {item.user_email && item.user_name ? (
                  <div className="text-xs text-gray-500">{item.user_email}</div>
                ) : null}
              </div>
              <div className="text-right text-xs text-gray-500 space-y-1">
                <div>{formatDate(item.created_at)}</div>
                <div className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  {t(SECTION_KEYS[item.section] || "feedback.sectionOther")}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.text}</p>
            {item.attachments?.length ? (
              <ul className="flex flex-wrap gap-2">
                {item.attachments.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:border-primary hover:text-primary"
                      onClick={() => {
                        void apiClient.openFeedbackMedia(file.id, file.name).catch(() => {
                          setError(t("feedback.adminOpenError"));
                        });
                      }}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="max-w-[220px] truncate">{file.name || file.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </PageShell>
  );
}
