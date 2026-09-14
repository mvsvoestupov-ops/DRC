import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  RefreshCw,
  Database,
  Link2,
  Unlink,
  Ban,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import {
  getQualifications,
  getQualificationsStats,
  fetchQualificationsFromNark,
  getFetchQualificationsStatus,
} from '@/api/compat';

const qualificationLevelSortKey = (level) => {
  const match = String(level).match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseFloat(match[1]);
};

const compareQualificationLevels = (a, b) => {
  const diff = qualificationLevelSortKey(a) - qualificationLevelSortKey(b);
  if (diff !== 0) return diff;
  return String(a).localeCompare(String(b), 'ru');
};

/**
 * Маркер «без ПС» (единый для бейджа, карточки и фильтра):
 * код после первой точки содержит 00000 (напр. 27.00000.01),
 * либо в названии ПС — «Нет связанного профессионального стандарта».
 */
const isWithoutPs = (q) => {
  const code = String(q?.code || '');
  if (code.includes('.')) {
    const afterDot = code.split('.', 2)[1] || '';
    if (afterDot.includes('00000')) return true;
  }
  const psName = String(q?.prof_standard_name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (!psName) return false;
  return psName.startsWith('нет связанного профессионального стандарта');
};

const expectedPsCode = (code) => {
  const m = String(code || '').match(/^(\d{2}\.\d{3})/);
  return m ? m[1] : '';
};

/** Утратившие силу: ожидаемый код ПС отсутствует в Excel (кроме маркера «без ПС»). */
const isRevokedQualification = (q, xlsxCodeSet) => {
  if (isWithoutPs(q)) return false;
  if (!xlsxCodeSet || xlsxCodeSet.size === 0) return false;
  const expected = expectedPsCode(q.code);
  return Boolean(expected && !xlsxCodeSet.has(expected));
};

const FILTERS = {
  all: 'all',
  active: 'active',
  linked: 'linked',
  without_ps: 'without_ps',
  revoked: 'revoked',
};

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
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bg }}
        >
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

