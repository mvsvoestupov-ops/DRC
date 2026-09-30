import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Pencil, Users } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { Competence, CompetenceInvite } from '@/api/types';
import { PageHeader } from '@/app/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { translateKeyed, API_STATUS_KEYS } from '@/i18n/helpers';
import { formatUserName } from '@/lib/userDisplay';

export function MyProjectsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const createHref = isAdmin ? '/strategic-session' : '/new';
  const [projects, setProjects] = useState<Competence[]>([]);
  const [invites, setInvites] = useState<CompetenceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'утверждена': 'default',
      approved: 'default',
      'на экспертизе': 'secondary',
      review: 'secondary',
      'архив': 'outline',
      archived: 'outline',
      'проект': 'secondary',
      draft: 'secondary',
    };
    const label = translateKeyed(t, API_STATUS_KEYS, status, status);
    return <Badge variant={variants[status] || 'secondary'}>{label}</Badge>;
  };

  const loadProjects = () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    Promise.all([
      apiClient.getCompetences(true),
      apiClient.listCompetenceInvites().catch(() => []),
    ])
      .then(([res, pending]) => {
        setProjects(res);
        setInvites(pending);
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: t('projects.loadError') });
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('projects.deleteConfirm'))) return;
    try {
      await apiClient.deleteCompetence(id);
      setMessage({ type: 'success', text: t('projects.deleted') });
      loadProjects();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('projects.deleteError') });
    }
  };

  const handleInvite = async (invite: CompetenceInvite, accept: boolean) => {
    try {
      if (accept) {
        const updated = await apiClient.acceptCompetenceInvite(invite.id);
        setMessage({ type: 'success', text: t('projects.joined') });
        if (updated?.id) navigate(`/competency/${updated.id}`);
        else loadProjects();
      } else {
        await apiClient.declineCompetenceInvite(invite.id);
        setMessage({ type: 'success', text: t('projects.declined') });
        loadProjects();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('projects.inviteError') });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('projects.title')}
        description={t('projects.lead')}
        actions={
          <Button onClick={() => navigate(createHref)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('projects.create')}
          </Button>
        }
      />

      {message.text && (
        <div className={`p-3 rounded-md text-base ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {invites.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-base font-semibold text-gray-900">{t('projects.invites')}</h3>
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div>
                  <p className="text-base font-medium text-gray-900">{invite.competence_name}</p>
                  <p className="text-sm text-gray-600">
                    {t('projects.from', {
                      name: formatUserName(invite.invited_by) || invite.invited_by?.email || t('projects.fromFallback'),
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleInvite(invite, true)}>{t('projects.accept')}</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleInvite(invite, false)}>{t('projects.reject')}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Plus className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t('projects.empty')}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(createHref)}>
              {t('projects.createEmpty')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium">{project.name || t('common.untitled')}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {getStatusBadge(project.status)}
                    {project.collaboration_role === 'leader' ? (
                      <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {t('projects.leader')}</Badge>
                    ) : project.collaboration_role === 'member' ? (
                      <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {t('projects.member')}</Badge>
                    ) : null}
                    {project.qualification_name && (
                      <span className="text-sm text-muted-foreground">
                        {t('projects.qualification', { name: project.qualification_name })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/competency/${project.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {t('common.open')}
                  </Button>
                  {project.can_edit && project.status === 'проект' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/competency/${project.id}/edit`)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('projects.develop')}
                    </Button>
                  ) : null}
                  {project.collaboration_role !== 'member' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {t('common.delete')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
