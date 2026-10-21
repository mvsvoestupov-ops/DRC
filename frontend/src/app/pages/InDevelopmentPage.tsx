import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Users } from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence, CompetenceCollaborator } from "@/api/types";
import { PageHeader } from "@/app/components/PageHeader";
import { useI18n } from "@/context/I18nContext";
import { formatUserName } from "@/lib/userDisplay";
import { DevelopmentProgressBar } from "@/app/components/ProjectActivityPanel";
import { formatCompetenceId } from "@/lib/competenceMappers";

function collaboratorLabel(row: CompetenceCollaborator, t: (k: string) => string) {
  const name = formatUserName(row.user) || row.user?.email || "—";
  if (row.role === "leader") return `${name} (${t("inDev.leader")})`;
  if (row.status === "pending") return `${name} (${t("inDev.pending")})`;
  return name;
}

export function InDevelopmentPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [projects, setProjects] = useState<Competence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient
      .getCompetencesInDevelopment()
      .then((rows) => setProjects(Array.isArray(rows) ? rows : []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("inDev.loadError"));
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("inDev.title")} description={t("inDev.lead")} />

      {error ? (
        <div className="p-3 rounded-md text-base bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t("inDev.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const canEdit = Boolean(project.can_edit);
            const group = (project.collaborators || []).filter(
              (row) => row.status !== "declined",
            );
            const code = formatCompetenceId(project.id, project.public_code);
            return (
              <Card key={project.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">{code}</span>
                        <Badge variant="secondary">{t("status.draft")}</Badge>
                        {project.collaboration_role === "leader" ? (
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            {t("inDev.youLeader")}
                          </Badge>
                        ) : project.collaboration_role === "member" ? (
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            {t("inDev.youMember")}
                          </Badge>
                        ) : null}
                      </div>
                      <h4 className="font-medium text-gray-900">
                        {project.name || t("common.untitled")}
                      </h4>
                      {project.progress ? (
                        <div className="max-w-md pt-1">
                          <DevelopmentProgressBar
                            progress={project.progress}
                            dueDate={project.development_due}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/competency/${project.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {t("inDev.view")}
                      </Button>
                      {canEdit ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/competency/${project.id}/edit`)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          {t("inDev.edit")}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                      {t("inDev.workingGroup")}
                    </p>
                    {group.length === 0 ? (
                      <p className="text-sm text-gray-500">{t("inDev.noGroup")}</p>
                    ) : (
                      <ul className="space-y-1">
                        {group.map((row) => (
                          <li
                            key={`${row.role}-${row.user_id || row.user?.email}-${row.status}`}
                            className="text-sm text-gray-800 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                          >
                            <span>{collaboratorLabel(row, t)}</span>
                            {row.user?.email && formatUserName(row.user) ? (
                              <span className="text-xs text-gray-500 truncate">
                                {row.user.email}
                              </span>
                            ) : null}
                            {row.user?.organization ? (
                              <span className="text-xs text-gray-500 truncate w-full sm:w-auto">
                                {row.user.organization}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
