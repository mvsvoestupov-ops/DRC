import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, AlertCircle, MessageSquare, Calendar } from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence } from "@/api/types";
import { formatCompetenceId } from "@/lib/competenceMappers";
import { formatUserName } from "@/lib/userDisplay";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useAuth } from "@/context/AuthContext";

const MIN_REVIEWERS = 3;

interface ReviewItem {
  id: number;
  competencyId: string;
  title: string;
  submittedBy: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected" | "revision";
  expert: string;
  reviewerCount: number;
}

function mapCompetenceToReview(comp: Competence): ReviewItem {
  const apiStatus = comp.status;
  let status: ReviewItem["status"] = "pending";
  if (apiStatus === "утверждена") status = "approved";
  else if (apiStatus === "проект") status = "revision";
  else if (apiStatus === "на экспертизе") status = "pending";

  const reviewers = comp.reviewers || [];

  return {
    id: comp.id,
    competencyId: formatCompetenceId(comp.id),
    title: comp.name,
    submittedBy: comp.developer || "—",
    submittedDate: comp.created_at || new Date().toISOString(),
    status,
    expert: reviewers.map((row) => formatUserName(row) || row.email).join(", ") || "Не назначены",
    reviewerCount: reviewers.length,
  };
}

export function AdminPage() {
  const navigate = useNavigate();
  const { isModerator, isAdmin } = useAuth();
  const [filter, setFilter] = useState<string>(isModerator && !isAdmin ? "pending" : "all");
  const [applications, setApplications] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient.getCompetences()
      .then((data) => {
        const reviewItems = (data as Competence[])
          .filter((c) => c.status === "на экспертизе" || c.status === "утверждена" || c.status === "проект")
          .map(mapCompetenceToReview);
        setApplications(reviewItems);
      })
      .catch(() => setError("Не удалось загрузить заявки."))
      .finally(() => setLoading(false));
  }, []);

  const filteredApplications = filter === "all"
    ? applications
    : applications.filter((app) => app.status === filter);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    revision: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const statusLabels: Record<string, string> = {
    pending: "На рассмотрении",
    approved: "Одобрено",
    rejected: "Отклонено",
    revision: "На доработке",
  };

  const stats = [
    { key: "all", icon: AlertCircle, color: "text-gray-400", label: "Всего", value: applications.length },
    { key: "pending", icon: Calendar, color: "text-yellow-400", label: "На рассмотрении", value: applications.filter((a) => a.status === "pending").length, valueColor: "text-yellow-600" },
    { key: "approved", icon: CheckCircle, color: "text-green-400", label: "Одобрено", value: applications.filter((a) => a.status === "approved").length, valueColor: "text-green-600" },
    { key: "revision", icon: MessageSquare, color: "text-blue-400", label: "На доработке", value: applications.filter((a) => a.status === "revision").length, valueColor: "text-blue-600" },
  ];

  return (
    <PageShell>
      <PageHeader
        title={isModerator ? "Панель модератора" : "Панель эксперта"}
        description={
          isModerator
            ? "Компетенции на рассмотрении. Назначьте не менее трёх экспертов."
            : "Утверждённые компетенции и заявки, назначенные вам на экспертизу."
        }
      />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const active = filter === stat.key;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setFilter(stat.key)}
              aria-pressed={active}
              className={`surface-padded w-full text-left cursor-pointer transition-shadow ${
                active
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.valueColor || "text-gray-900"}`}>
                    {loading ? "—" : stat.value}
                  </p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Нет компетенций для отображения</div>
        ) : (
          <table className="data-table min-w-full">
            <thead>
              <tr>
                {["ID заявки", "Название компетенции", "Дата подачи", "Статус", "Эксперты"].map((head) => (
                  <th key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/competency/${app.id}`)}
                  className="cursor-pointer"
                >
                  <td>
                    <span className="font-mono text-primary">{app.competencyId}</span>
                  </td>
                  <td>
                    <p className="line-clamp-2">{app.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{app.submittedBy}</p>
                  </td>
                  <td className="whitespace-nowrap text-gray-500">
                    {new Date(app.submittedDate).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`status-pill ${statusColors[app.status]}`}>
                      {statusLabels[app.status]}
                    </span>
                  </td>
                  <td className="text-gray-500 max-w-[220px]">
                    <span className="line-clamp-2">{app.expert}</span>
                    {app.status === "pending" && app.reviewerCount < MIN_REVIEWERS ? (
                      <span className="block text-xs text-amber-700 mt-1">Нужно не менее {MIN_REVIEWERS}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
