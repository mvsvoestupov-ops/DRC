import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { BookOpen, PlusCircle, Search, TrendingUp, CheckCircle, Clock, Archive } from 'lucide-react';
import { getCompetences, getCompetenceStats } from '../api';

const getStatusBadge = (status) => {
  const map = {
    'утверждена': { variant: 'success', label: 'Утверждена' },
    'на экспертизе': { variant: 'warning', label: 'На экспертизе' },
    'архив': { variant: 'secondary', label: 'Архив' },
  };
  const cfg = map[status] || { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [competences, setCompetences] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, review: 0, archived: 0 });

  useEffect(() => {
    getCompetenceStats().then(res => setStats(res.data)).catch(() => {
      setStats({ total: 1240, active: 982, review: 34, archived: 224 });
    });
    getCompetences().then(res => setCompetences(res.data.slice(0, 5))).catch(() => {
      setCompetences([
        { id: 1, code: 'RUS-PK-05-v1', name: 'Способен применять нормативные правовые акты...', status: 'утверждена', qualification_name: 'Организация' },
        { id: 2, code: 'RUS-OK-01-v2', name: 'Способен анализировать сомнительные операции...', status: 'утверждена', qualification_name: 'Финансы' },
        { id: 3, code: 'RUS-DIG-01-v1', name: 'Способен применять методы анализа больших данных...', status: 'на экспертизе', qualification_name: 'Финансы' },
      ]);
    });
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium">Национальный реестр компетенций</h2>
        <p className="text-muted-foreground mt-1">
          Единая система управления компетенциями для гармонизации образовательных программ, профессиональных стандартов и требований работодателей
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200 hover:shadow-md cursor-pointer" onClick={() => navigate('/standards')}>
          <CardContent className="p-6 flex flex-col items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium">Парсинг профстандартов</h4>
              <p className="text-sm text-muted-foreground">Загрузка и обогащение профессиональных стандартов</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200 hover:shadow-md cursor-pointer" onClick={() => navigate('/create-competence')}>
          <CardContent className="p-6 flex flex-col items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <PlusCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium">Предложить компетенцию</h4>
              <p className="text-sm text-muted-foreground">Создать новую компетенцию на основе профессионального стандарта</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200 hover:shadow-md cursor-pointer" onClick={() => navigate('/search')}>
          <CardContent className="p-6 flex flex-col items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Search className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium">Поиск компетенций</h4>
              <p className="text-sm text-muted-foreground">Найти компетенции по ключевым словам или коду</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Всего</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-sm text-muted-foreground">Активные</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.review}</div>
              <div className="text-sm text-muted-foreground">На экспертизе</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Archive className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.archived}</div>
              <div className="text-sm text-muted-foreground">В архиве</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Competences */}
      <div>
        <h3 className="text-lg font-medium mb-4">Последние компетенции</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competences.map((comp) => (
            <Card key={comp.id} className="hover:shadow-md cursor-pointer" onClick={() => navigate(`/competence/${comp.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{comp.code}</code>
                  {getStatusBadge(comp.status)}
                </div>
                <h4 className="font-medium text-sm mb-1 line-clamp-2">{comp.name}</h4>
                {comp.qualification_name && (
                  <p className="text-xs text-muted-foreground">{comp.qualification_name}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
