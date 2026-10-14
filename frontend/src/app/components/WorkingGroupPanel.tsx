import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { apiClient } from "@/api/client";
import type { Competence, CompetenceCollaborator, UserDirectoryItem } from "@/api/types";
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

type WorkingGroupPanelProps = {
  competence: Competence;
  onUpdated: (next: Competence) => void;
  ensureCompetence?: () => Promise<Competence>;
  embedded?: boolean;
};

export function WorkingGroupDialog({
  competence,
  onUpdated,
  ensureCompetence,
}: Omit<WorkingGroupPanelProps, "embedded">) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const iAmMember = competence.collaboration_role === "member";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 gap-2 text-base font-medium"
        onClick={() => setOpen(true)}
      >
        <Users className="w-4 h-4" />
        {t("wg.openButton")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wg.title")}</DialogTitle>
            <DialogDescription>
              {iAmMember ? t("wg.memberHelp") : t("wg.leaderHelp")}
            </DialogDescription>
          </DialogHeader>
          <WorkingGroupPanel
            embedded
            competence={competence}
            onUpdated={onUpdated}
            ensureCompetence={ensureCompetence}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WorkingGroupPanel({
  competence,
  onUpdated,
  ensureCompetence,
  embedded = false,
}: WorkingGroupPanelProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<UserDirectoryItem[]>([]);
  const [selected, setSelected] = useState<UserDirectoryItem | null>(null);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [searchError, setSearchError] = useState("");
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

  const takenIds = useMemo(() => {
    const ids = new Set<number>();
    if (competence.user_id) ids.add(competence.user_id);
    if (myId) ids.add(myId);
    for (const row of competence.collaborators || []) {
      if (row.user_id && row.status !== "declined") ids.add(row.user_id);
    }
    return ids;
  }, [competence.collaborators, competence.user_id, myId]);

  const visibleResults = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return directory;
    return directory.filter((item) => {
      const haystack = [formatUserName(item), item.email, item.organization].join(" ").toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [directory, query]);

  useEffect(() => {
    if (!canInvite) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoadingDirectory(true);
    setSearchError("");
    apiClient
      .searchUsers({ q: "", limit: 500 }, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setDirectory(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (!aborted) {
          setDirectory([]);
          setSearchError(apiErrorMessage(err, t("wg.inviteError")));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDirectory(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [canInvite, t]);

  const displayName = (row?: CompetenceCollaborator | null) =>
    formatUserName(row?.user) || row?.user?.email || user?.email || "—";

  const invite = async () => {
    if (!selected?.id) {
      setError(t("wg.userRequired"));
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
      const updated = await apiClient.inviteCollaborator(target.id, { user_id: selected.id });
      onUpdated(updated);
      setQuery("");
      setSelected(null);
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

  const body = (
      <div className="space-y-4">
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
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void invite();
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder={t("wg.fioPlaceholder")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(null);
                  setNotice("");
                  setError("");
                }}
                disabled={loading}
                autoComplete="off"
                className="pl-10 pr-10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelected(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Очистить поиск"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">{t("wg.searchHint")}</p>
            {searchError ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {searchError}
              </p>
            ) : null}
            <div className="rounded-xl border border-gray-200 h-56 overflow-y-auto overscroll-contain">
              {loadingDirectory ? (
                <div className="flex h-full items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t("wg.searching")}</span>
                </div>
              ) : visibleResults.length === 0 ? (
                <p className="text-sm text-gray-500 px-4 py-6 text-center">
                  {directory.length === 0 ? t("wg.emptyDirectory") : t("wg.noResults")}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {visibleResults.map((item) => {
                    const name = formatUserName(item);
                    const alreadyInGroup = takenIds.has(item.id);
                    const isSelected = selected?.id === item.id && !alreadyInGroup;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={alreadyInGroup}
                          onClick={() => {
                            setSelected(item);
                            setError("");
                          }}
                          className={`w-full text-left px-4 py-2.5 transition-colors ${
                            alreadyInGroup
                              ? "opacity-60 cursor-not-allowed"
                              : isSelected
                                ? "bg-primary/5"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{name || item.email}</p>
                              {name && item.email ? (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.email}</p>
                              ) : null}
                              {item.organization ? (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.organization}</p>
                              ) : null}
                            </div>
                            {alreadyInGroup ? (
                              <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                                {t("wg.alreadyMember")}
                              </span>
                            ) : isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{formatUserName(selected)}</p>
                  {selected.organization ? (
                    <p className="text-xs text-gray-500 truncate">{selected.organization}</p>
                  ) : null}
                </div>
                <Button type="submit" disabled={loading} className="gap-2 shrink-0">
                  <UserPlus className="w-4 h-4" />
                  {t("wg.invite")}
                </Button>
              </div>
            ) : (
              <Button type="submit" disabled={loading || !selected} className="gap-2">
                <UserPlus className="w-4 h-4" />
                {t("wg.invite")}
              </Button>
            )}
          </form>
        ) : null}
      </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <Card className="mb-6 border-primary/30 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">{t("wg.title")}</CardTitle>
        <p className="text-base text-gray-600">
          {iAmMember ? t("wg.memberHelp") : t("wg.leaderHelp")}
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
