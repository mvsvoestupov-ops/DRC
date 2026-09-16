import { useState, useEffect } from "react";
import { Link } from "react-router";
import { CheckCircle, XCircle, AlertCircle, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import type { Competence } from "@/api/types";
import { formatCompetenceId } from "@/lib/competenceMappers";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";

interface ReviewItem {
  id: number;
  competencyId: string;
  title: string;
  submittedBy: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected" | "revision";
  expert: string;
  comments: { author: string; date: string; text: string }[];
}

function mapCompetenceToReview(comp: Competence): ReviewItem {
  const apiStatus = comp.status;
  let status: ReviewItem["status"] = "pending";
  if (apiStatus === "утверждена") status = "approved";
  else if (apiStatus === "проект") status = "revision";
  else if (apiStatus === "на экспертизе") status = "pending";

  const comments = (comp as Competence & { validation_notes?: string }).validation_notes
    ? [{
        author: (comp as Competence & { validator?: string }).validator || "Эксперт",
        date: comp.updated_at || comp.created_at || new Date().toISOString(),
        text: (comp as Competence & { validation_notes?: string }).validation_notes!,
      }]
    : [];

  return {
    id: comp.id,
    competencyId: formatCompetenceId(comp.id),
    title: comp.name,
    submittedBy: comp.developer || "—",
    submittedDate: comp.created_at || new Date().toISOString(),
    status,
    expert: (comp as Competence & { validator?: string }).validator || "—",
    comments,
  };
}

export function AdminPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<ReviewItem | null>(null);
  const [commentText, setCommentText] = useState("");
  const [applications, setApplications] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const loadApplications = () => {
    setLoading(true);
    setError("");
    apiClient.getCompetences()
      .then((data) => {
        const reviewItems = (data as Competence[])
          .filter((c) => c.status === "на экспертизе" || c.status === "утверждена" || c.status === "проект")
          .map(mapCompetenceToReview);
        setApplications(reviewItems);
      })
      .catch(() => setError("Не удалось загрузить заявки. Нужны права эксперта или администратора."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApplications();
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

  const updateStatus = async (app: ReviewItem, status: string, notes?: string) => {
    setActionLoading(true);
    try {
      await apiClient.updateCompetence(app.id, {
        status,
        ...(notes ? { validation_notes: notes } : {}),
      });
      loadApplications();
      setSelectedApplication(null);
      setCommentText("");
    } catch {
      setError("Ошибка при обновлении статуса");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (app: ReviewItem) => updateStatus(app, "утверждена");
  const handleReject = (app: ReviewItem) => updateStatus(app, "проект", "Заявка отклонена экспертом");
  const handleRevision = (app: ReviewItem) => updateStatus(app, "проект", commentText || "Требуется доработка");

  const addComment = () => {
    if (commentText.trim() && selectedApplication) {
      handleRevision(selectedApplication);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Панель модератора"
        description="Управление заявками на новые компетенции"
      />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { icon: AlertCircle, color: "text-gray-400", label: "Всего заявок", value: applications.length },
          { icon: Calendar, color: "text-yellow-400", label: "На рассмотрении", value: applications.filter(a => a.status === "pending").length, valueColor: "text-yellow-600" },
          { icon: CheckCircle, color: "text-green-400", label: "Одобрено", value: applications.filter(a => a.status === "approved").length, valueColor: "text-green-600" },
          { icon: MessageSquare, color: "text-blue-400", label: "На доработке", value: applications.filter(a => a.status === "revision").length, valueColor: "text-blue-600" },
        ].map((stat, idx) => (
          <div key={idx} className="surface-padded">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.valueColor || "text-gray-900"}`}>
                  {loading ? "—" : stat.value}
                </p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="surface-padded mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Фильтр:</span>
              {[
                { key: "all", label: "Все" },
                { key: "pending", label: "На рассмотрении" },
                { key: "revision", label: "На доработке" },
                { key: "approved", label: "Одобрено" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    filter === item.key ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="surface overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Загрузка...</div>
            ) : (
              <table className="data-table min-w-full">
                <thead>
                  <tr>
                    {["ID заявки", "Название компетенции", "Дата подачи", "Статус", "Эксперт"].map((head) => (
                      <th key={head}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApplication(app)}
                      className={`cursor-pointer ${selectedApplication?.id === app.id ? "bg-blue-50" : ""}`}
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
                      <td className="whitespace-nowrap text-gray-500">{app.expert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selectedApplication && (
          <div className="w-96 flex-shrink-0">
            <div className="surface-padded sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Детали заявки {selectedApplication.competencyId}
              </h2>

              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Компетенция</h3>
                  <p className="text-sm text-gray-900">{selectedApplication.title}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Подана</h3>
                  <p className="text-sm text-gray-900">{selectedApplication.submittedBy}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(selectedApplication.submittedDate).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div>
                  <Link to={`/competency/${selectedApplication.id}`} className="text-sm text-primary hover:underline">
                    Просмотреть полную карточку компетенции →
                  </Link>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">История комментариев</h3>
                {selectedApplication.comments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedApplication.comments.map((comment, index) => (
                      <div key={index} className="bg-secondary rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-900">{comment.author}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.date).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Комментариев пока нет</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Добавить комментарий</h3>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="form-control"
                  placeholder="Введите комментарий..."
                />
                <Button
                  variant="secondary"
                  onClick={addComment}
                  disabled={actionLoading}
                  className="mt-2 w-full"
                >
                  Добавить комментарий
                </Button>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => handleApprove(selectedApplication)}
                  disabled={selectedApplication.status === "approved" || actionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Утвердить
                </Button>
                <Button
                  onClick={() => handleRevision(selectedApplication)}
                  disabled={selectedApplication.status === "approved" || actionLoading}
                  className="w-full gap-2 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  Отправить на доработку
                </Button>
                <Button
                  onClick={() => handleReject(selectedApplication)}
                  disabled={selectedApplication.status === "approved" || actionLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Отклонить
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
