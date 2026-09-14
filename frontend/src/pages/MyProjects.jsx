import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Plus, Trash2, Eye } from 'lucide-react';
import { getCompetences, deleteCompetence } from '../api';

const MyProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const loadProjects = () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    getCompetences()
      .then(res => {
        setProjects(res.data);
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Ошибка загрузки проектов' });
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) return;
    try {
      await deleteCompetence(id);
      setMessage({ type: 'success', text: 'Проект удалён' });
      loadProjects();
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка удаления проекта' });
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'утверждена': { variant: 'success', label: 'Утверждена' },
      'на экспертизе': { variant: 'warning', label: 'На экспертизе' },
      'архив': { variant: 'secondary', label: 'Архив' },
    };
    const cfg = map[status] || { variant: 'secondary', label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium">Мои проекты</h2>
          <p className="text-muted-foreground text-sm mt-1">Управление компетенциями и проектами</p>
        </div>
        <Button onClick={() => navigate('/strategic-session')}>
          <Plus className="w-4 h-4 mr-2" />
          Создать новый проект
        </Button>
      </div>

      {/* Сообщения */}
      {message.text && (
        <div className={`p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Список проектов */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Plus className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Нет проектов</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/strategic-session')}>
              Создать проект
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium">{project.name || 'Без названия'}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {getStatusBadge(project.status)}
                    {project.qualification_name && (
                      <span className="text-xs text-muted-foreground">
                        Квалификация: {project.qualification_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/competence/${project.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Открыть
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyProjects;
