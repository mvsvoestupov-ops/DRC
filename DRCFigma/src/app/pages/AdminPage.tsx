import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle, XCircle, AlertCircle, MessageSquare, Calendar } from "lucide-react";

interface Application {
  id: string;
  competencyId: string;
  title: string;
  submittedBy: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected" | "revision";
  expert: string;
  comments: {
    author: string;
    date: string;
    text: string;
  }[];
}

export function AdminPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [commentText, setCommentText] = useState("");

  const applications: Application[] = [
    {
      id: "APP-001",
      competencyId: "RUS-DIG-01-v1",
      title: "Способен применять методы анализа больших данных (Big Data) для решения профессиональных задач в области финансового мониторинга",
      submittedBy: "Финансовый университет",
      submittedDate: "2026-04-20",
      status: "pending",
      expert: "Иванов И.И.",
      comments: []
    },
    {
      id: "APP-002",
      competencyId: "RUS-AI-05-v1",
      title: "Способен разрабатывать и внедрять системы искусственного интеллекта в производственные процессы",
      submittedBy: "МФТИ",
      submittedDate: "2026-04-15",
      status: "revision",
      expert: "Петрова А.С.",
      comments: [
        {
          author: "Петрова А.С.",
          date: "2026-04-18",
          text: "Необходимо уточнить связь с профстандартом и добавить примеры оценочных материалов"
        }
      ]
    },
    {
      id: "APP-003",
      competencyId: "RUS-ECO-12-v1",
      title: "Способен анализировать экологические риски промышленных объектов",
      submittedBy: "МГУ им. Ломоносова",
      submittedDate: "2026-04-10",
      status: "approved",
      expert: "Сидоров В.П.",
      comments: [
        {
          author: "Сидоров В.П.",
          date: "2026-04-12",
          text: "Заявка соответствует всем требованиям. Одобрено."
        }
      ]
    }
  ];

  const filteredApplications = filter === "all"
    ? applications
    : applications.filter(app => app.status === filter);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    revision: "bg-blue-100 text-blue-800"
  };

  const statusLabels = {
    pending: "На рассмотрении",
    approved: "Одобрено",
    rejected: "Отклонено",
    revision: "На доработке"
  };

  const handleApprove = (app: Application) => {
    alert(`Компетенция "${app.title}" одобрена`);
  };

  const handleReject = (app: Application) => {
    alert(`Компетенция "${app.title}" отклонена`);
  };

  const handleRevision = (app: Application) => {
    alert(`Компетенция "${app.title}" отправлена на доработку`);
  };

  const addComment = () => {
    if (commentText.trim() && selectedApplication) {
      alert(`Комментарий добавлен: ${commentText}`);
      setCommentText("");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Панель модератора</h1>
        <p className="text-gray-600">Управление заявками на новые компетенции</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего заявок</p>
              <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">На рассмотрении</p>
              <p className="text-2xl font-bold text-yellow-600">
                {applications.filter(a => a.status === "pending").length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Одобрено</p>
              <p className="text-2xl font-bold text-green-600">
                {applications.filter(a => a.status === "approved").length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">На доработке</p>
              <p className="text-2xl font-bold text-blue-600">
                {applications.filter(a => a.status === "revision").length}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Фильтр:</span>
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded text-sm ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`px-3 py-1 rounded text-sm ${
                  filter === "pending"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                На рассмотрении
              </button>
              <button
                onClick={() => setFilter("revision")}
                className={`px-3 py-1 rounded text-sm ${
                  filter === "revision"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                На доработке
              </button>
              <button
                onClick={() => setFilter("approved")}
                className={`px-3 py-1 rounded text-sm ${
                  filter === "approved"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Одобрено
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID заявки
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Название компетенции
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата подачи
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Эксперт
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplications.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApplication(app)}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedApplication?.id === app.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-blue-600">{app.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 line-clamp-2">{app.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{app.submittedBy}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(app.submittedDate).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.expert}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedApplication && (
          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Детали заявки {selectedApplication.id}
              </h2>

              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Компетенция</h3>
                  <p className="text-sm text-gray-900">{selectedApplication.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Подана</h3>
                  <p className="text-sm text-gray-900">
                    {selectedApplication.submittedBy}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(selectedApplication.submittedDate).toLocaleDateString('ru-RU')}
                  </p>
                </div>

                <div>
                  <Link
                    to={`/competency/${selectedApplication.competencyId}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Просмотреть полную карточку компетенции →
                  </Link>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  История комментариев
                </h3>
                {selectedApplication.comments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedApplication.comments.map((comment, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-900">
                            {comment.author}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.date).toLocaleDateString('ru-RU')}
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
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Добавить комментарий
                </h3>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите комментарий..."
                />
                <button
                  onClick={addComment}
                  className="mt-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Добавить комментарий
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleApprove(selectedApplication)}
                  disabled={selectedApplication.status === "approved"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Утвердить
                </button>

                <button
                  onClick={() => handleRevision(selectedApplication)}
                  disabled={selectedApplication.status === "approved"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  Отправить на доработку
                </button>

                <button
                  onClick={() => handleReject(selectedApplication)}
                  disabled={selectedApplication.status === "approved"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
