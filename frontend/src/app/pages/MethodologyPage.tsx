import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, ClipboardList, Globe2, Grid3x3, Scale, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";
import { METHODOLOGY_TOPICS, isMethodologyTopicId } from "@/lib/methodologyTopics";

const TOPIC_ICONS: Record<(typeof METHODOLOGY_TOPICS)[number]["id"], LucideIcon> = {
  harmonization: Globe2,
  scoring: Scale,
  fos: ClipboardList,
  passport: BookOpen,
  matrix: Grid3x3,
};

export function MethodologyPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const redirectFromHash = () => {
      const id = window.location.hash.replace("#", "");
      if (isMethodologyTopicId(id)) {
        navigate(`/methodology/${id}`, { replace: true });
      }
    };
    redirectFromHash();
    window.addEventListener("hashchange", redirectFromHash);
    return () => window.removeEventListener("hashchange", redirectFromHash);
  }, [navigate]);

  return (
    <PageShell>
      <PageHeader title={t("methodology.title")} description={t("methodology.lead")} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {METHODOLOGY_TOPICS.map((item) => {
          const Icon = TOPIC_ICONS[item.id];
          return (
            <Link
              key={item.id}
              to={`/methodology/${item.id}`}
              className="block surface p-5 hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-primary mb-1">
                    {t("methodology.cardBadge")}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">{t(item.titleKey)}</h2>
                  <p className="text-base text-gray-500">{t(item.descKey)}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
