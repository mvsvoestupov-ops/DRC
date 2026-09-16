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
  GraduationCap,
  Database,
  Globe,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence, CompetenceStats, PublicQualificationItem, PublicQualificationStats } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import {
  toListItem,
  statusColors,
  statusLabels,
  defaultIndustries,
  type CompetenceListItem,
} from "@/lib/competenceMappers";

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

function StatCard({ to, state, icon: Icon, color, bg, value, label, trend, loading }: StatCardProps) {
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
        {loading ? "—" : typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      <div className="text-sm text-gray-500 font-medium group-hover:text-gray-700 transition-colors">{label}</div>
    </Link>
  );
}

export function HomePage() {
  const { isAdmin } = useAuth();
  const [recentCompetencies, setRecentCompetencies] = useState<CompetenceListItem[]>([]);
  const [recentQualifications, setRecentQualifications] = useState<PublicQualificationItem[]>([]);
  const [industries, setIndustries] = useState<string[]>(defaultIndustries);
  const [stats, setStats] = useState<CompetenceStats>({ total: 0, active: 0, review: 0, archived: 0 });
  const [qualStats, setQualStats] = useState<PublicQualificationStats>({ local_count: 0, expected: 0, missing: 0 });
  const [loading, setLoading] = useState(true);
  const [qualLoading, setQualLoading] = useState(true);

  const qualListHref = isAdmin ? "/qualifications" : "/";
  const qualListState = undefined;
  const qualDetailHref = (id: number) => (isAdmin ? `/qualifications/${id}` : "/");
  const qualDetailState = (_id: number) => undefined;

  useEffect(() => {
    Promise.all([
      apiClient.getPublicCompetenceStats(),
      apiClient.getPublicCompetences(),
    ])
      .then(([statsData, competences]) => {
        setStats(statsData);
        const items = (competences as Competence[]).slice(0, 3).map(toListItem);
        setRecentCompetencies(items);
        const fromApi = [...new Set(
          (competences as Competence[])
            .map((c) => c.industry || (c as Competence & { raw_data?: { industry?: string } }).raw_data?.industry)
            .filter(Boolean) as string[]
        )];
        if (fromApi.length > 0) {
          setIndustries([...new Set([...fromApi, ...defaultIndustries])]);
        }
      })
      .catch(() => {
        setStats({ total: 0, active: 0, review: 0, archived: 0 });
        setRecentCompetencies([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      apiClient.getPublicQualificationStats(),
      apiClient.getPublicQualifications(3),
    ])
      .then(([statsData, qualifications]) => {
        setQualStats(statsData);
        setRecentQualifications(qualifications);
      })
      .catch(() => {
        setQualStats({ local_count: 0, expected: 0, missing: 0 });
        setRecentQualifications([]);
      })
      .finally(() => setQualLoading(false));
  }, []);

  return (
    <div className="bg-page">
      <div className="bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6] text-white">
        <div className="max-w-[1440px] mx-auto px-8 py-20">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Национальный реестр компетенций
            </h1>
            <p className="text-xl leading-relaxed opacity-95 mb-10">
              Единая система управления компетенциями для гармонизации образовательных программ,
              профессиональных стандартов и требований работодателей
            </p>
            <div className="flex gap-4">
              <Link
                to="/search"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-primary rounded-lg text-base font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <Search className="w-5 h-5" />
                Найти компетенцию
              </Link>
              <Link
                to="/new"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 text-white rounded-lg text-base font-semibold border-2 border-white/30 hover:bg-white/20 transition-all"
              >
                <Plus className="w-5 h-5" />
                Предложить компетенцию
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-8 -mt-12">
        <div className="grid grid-cols-4 gap-6 mb-10">
          <StatCard
            to="/search"
            icon={FileText}
            color="#3B82F6"
            bg="#EFF6FF"
            value={stats.total}
            label="Всего компетенций"
            trend
            loading={loading}
          />
          <StatCard
            to="/search?status=active"
            icon={CheckCircle}
            color="#10B981"
            bg="#ECFDF5"
            value={stats.active}
            label="Действующих компетенций"
            loading={loading}
          />
          <StatCard
            to="/search?status=review"
            icon={Clock}
            color="#F59E0B"
            bg="#FEF3C7"
            value={stats.review}
            label="На экспертизе"
            loading={loading}
          />
          <StatCard
            to="/search?status=archived"
            icon={Archive}
            color="#64748B"
            bg="#F1F5F9"
            value={stats.archived}
            label="Архивных записей"
            loading={loading}
          />
        </div>

        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Квалификации НАРК</h2>
              <p className="text-sm text-gray-500">
                Сводка по профессиональным квалификациям из реестра НАРК
              </p>
            </div>
            <Link
              to={qualListHref}
              state={qualListState}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Смотреть все →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <StatCard
              to={qualListHref}
              state={qualListState}
              icon={Database}
              color="#6366F1"
              bg="#EEF2FF"
              value={qualStats.local_count}
              label="В локальной базе"
              loading={qualLoading}
            />
            <StatCard
              to={qualListHref}
              state={qualListState}
              icon={Globe}
              color="#0EA5E9"
              bg="#E0F2FE"
              value={qualStats.expected}
              label="На сайте НАРК"
              loading={qualLoading}
            />
            <StatCard
              to={qualListHref}
              state={qualListState}
              icon={AlertCircle}
              color="#F97316"
              bg="#FFF7ED"
              value={qualStats.missing}
              label="Требуют загрузки"
              loading={qualLoading}
            />
          </div>

          {qualLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка квалификаций...</div>
          ) : recentQualifications.length === 0 ? (
            <div className="surface p-8 text-center text-gray-500">
              Квалификации пока не загружены в базу
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {recentQualifications.map((qual) => (
                <Link
                  key={qual.id}
                  to={qualDetailHref(qual.id)}
                  state={qualDetailState(qual.id)}
                  className="block surface p-6 hover:shadow-lg hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-sm font-mono text-primary font-semibold">
                      {qual.code || `ID ${qual.id}`}
                    </span>
                    {qual.level && (
                      <span className="status-pill bg-indigo-50 text-indigo-700 border-indigo-200">
                        Ур. {qual.level}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 leading-relaxed line-clamp-2">
                    {qual.name}
                  </h3>
                  {qual.activity_area && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <GraduationCap className="w-4 h-4 flex-shrink-0" />
                      <span className="line-clamp-1">{qual.activity_area}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Последние добавленные компетенции
              </h2>
              <p className="text-sm text-gray-500">
                Недавно утверждённые и добавленные в реестр
              </p>
            </div>
            <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
              Смотреть все →
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Загрузка...</div>
          ) : recentCompetencies.length === 0 ? (
            <div className="surface p-12 text-center text-gray-500">
              Компетенции пока не добавлены в реестр
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {recentCompetencies.map((competency) => (
                <Link
                  key={competency.id}
                  to={`/competency/${competency.id}`}
                  className="block surface p-6 hover:shadow-lg hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-sm font-mono text-primary font-semibold">
                      {competency.displayId}
                    </span>
                    <span className={`status-pill ${statusColors[competency.status]}`}>
                      {statusLabels[competency.status]}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 leading-relaxed line-clamp-2">
                    {competency.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="w-4 h-4" />
                    {competency.industry}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="pb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Популярные отрасли</h2>
            <p className="text-sm text-gray-500">Найдите компетенции по отраслям экономики</p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {industries.map((industry) => (
              <Link
                key={industry}
                to={`/search?industry=${encodeURIComponent(industry)}`}
                className="block surface p-5 rounded-xl text-center text-sm font-medium text-gray-700 hover:shadow-md hover:border-primary/40 hover:text-primary transition-all"
              >
                {industry}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
