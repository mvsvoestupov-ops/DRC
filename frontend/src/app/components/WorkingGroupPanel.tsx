import { useState } from "react";
import { useNavigate } from "react-router";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/client";
import type { Competence, CompetenceCollaborator } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { formatUserName } from "@/lib/userDisplay";

function apiErrorMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (!message || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return fallback;
  }
  return message;
}

export function WorkingGroupPanel({
  competence,
  onUpdated,
  ensureCompetence,
}: {
  competence: Competence;
  onUpdated: (next: Competence) => void;
  ensureCompetence?: () => Promise<Competence>;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const STATUS_LABEL: Record<string, string> = {
    pending: t("wg.pending"),
    accepted: t("wg.accepted"),
    declined: t("wg.declined"),
  };

  const canInvite = Boolean(competence.can_invite);
  const members = (competence.collaborators || []).filter((row) => row.role === "member");
  const leader = (competence.collaborators || []).find((row) => row.role === "leader");
  const myId = user?.id;
  const iAmMember = competence.collaboration_role === "member";

  const displayName = (row?: CompetenceCollaborator | null) =>
    formatUserName(row?.user) || row?.user?.email || user?.email || "—";

  const invite = async () => {
    const value = email.trim();
    if (!value) {
      setError(t("wg.emailRequired"));
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      let target = competence;
      if (!target.id && ensureCompetence) {
        target = await ensureCompetence();
      }
      if (!target.id) {
        throw new Error(t("wg.saveDraftFirst"));
      }
      const updated = await apiClient.inviteCollaborator(target.id, value);
      onUpdated(updated);
      setEmail("");
      setNotice(t("wg.invited"));
    } catch (err) {
      setError(apiErrorMessage(err, t("wg.inviteError")));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (userId?: number) => {
    if (!userId) return;
    const leaving = userId === myId;
    const confirmed = window.confirm(
      leaving ? t("wg.leaveConfirm") : t("wg.removeConfirm"),
    );
    if (!confirmed) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiClient.removeCollaborator(competence.id, userId);
      if (userId === myId) {
        navigate("/my-projects");
        return;
      }
      if (updated?.id) onUpdated(updated);
      setNotice(t("wg.removed"));
    } catch (err) {
      setError(apiErrorMessage(err, t("wg.changeError")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-primary/30 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">{t("wg.title")}</CardTitle>
        <p className="text-base text-gray-600">
          {iAmMember ? t("wg.memberHelp") : t("wg.leaderHelp")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md">{notice}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        ) : null}

        <div className="space-y-2">
          {leader ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div>
                <p className="text-base font-medium text-gray-900">
                  {displayName(leader) || user?.email || t("common.you")}
                </p>
                <p className="text-sm text-gray-500">{leader.user?.email || user?.email}</p>
              </div>
              <Badge>{t("wg.leader")}</Badge>
            </div>
          ) : null}
          {members.map((row) => (
            <div
              key={`${row.user_id}-${row.status}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <div>
                <p className="text-base font-medium text-gray-900">{displayName(row)}</p>
                <p className="text-sm text-gray-500">{row.user?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{STATUS_LABEL[row.status] || row.status}</Badge>
                {(canInvite || (iAmMember && row.user_id === myId)) && row.user_id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={loading}
                    onClick={() => remove(row.user_id)}
                  >
                    <X className="w-4 h-4" />
                    {row.user_id === myId ? t("wg.leave") : t("wg.remove")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {members.length === 0 ? (
            <p className="text-base text-gray-500">{t("wg.onlyLeader")}</p>
          ) : null}
        </div>

        {canInvite ? (
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void invite();
            }}
          >
            <Input
              type="email"
              placeholder={t("wg.emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading} className="gap-2 shrink-0">
              <UserPlus className="w-4 h-4" />
              {t("wg.invite")}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
