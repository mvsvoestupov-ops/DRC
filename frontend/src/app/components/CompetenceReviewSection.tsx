import { useEffect, useRef, useState } from "react";
import { CheckCircle, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpertiseChecklistForm } from "@/app/components/ExpertiseChecklist";
import { apiClient } from "@/api/client";
import type { Competence, User } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { getExpertiseDecision, type ExpertiseChecklist } from "@/lib/expertiseCriteria";
import { formatUserName } from "@/lib/userDisplay";

const MIN_REVIEWERS = 3;

function apiErrorMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (!message || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return fallback;
  }
  return message;
}

interface CompetenceReviewSectionProps {
  competence: Competence;
  onUpdated: (next: Competence) => void;
}

export function CompetenceReviewSection({ competence, onUpdated }: CompetenceReviewSectionProps) {
  const { isExpert, isModerator } = useAuth();
  const [expertise, setExpertise] = useState<ExpertiseChecklist>(competence.expertise || {});
  const [commentText, setCommentText] = useState("");
  const [experts, setExperts] = useState<User[]>([]);
  const [selectedExpertIds, setSelectedExpertIds] = useState<number[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const persistTimer = useRef<number | null>(null);

  const pending = competence.status === "на экспертизе";
  const canReview = isExpert && pending;
  const canAssign = isModerator && pending;

  useEffect(() => {
    setExpertise(competence.expertise || {});
    setSelectedExpertIds((competence.reviewers || []).map((row) => Number(row.id)).filter(Boolean));
  }, [competence]);

  useEffect(() => {
    if (!canAssign) return;
    apiClient.listExperts()
      .then(setExperts)
      .catch(() => setError("Не удалось загрузить список экспертов"));
  }, [canAssign]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  if (!pending || (!isExpert && !isModerator)) return null;

  const persistExpertise = (next: ExpertiseChecklist) => {
    setExpertise(next);
    setError("");
    if (!canReview) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      apiClient.updateCompetence(competence.id, { expertise: next }).catch((err) => {
        setError(apiErrorMessage(err, "Не удалось сохранить экспертизу. Проверьте, что сервер API запущен."));
      });
    }, 400);
  };

  const updateStatus = async (status: string, notes?: string) => {
    setActionLoading(true);
    setError("");
    try {
      const updated = await apiClient.updateCompetence(competence.id, {
        status,
        expertise,
        ...(notes ? { validation_notes: notes } : {}),
      });
      onUpdated(updated as Competence);
      setCommentText("");
      setNotice(status === "утверждена" ? "Компетенция утверждена" : "Заявка возвращена на доработку");
    } catch (err) {
      setError(apiErrorMessage(err, "Не удалось обновить статус. Проверьте, что сервер API запущен."));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpert = (id: number) => {
    setSelectedExpertIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const handleAssign = async () => {
    if (selectedExpertIds.length < MIN_REVIEWERS) {
      setError(`Назначьте не менее ${MIN_REVIEWERS} экспертов`);
      return;
    }
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiClient.assignReviewers(competence.id, selectedExpertIds);
      onUpdated(updated as Competence);
      setNotice("Эксперты назначены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось назначить экспертов");
    } finally {
      setActionLoading(false);
    }
  };

  const decision = getExpertiseDecision(expertise);
  const canApproveAction = canReview && decision.canApprove && !actionLoading;
  const canReturnAction = canReview && decision.canReturn && !actionLoading;
  let reviewWarning = "";
  if (canReview && decision.missingComments.length > 0) {
    reviewWarning = "Для каждого критерия с ответом «Нет» заполните поле комментария.";
  } else if (canReview && !decision.canApprove && !decision.canReturn) {
    reviewWarning = "Чтобы утвердить, поставьте «Да» по всем критериям, кроме НОК. Чтобы отправить на доработку или отклонить, поставьте «Нет» хотя бы по одному критерию.";
  }

  return (
    <div className="space-y-6 mt-6">
      {notice ? (
        <p className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{notice}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      ) : null}

      {isExpert && pending ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Экспертиза</CardTitle>
            <p className="text-sm text-gray-600">
              Для каждого критерия укажите «Да» или «Нет». Если выбран ответ «Нет», комментарий обязателен.
              Критерий про пригодность оценочных средств для НОК на решение не влияет.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ExpertiseChecklistForm
              value={expertise}
              onChange={persistExpertise}
              disabled={!canReview || actionLoading}
            />

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">История комментариев</h3>
              {competence.validation_notes ? (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-900 mb-1">
                    {competence.validator || "Эксперт"}
                  </p>
                  <p className="text-sm text-gray-700">{competence.validation_notes}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Комментариев пока нет</p>
              )}
            </div>

            {canReview ? (
              <>
                {reviewWarning ? (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                    {reviewWarning}
                  </p>
                ) : null}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => {
                      if (!decision.canApprove) return;
                      updateStatus("утверждена");
                    }}
                    disabled={!canApproveAction}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Утвердить
                  </Button>
                  <Button
                    onClick={() => {
                      if (!decision.canReturn) return;
                      updateStatus("проект", commentText || "Требуется доработка");
                    }}
                    disabled={!canReturnAction}
                    className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Отправить на доработку
                  </Button>
                  <Button
                    onClick={() => {
                      if (!decision.canReturn) return;
                      updateStatus("проект", commentText || "Заявка отклонена экспертом");
                    }}
                    disabled={!canReturnAction}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Отклонить
                  </Button>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Добавить комментарий</h3>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    className="form-control"
                    placeholder="Введите комментарий..."
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canAssign ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Назначить экспертов</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">Выберите не менее {MIN_REVIEWERS} экспертов.</p>
            <div className="max-h-56 overflow-y-auto space-y-2 border border-gray-200 rounded-md p-2">
              {experts.length === 0 ? (
                <p className="text-sm text-gray-500">Нет активных экспертов. Добавьте роль «Эксперт» в списке пользователей.</p>
              ) : experts.map((expert) => {
                const id = Number(expert.id);
                return (
                  <label key={id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedExpertIds.includes(id)}
                      onChange={() => toggleExpert(id)}
                    />
                    <span>
                      <span className="font-medium">{formatUserName(expert) || expert.email}</span>
                      <span className="block text-xs text-gray-500">{expert.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">Выбрано: {selectedExpertIds.length}</p>
            <Button
              className="mt-3"
              onClick={handleAssign}
              disabled={actionLoading || selectedExpertIds.length < MIN_REVIEWERS}
            >
              Сохранить назначение
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
