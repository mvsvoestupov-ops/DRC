import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Search,
  Plus,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  Archive,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence, CompetenceInvite, CompetenceStats } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { translateAreaName } from "@/i18n/helpers";
import {
  toListItem,
  statusColors,
  type CompetenceListItem,
} from "@/lib/competenceMappers";
import { PROFESSIONAL_AREAS, areaDisplayCode } from "@/lib/professionalAreas";

const AREAS_PER_PAGE = 12;

type StatCardProps = {
  to: string;
  state?: { from: string };
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  value: number | string;
  label: string;
  trend?: boolean;
  loading?: boolean;
};

function StatCard({ to, state, icon: Icon, color, bg, value, label, trend, loading, intlLocale }: StatCardProps & { intlLocale: string }) {
  return (
    <Link
      to={to}
      state={state}
      className="block surface p-8 shadow-md hover:shadow-lg hover:border-primary/40 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className="w-7 h-7" style={{ color }} />
        </div>
        {trend && <TrendingUp className="w-6 h-6 text-emerald-500" />}
      </div>
      <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
        {loading ? "—" : typeof value === "number" ? value.toLocaleString(intlLocale) : value}
      </div>
      <div className="text-base text-gray-500 font-medium group-hover:text-gray-700 transition-colors">{label}</div>
    </Link>
  );
}

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const { t, intlLocale } = useI18n();
  const [recentCompetencies, setRecentCompetencies] = useState<CompetenceListItem[]>([]);
  const [stats, setStats] = useState<CompetenceStats>({ total: 0, active: 0, review: 0, archived: 0 });
  const [invites, setInvites] = useState<CompetenceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaPage, setAreaPage] = useState(0);

  const totalAreaPages = Math.ceil(PROFESSIONAL_AREAS.length / AREAS_PER_PAGE);
  const pageAreas = PROFESSIONAL_AREAS.slice(
    areaPage * AREAS_PER_PAGE,
    (areaPage + 1) * AREAS_PER_PAGE,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setInvites([]);
      return;
    }
    apiClient.listCompetenceInvites()
      .then((rows) => setInvites(Array.isArray(rows) ? rows : []))
      .catch(() => setInvites([]));
  }, [isAuthenticated]);

  useEffect(() => {
    Promise.all([
      apiClient.getPublicCompetenceStats(),
      apiClient.getPublicCompetences(),
    ])
      .then(([statsData, competences]) => {
        setStats(statsData);
        const items = (competences as Competence[]).slice(0, 3).map(toListItem);
        setRecentCompetencies(items);
      })
      .catch(() => {
        setStats({ total: 0, active: 0, review: 0, archived: 0 });
        setRecentCompetencies([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-page">
      <div className="bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6] text-white">
        <div className="site-wrap py-20">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold leading-tight mb-6">
              {t("home.title")}
            </h1>
            <p className="text-xl leading-relaxed opacity-95 mb-10">
              {t("home.lead")}
            </p>
            <div className="flex gap-4">
              <Link
                to="/search"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-primary rounded-lg text-base font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <Search className="w-5 h-5" />
                {t("home.find")}
              </Link>
              <Link
                to="/new"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 text-white rounded-lg text-base font-semibold border-2 border-white/30 hover:bg-white/20 transition-all"
              >
                <Plus className="w-5 h-5" />
                {t("home.propose")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="site-wrap -mt-12">
        {invites.length > 0 ? (
          <Link
            to="/my-projects"
            className="block mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm hover:border-amber-300"
          >
            <p className="font-semibold">
              {t("home.invitesTitle", { count: invites.length })}
            </p>
            <p className="text-base mt-1">
              {t("home.invitesText", {
                suffix: invites[0]?.competence_name
                  ? t("home.invitesSuffix", { name: invites[0].competence_name })
                  : "",
              })}
            </p>
          </Link>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            to="/search"
            icon={FileText}
            color="#3B82F6"
            bg="#EFF6FF"
            value={stats.total}
            label={t("home.statsTotal")}
            trend
            loading={loading}
            intlLocale={intlLocale}
          />
          <StatCard
            to="/search?status=active"
            icon={CheckCircle}
            color="#10B981"
            bg="#ECFDF5"
            value={stats.active}
            label={t("home.statsActive")}
            loading={loading}
            intlLocale={intlLocale}
          />
          <StatCard
            to="/search?status=review"
            icon={Clock}
            color="#F59E0B"
            bg="#FEF3C7"
            value={stats.review}
            label={t("home.statsReview")}
            loading={loading}
            intlLocale={intlLocale}
          />
          <StatCard
            to="/search?status=archived"
            icon={Archive}
            color="#64748B"
            bg="#F1F5F9"
            value={stats.archived}
            label={t("home.statsArchived")}
            loading={loading}
            intlLocale={intlLocale}
          />
        </div>

        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t("home.recentTitle")}
              </h2>
              <p className="text-base text-gray-500">
                {t("home.recentLead")}
              </p>
            </div>
            <Link to="/search" className="text-base font-semibold text-primary hover:underline">
              {t("home.viewAll")}
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">{t("home.loading")}</div>
          ) : recentCompetencies.length === 0 ? (
            <div className="surface p-12 text-center text-gray-500">
              {t("home.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentCompetencies.map((competency) => (
                <Link
                  key={competency.id}
                  to={`/competency/${competency.id}`}
                  className="block surface p-6 hover:shadow-lg hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-base font-mono text-primary font-semibold">
                      {competency.displayId}
                    </span>
                    <span className={`status-pill ${statusColors[competency.status]}`}>
                      {t(`status.${competency.status}`)}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-relaxed line-clamp-2">
                    {competency.title}
                  </h3>
                  <div className="flex items-center gap-2 text-base text-gray-500">
                    <Building2 className="w-4 h-4" />
                    {competency.industry}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="pb-16">
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t("home.areasTitle")}
              </h2>
              <p className="text-base text-gray-500">
                {t("home.areasLead")}
              </p>
            </div>
            <div className="text-base text-gray-500 whitespace-nowrap">
              {areaPage + 1} / {totalAreaPages}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pageAreas.map((area) => (
              <Link
                key={area.code}
                to={`/search?area=${encodeURIComponent(area.code)}`}
                className="block surface p-5 rounded-xl min-h-[148px] text-left hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div className="text-sm font-mono font-semibold text-primary mb-2">
                  {areaDisplayCode(area)}
                </div>
                <div className="text-base font-medium text-gray-700 leading-snug group-hover:text-primary">
                  {translateAreaName(t, area.code, area.name)}
                </div>
              </Link>
            ))}
          </div>
          {totalAreaPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setAreaPage((page) => Math.max(0, page - 1))}
                disabled={areaPage === 0}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
                aria-label={t("home.prevPage")}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: totalAreaPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setAreaPage(index)}
                  className="w-10 h-10 rounded-lg text-base font-semibold border transition-all"
                  style={
                    index === areaPage
                      ? { backgroundColor: "#1E40AF", color: "#fff", borderColor: "#1E40AF" }
                      : { backgroundColor: "#fff", color: "#374151", borderColor: "#e5e7eb" }
                  }
                  aria-label={t("home.page", { n: index + 1 })}
                  aria-current={index === areaPage ? "page" : undefined}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAreaPage((page) => Math.min(totalAreaPages - 1, page + 1))}
                disabled={areaPage >= totalAreaPages - 1}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
                aria-label={t("home.nextPage")}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