const QualificationsList = () => {
  const [allQualifications, setAllQualifications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');
  const [stats, setStats] = useState({
    local_count: 0,
    total: 0,
    linked_to_ps: 0,
    without_ps: 0,
    revoked: 0,
    xlsx_ps_codes: [],
  });
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState(FILTERS.all);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const navigate = useNavigate();

  const xlsxCodeSet = useMemo(
    () => new Set(stats.xlsx_ps_codes || []),
    [stats.xlsx_ps_codes],
  );

  /** Счётчики карточек — из того же списка, что и маркеры (без расхождений с API). */
  const cardCounts = useMemo(() => {
    let linked = 0;
    let withoutPs = 0;
    let revoked = 0;
    for (const q of allQualifications) {
      const without = isWithoutPs(q);
      if (without) withoutPs += 1;
      else if (q.prof_standard_id != null) linked += 1;
      if (isRevokedQualification(q, xlsxCodeSet)) {
        revoked += 1;
      }
    }
    const total = allQualifications.length;
    const revokedFinal = xlsxCodeSet.size > 0 ? revoked : stats.revoked ?? 0;
    return {
      total,
      active: Math.max(0, total - revokedFinal),
      linked,
      withoutPs,
      revoked: revokedFinal,
    };
  }, [allQualifications, xlsxCodeSet, stats.revoked]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [qualsRes, statsRes] = await Promise.all([
        getQualifications(),
        getQualificationsStats(),
      ]);
      setAllQualifications(qualsRes.data);
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
    let result = allQualifications;

    if (cardFilter === FILTERS.active) {
      result = result.filter((q) => !isRevokedQualification(q, xlsxCodeSet));
    } else if (cardFilter === FILTERS.linked) {
      result = result.filter((q) => q.prof_standard_id != null && !isWithoutPs(q));
    } else if (cardFilter === FILTERS.without_ps) {
      result = result.filter((q) => isWithoutPs(q));
    } else if (cardFilter === FILTERS.revoked) {
      result = result.filter((q) => isRevokedQualification(q, xlsxCodeSet));
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (q) =>
          q.name?.toLowerCase().includes(lower) ||
          q.code?.toLowerCase().includes(lower) ||
          q.prof_standard_name?.toLowerCase().includes(lower),
      );
    }
    if (levelFilter && levelFilter !== 'all') {
      result = result.filter((q) => q.level === levelFilter);
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [searchText, levelFilter, cardFilter, allQualifications, xlsxCodeSet]);

  const applyCardFilter = (next) => {
    setCardFilter(next);
    setSearchText('');
    setLevelFilter('all');
    setCurrentPage(1);
  };

  const handleCardClick = (id) => {
    navigate(`/qualifications/${id}`);
  };

  const pollFetchStatus = async () => {
    try {
      const res = await getFetchQualificationsStatus();
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
    setFetchMessage(onlyMissing ? 'Запуск догрузки недостающих...' : 'Запуск полной загрузки...');
    try {
      await fetchQualificationsFromNark(onlyMissing);
      setFetchMessage('Загрузка выполняется на сервере (1–2 ч для полной)...');
      setTimeout(pollFetchStatus, 3000);
    } catch (err) {
      setFetchLoading(false);
      setFetchMessage(err?.response?.data?.detail || 'Ошибка запуска загрузки');
    }
  };

  const levels = [...new Set(allQualifications.map((q) => q.level).filter(Boolean))].sort(
    compareQualificationLevels,
  );

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const totalCount = cardCounts.total || stats.total || stats.local_count || 0;
  const activeCount = cardCounts.active;
  const linkedCount = cardCounts.linked;
  const withoutPsCount = cardCounts.withoutPs;
  const revokedCount = cardCounts.revoked;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Сведения о квалификациях</h2>
        <p className="page-subtitle">
          НАРК: ~4049 квалификаций. В системе: {Number(totalCount).toLocaleString('ru-RU')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <FilterStatCard
          active={cardFilter === FILTERS.all}
          icon={Database}
          color="#6366F1"
          bg="#EEF2FF"
          value={totalCount}
          label="Всего квалификаций"
          loading={loading}
          onClick={() => applyCardFilter(FILTERS.all)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.active}
          icon={CheckCircle2}
          color="#0EA5E9"
          bg="#E0F2FE"
          value={activeCount}
          label="Действующих квалификаций"
          loading={loading}
          onClick={() => applyCardFilter(FILTERS.active)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.linked}
          icon={Link2}
          color="#10B981"
          bg="#ECFDF5"
          value={linkedCount}
          label="Квалификаций на основе ПС"
          loading={loading}
          onClick={() => applyCardFilter(FILTERS.linked)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.without_ps}
          icon={Unlink}
          color="#F59E0B"
          bg="#FEF3C7"
          value={withoutPsCount}
          label="Квалификаций без ПС"
          loading={loading}
          onClick={() => applyCardFilter(FILTERS.without_ps)}
        />
        <FilterStatCard
          active={cardFilter === FILTERS.revoked}
          icon={Ban}
          color="#EF4444"
          bg="#FEE2E2"
          value={revokedCount}
          label="Утратившие силу"
          loading={loading}
          onClick={() => applyCardFilter(FILTERS.revoked)}
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="secondary"
          disabled={fetchLoading}
          onClick={() => handleFetchFromNark(true)}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${fetchLoading ? 'animate-spin' : ''}`} />
          Догрузить с НАРК (~{Math.max(0, 4049 - Number(totalCount || 0))})
        </Button>
        <Button
          variant="outline"
          disabled={fetchLoading}
          onClick={() => {
            if (
              window.confirm(
                'Полная перезагрузка ~4049 квалификаций займёт 1–2 часа. Продолжить?',
              )
            ) {
              handleFetchFromNark(false);
            }
          }}
        >
          Обновить все с НАРК
        </Button>
        {fetchMessage && (
          <span className="text-sm text-muted-foreground">{fetchMessage}</span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={levelFilter}
          onValueChange={(value) => setLevelFilter(value === 'all' ? 'all' : value)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Уровень квалификации" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все уровни</SelectItem>
            {levels.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {lv}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center text-sm text-muted-foreground">
          Найдено: {filtered.length}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Квалификации не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map((q) => (
              <Card
                key={q.id}
                className="hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => handleCardClick(q.id)}
              >
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">
                      {q.code}
                    </code>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {q.level && <Badge variant="secondary">{q.level}</Badge>}
                      {isWithoutPs(q) ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-200">
                          без ПС
                        </Badge>
                      ) : q.prof_standard_id != null ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                          ПС
                        </Badge>
                      ) : null}
                      {q.has_assessment_tools && (
                        <Badge variant="outline" className="text-sky-700 border-sky-200 gap-1">
                          <ClipboardList className="w-3 h-3" />
                          ОС: {q.assessment_tool_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <h4 className="font-medium text-sm line-clamp-2">{q.name}</h4>
                  {q.prof_standard_name && (
                    <div
                      className="text-xs mt-auto"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      ПС:{' '}
                      {q.prof_standard_id != null && q.prof_standard_reg_number ? (
                        <Link
                          to={`/standards?reg=${encodeURIComponent(q.prof_standard_reg_number)}`}
                          className="text-primary hover:underline font-medium"
                          title={q.prof_standard_name}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {q.prof_standard_name.slice(0, 40)}
                          {q.prof_standard_name.length > 40 ? '…' : ''}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {q.prof_standard_name.slice(0, 40)}
                          {q.prof_standard_name.length > 40 ? '…' : ''}
                        </span>
                      )}
                    </div>
                  )}
                  {q.activity_area && (
                    <div className="text-xs text-muted-foreground">{q.activity_area}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Назад
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                {currentPage} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
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

export default QualificationsList;
