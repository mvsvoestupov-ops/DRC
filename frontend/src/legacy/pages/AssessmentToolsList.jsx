import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Database, Link2, Unlink, ClipboardList, Ban } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getAssessmentTools,
  getAssessmentToolsStats,
  fetchAssessmentToolsFromNark,
  getFetchAssessmentToolsStatus,
} from '@/api/compat';

function FilterStatCard({ active, icon: Icon, color, bg, value, label, onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left surface p-5 shadow-sm transition-all cursor-pointer group w-full border ${
        active
          ? 'border-primary ring-2 ring-primary/20 shadow-md'
          : 'border-transparent hover:shadow-md hover:border-primary/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div
        className={`text-3xl font-bold mb-1 transition-colors ${
          active ? 'text-primary' : 'text-gray-900 group-hover:text-primary'
        }`}
      >
        {loading ? '—' : Number(value || 0).toLocaleString('ru-RU')}
      </div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
    </button>
  );
}

const FILTERS = { all: 'all', linked: 'linked', unlinked: 'unlinked', inactive: 'inactive' };

const AssessmentToolsList = () => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');
  const [stats, setStats] = useState({
    local_count: 0,
    expected: 0,
    linked: 0,
    unlinked: 0,
    missing: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [cardFilter, setCardFilter] = useState(FILTERS.all);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([getAssessmentTools(), getAssessmentToolsStats()]);
      setItems(listRes.data || []);
      setStats(statsRes.data || {});
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let result = items;
    if (cardFilter === FILTERS.linked) {
      result = result.filter((item) => item.qualification_id != null);
    } else if (cardFilter === FILTERS.unlinked) {
      result = result.filter((item) => item.qualification_id == null);
    } else if (cardFilter === FILTERS.inactive) {
      result = result.filter((item) => (item.status || 'active') === 'inactive');
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.name?.toLowerCase().includes(lower) ||
          item.code?.toLowerCase().includes(lower) ||
          item.qualification_code?.toLowerCase().includes(lower) ||
          item.spk_name?.toLowerCase().includes(lower) ||
          item.prof_standard_name?.toLowerCase().includes(lower),
      );
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [searchText, cardFilter, items]);

  const pollFetchStatus = async () => {
    try {
      const res = await getFetchAssessmentToolsStatus();
      const data = res.data;
      setFetchMessage(data.message || data.status);
      if (data.status === 'running') {
        setTimeout(pollFetchStatus, 5000);
        return;
      }
      setFetchLoading(false);
      if (data.status === 'done') {
        await loadData();
      }
    } catch {
      setFetchLoading(false);
    }
  };

  const handleFetchFromNark = async (onlyMissing = true) => {
    setFetchLoading(true);
    setFetchMessage(onlyMissing ? 'Запуск догрузки недостающих ОС...' : 'Запуск полной загрузки ОС...');
    try {
      await fetchAssessmentToolsFromNark(onlyMissing);
      setFetchMessage('Загрузка выполняется на сервере (~15–30 мин)...');
      setTimeout(pollFetchStatus, 3000);
    } catch (err) {
      setFetchLoading(false);
      setFetchMessage(err?.response?.data?.detail || err?.message || 'Ошибка запуска загрузки');
    }
  };

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const totalCount = items.length || stats.local_count || 0;
  const linkedCount = items.filter((item) => item.qualification_id != null).length;
  const unlinkedCount = Math.max(0, totalCount - linkedCount);
  const inactiveCount =
    stats.inactive ?? items.filter((item) => (item.status || 'active') === 'inactive').length;
  const expected = stats.expected || 2227;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Оценочные средства НАРК</h2>
        <p className="page-subtitle">
          НАРК: ~{Number(expected).toLocaleString('ru-RU')} карточек. В системе:{' '}
          {Number(totalCount).toLocaleString('ru-RU')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FilterStatCard
          active={cardFilter === FILTERS.all}
          icon={Database}
          color="#6366F1"
          bg="#EEF2FF"
          value={totalCount}
          label="Всего оценочных средств"
          loading={loading}
          onClick={() => setCardFilter(FILTERS.all)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.linked}
          icon={Link2}
          color="#10B981"
          bg="#ECFDF5"
          value={linkedCount}
          label="Связаны с квалификацией"
          loading={loading}
          onClick={() => setCardFilter(FILTERS.linked)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.unlinked}
          icon={Unlink}
          color="#F59E0B"
          bg="#FEF3C7"
          value={unlinkedCount}
          label="Без квалификации"
          loading={loading}
          onClick={() => setCardFilter(FILTERS.unlinked)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.inactive}
          icon={Ban}
          color="#EF4444"
          bg="#FEE2E2"
          value={inactiveCount}
          label="Не активные"
          loading={loading}
          onClick={() => setCardFilter(FILTERS.inactive)}
        />
      </div>

      {isAdmin ? (
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="secondary" disabled={fetchLoading} onClick={() => handleFetchFromNark(true)}>
          <RefreshCw className={`w-4 h-4 mr-2 ${fetchLoading ? 'animate-spin' : ''}`} />
          Догрузить с НАРК (~{Math.max(0, expected - Number(totalCount || 0))})
        </Button>
        <Button
          variant="outline"
          disabled={fetchLoading}
          onClick={() => {
            if (window.confirm('Полная перезагрузка оценочных средств займёт 15–30 минут. Продолжить?')) {
              handleFetchFromNark(false);
            }
          }}
        >
          Обновить все с НАРК
        </Button>
        {fetchMessage && <span className="text-sm text-muted-foreground">{fetchMessage}</span>}
      </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по коду, названию, СПК, ПС…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center text-sm text-muted-foreground">Найдено: {filtered.length}</div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Оценочные средства не найдены</p>
            <p className="text-sm text-muted-foreground mt-2">Загрузите реестр с nok-nark.ru</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map((item) => (
              <Card
                key={item.id}
                className={`hover:shadow-md cursor-pointer transition-shadow${
                  (item.status || 'active') === 'inactive' ? ' opacity-60' : ''
                }`}
                onClick={() => navigate(`/assessment-tools/${item.id}`)}
              >
                <CardContent className="p-4 flex flex-col gap-2 min-h-[140px]">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">{item.code}</code>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {(item.status || 'active') === 'inactive' && (
                        <Badge variant="outline" className="text-slate-600 border-slate-300">
                          неактивно
                        </Badge>
                      )}
                      {item.qualification_id != null ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                          квалификация
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-200">
                          без связи
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium line-clamp-3">{item.name}</p>
                  {item.spk_name && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-auto">{item.spk_name}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 items-center text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Назад
              </Button>
              <span className="text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssessmentToolsList;
