import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/app/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, RefreshCw, Zap, TreePine, LayoutGrid, Search, BookOpen, Sparkles, X, FileDown, Printer, Award, Landmark, ClipboardList } from 'lucide-react';
import {
  uploadFile,
  getStandard,
  fetchBulkRegistry,
  getEnrichedStandards,
  getEnrichedStandard,
  getEnrichmentStats,
  runEnrichment,
  getStandardsPage,
  downloadStandardDocx,
  getStandardPrintHtmlUrl,
  getQualificationsByStandard,
  relinkQualificationsToStandards,
  getStandardsSpkList,
  importSpkAssignments,
} from '@/api/compat';
import StandardStructureViewer from '@/legacy/components/StandardStructureViewer';
import StandardCardGraph from '@/legacy/components/StandardCardGraph';
import {
  PROF_STANDARD_AREAS,
  getAreaLabel,
  getStandardAreaCode,
} from '@/lib/profStandardAreas';

const MIN_MODAL_DISPLAY_TIME = 800;
const RAW_PAGE_SIZE = 40;

function filterStandards(items, query) {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter((item) =>
    (item.name || '').toLowerCase().includes(q) ||
    (item.reg_number || '').toLowerCase().includes(q) ||
    (item.kind_activity || '').toLowerCase().includes(q) ||
    (item.spk_name || '').toLowerCase().includes(q) ||
    (getAreaLabel(getStandardAreaCode(item)) || '').toLowerCase().includes(q)
  );
}

const StandardsPage = () => {
  const [rawItems, setRawItems] = useState([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawPage, setRawPage] = useState(1);
  const [rawPages, setRawPages] = useState(0);
  const [rawPageSize] = useState(RAW_PAGE_SIZE);
  const [withQualificationsCount, setWithQualificationsCount] = useState(0);
  const [areaCounts, setAreaCounts] = useState({});
  const [enrichedStandards, setEnrichedStandards] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('raw');
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkReg = (searchParams.get('reg') || '').trim();
  const deepLinkAppliedRef = useRef('');
  const [viewMode, setViewMode] = useState('tree');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [rawListLoading, setRawListLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichAllLoading, setEnrichAllLoading] = useState(false);
  const [enrichmentStats, setEnrichmentStats] = useState({ total_raw: 0, enriched: 0, pending: 0, orphaned_enriched: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogText, setDialogText] = useState('');
  const [dialogSpinning, setDialogSpinning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [onlyWithQualifications, setOnlyWithQualifications] = useState(false);
  const [linkedQualifications, setLinkedQualifications] = useState([]);
  const [linkedQualificationsLoading, setLinkedQualificationsLoading] = useState(false);
  const [relinkLoading, setRelinkLoading] = useState(false);
  const [spkFilter, setSpkFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [spkList, setSpkList] = useState([]);
  const [spkImportLoading, setSpkImportLoading] = useState(false);
  const fileInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const rawFetchReadyRef = useRef(false);
  const prevRawFilterKeyRef = useRef('');
  const rawFiltersRef = useRef({
    q: '',
    spk: '',
    area: '',
    onlyWithQualifications: false,
    page: 1,
  });

  rawFiltersRef.current = {
    q: debouncedSearchQuery,
    spk: spkFilter,
    area: areaFilter,
    onlyWithQualifications,
    page: rawPage,
  };

  const applyRawPageData = useCallback((data, fallbackPage = 1) => {
    setRawItems(Array.isArray(data.items) ? data.items : []);
    setRawTotal(data.total ?? 0);
    setRawPage(data.page ?? fallbackPage);
    setRawPages(data.pages ?? 0);
    setWithQualificationsCount(data.with_qualifications_count ?? 0);
    setAreaCounts(data.area_counts && typeof data.area_counts === 'object' ? data.area_counts : {});
  }, []);

  const loadRawPage = useCallback(async (page, overrides = {}) => {
    const current = rawFiltersRef.current;
    const q = String(overrides.q ?? current.q ?? '').trim();
    const spk = overrides.spk ?? current.spk;
    const area = overrides.area ?? current.area;
    const onlyQual = overrides.onlyWithQualifications ?? current.onlyWithQualifications;
    const pageNum = page ?? current.page ?? 1;

    setRawListLoading(true);
    try {
      const res = await getStandardsPage({
        page: pageNum,
        limit: rawPageSize,
        q: q || undefined,
        spk: spk || undefined,
        area: area || undefined,
        only_with_qualifications: onlyQual || undefined,
      });
      applyRawPageData(res.data || {}, pageNum);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки сырых стандартов' });
    } finally {
      setRawListLoading(false);
    }
  }, [applyRawPageData, rawPageSize]);

  const loadEnrichedList = async () => {
    try {
      const res = await getEnrichedStandards();
      setEnrichedStandards(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки обогащённых стандартов' });
    }
  };

  const loadEnrichmentStats = async () => {
    try {
      const res = await getEnrichmentStats();
      setEnrichmentStats(res.data);
    } catch {
      /* stats optional */
    }
  };

  // Initial load: enrichment stats + enriched list + first raw page (no full getStandards)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      await loadEnrichmentStats();
      if (cancelled) return;
      await Promise.all([
        loadRawPage(1, { q: '', spk: '', area: '', onlyWithQualifications: false }),
        loadEnrichedList(),
      ]);
      if (!cancelled) setListLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadRawPage]);

  // Debounce search query before refetching raw page
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const rawFilterKey = `${debouncedSearchQuery}|${spkFilter}|${areaFilter}|${onlyWithQualifications}`;

  // Fetch raw page when page/filters change (after initial load)
  useEffect(() => {
    if (!rawFetchReadyRef.current) {
      if (!listLoading) {
        rawFetchReadyRef.current = true;
        prevRawFilterKeyRef.current = rawFilterKey;
      }
      return;
    }

    if (prevRawFilterKeyRef.current !== rawFilterKey) {
      prevRawFilterKeyRef.current = rawFilterKey;
      if (rawPage !== 1) {
        setRawPage(1);
        return;
      }
    }

    loadRawPage(rawPage);
  }, [rawPage, rawFilterKey, listLoading, loadRawPage]);

  useEffect(() => {
    if (!deepLinkReg || listLoading) return;
    if (deepLinkAppliedRef.current === deepLinkReg) return;
    if (selected?.reg_number && String(selected.reg_number) === deepLinkReg) {
      deepLinkAppliedRef.current = deepLinkReg;
      return;
    }
    deepLinkAppliedRef.current = deepLinkReg;
    setActiveTab('raw');
    handleSelectRaw(deepLinkReg);
  }, [deepLinkReg, listLoading]);

  useEffect(() => {
    getStandardsSpkList()
      .then((res) => setSpkList(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSpkList([]));
  }, [enrichmentStats.total_raw]);

  const applyQualificationFilter = useCallback((items) => {
    if (!onlyWithQualifications) return items;
    return items.filter((item) => item.has_qualifications);
  }, [onlyWithQualifications]);

  const applySpkFilter = useCallback((items) => {
    if (!spkFilter) return items;
    const target = spkFilter.toLocaleLowerCase('ru-RU');
    return items.filter((item) => (item.spk_name || '').toLocaleLowerCase('ru-RU') === target);
  }, [spkFilter]);

  const applyAreaFilter = useCallback((items) => {
    if (!areaFilter) return items;
    return items.filter((item) => getStandardAreaCode(item) === areaFilter);
  }, [areaFilter]);

  const areaFilterOptions = useMemo(() => {
    return PROF_STANDARD_AREAS
      .filter((area) => areaCounts[area.code])
      .map((area) => ({ ...area, count: areaCounts[area.code] || 0 }));
  }, [areaCounts]);

  const filteredEnrichedStandards = useMemo(
    () => applyAreaFilter(applySpkFilter(applyQualificationFilter(filterStandards(enrichedStandards, searchQuery)))),
    [enrichedStandards, searchQuery, applyQualificationFilter, applySpkFilter, applyAreaFilter]
  );

  useEffect(() => {
    if (!selected?.id || selected?.type === 'enriched') {
      setLinkedQualifications([]);
      return;
    }

    let cancelled = false;
    setLinkedQualificationsLoading(true);
    getQualificationsByStandard(selected.id)
      .then((res) => {
        if (!cancelled) setLinkedQualifications(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setLinkedQualifications([]);
      })
      .finally(() => {
        if (!cancelled) setLinkedQualificationsLoading(false);
      });

    return () => { cancelled = true; };
  }, [selected?.id, selected?.type]);

  const handleRelinkQualifications = async () => {
    setRelinkLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await relinkQualificationsToStandards();
      const data = res.data || {};
      const audit = data.audit || {};
      const issues = audit.issues || {};
      const mismatch =
        (issues.code_mismatch || 0) +
        (issues.name_mismatch || 0) +
        (issues.year_mismatch || 0);

      setMessage({
        type: mismatch > 0 ? 'error' : 'success',
        text:
          `Связано: ${data.linked ?? 0}. ` +
          `ПС с квалификациями: ${audit.standards_with_qualifications ?? data.standards_with_qualifications ?? '—'}. ` +
          `Без связи: ${audit.unlinked_qualifications ?? data.unlinked_qualifications ?? '—'}. ` +
          `Конфликты (код/название/год): ${issues.code_mismatch ?? 0}/${issues.name_mismatch ?? 0}/${issues.year_mismatch ?? 0}. ` +
          `Нет ПС в базе под код квалификации: ${issues.unlinked_missing_ps_in_db ?? 0}.`,
      });

      await loadRawPage(rawPage);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Ошибка пересвязки: ' + (err.response?.data?.detail || err.message || ''),
      });
    } finally {
      setRelinkLoading(false);
    }
  };

  const handleImportSpk = async () => {
    setSpkImportLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await importSpkAssignments();
      const data = res.data || {};
      setMessage({
        type: 'success',
        text: `СПК импортированы: обновлено ${data.updated ?? 0} из ${data.xlsx_rows ?? '—'} строк`,
      });
      await loadRawPage(rawPage);
      const spkRes = await getStandardsSpkList();
      setSpkList(Array.isArray(spkRes.data) ? spkRes.data : []);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Ошибка импорта СПК: ' + (err.response?.data?.detail || err.message || ''),
      });
    } finally {
      setSpkImportLoading(false);
    }
  };

  const totalInTab = activeTab === 'raw' ? enrichmentStats.total_raw : enrichmentStats.enriched;
  const foundCount = activeTab === 'raw' ? rawTotal : filteredEnrichedStandards.length;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await uploadFile(file);
      setMessage({ type: 'success', text: 'Файл загружен' });
      await loadRawPage(rawPage);
      await loadEnrichmentStats();
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки: ' + (err.response?.data?.detail || '') });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBulk = async () => {
    setBulkLoading(true);
    setDialogOpen(true);
    setDialogTitle('Загрузка стандартов из реестра');
    setDialogText('Идёт сбор и загрузка данных...');
    setDialogSpinning(true);
    const startTime = Date.now();
    try {
      const res = await fetchBulkRegistry();
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'success', text: `Загружено ${res.data.loaded?.length || 0} стандартов` });
      await loadRawPage(rawPage);
      await loadEnrichmentStats();
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'error', text: 'Ошибка при массовой загрузке' });
    } finally {
      setBulkLoading(false);
      setDialogSpinning(false);
      setDialogOpen(false);
    }
  };

  const handleRunEnrichment = async (onlyMissing = true) => {
    const pending = enrichmentStats.pending;
    if (onlyMissing && pending === 0) {
      setMessage({ type: 'success', text: 'Все профстандарты уже обогащены' });
      return;
    }
    if (onlyMissing) {
      setEnrichLoading(true);
    } else {
      setEnrichAllLoading(true);
    }
    setDialogOpen(true);
    setDialogTitle(onlyMissing ? 'Обогащение недостающих ПС' : 'Переобогащение всех ПС');
    setDialogText(
      onlyMissing
        ? `Обрабатывается ${pending.toLocaleString('ru-RU')} из ${enrichmentStats.total_raw.toLocaleString('ru-RU')} профстандартов...`
        : `Переобогащение всех ${enrichmentStats.total_raw.toLocaleString('ru-RU')} профстандартов...`
    );
    setDialogSpinning(true);
    const startTime = Date.now();
    try {
      const res = await runEnrichment({ onlyMissing });
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      const processed = res.data.processed?.length || 0;
      const failed = res.data.failed?.length || 0;
      const left = res.data.pending ?? 0;
      setMessage({
        type: failed ? 'error' : 'success',
        text: failed
          ? `Обогащено ${processed}, ошибок ${failed}, осталось ${left}`
          : `Обогащено ${processed} профстандартов. Осталось необогащённых: ${left}`,
      });
      await Promise.all([loadEnrichedList(), loadEnrichmentStats()]);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_MODAL_DISPLAY_TIME - elapsed);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      setMessage({ type: 'error', text: 'Ошибка при обогащении' });
    } finally {
      setEnrichLoading(false);
      setEnrichAllLoading(false);
      setDialogSpinning(false);
      setDialogOpen(false);
    }
  };

  const handleSelectRaw = async (regNumber) => {
    try {
      const res = await getStandard(regNumber);
      setSelected({ ...res.data, type: 'raw' });
      const nextReg = String(regNumber || '');
      if (nextReg && searchParams.get('reg') !== nextReg) {
        setSearchParams({ reg: nextReg }, { replace: true });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка получения данных' });
    }
  };

  const handleSelectEnriched = async (regNumber) => {
    try {
      const res = await getEnrichedStandard(regNumber);
      setSelected({ ...res.data, type: 'enriched' });
      const nextReg = String(regNumber || '');
      if (nextReg && searchParams.get('reg') !== nextReg) {
        setSearchParams({ reg: nextReg }, { replace: true });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка получения обогащённых данных' });
    }
  };

  const renderStandardList = (items, onSelect) => (
    <div className="space-y-1">
      {items.map((item) => {
        const isSelected = selected?.reg_number === item.reg_number;
        return (
          <div
            key={item.reg_number}
            onClick={() => onSelect(item.reg_number)}
            className={`cursor-pointer p-3 rounded-lg transition-colors ${
              isSelected
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-accent border border-transparent'
            }`}
          >
            <div className="font-medium text-sm line-clamp-2">{item.name}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="text-xs text-muted-foreground">Рег. № {item.reg_number}</div>
              {getStandardAreaCode(item) && (
                <span className="text-[10px] text-muted-foreground" title={getAreaLabel(getStandardAreaCode(item)) || undefined}>
                  Обл. {getStandardAreaCode(item)}
                </span>
              )}
              {item.has_qualifications && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-emerald-50 text-emerald-800 border-emerald-200">
                  <Award className="w-3 h-3" />
                  Квалификации: {item.qualification_count}
                </Badge>
              )}
              {item.has_assessment_tools && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-sky-50 text-sky-800 border-sky-200">
                  <ClipboardList className="w-3 h-3" />
                  ОС: {item.assessment_tool_count}
                </Badge>
              )}
              {item.spk_name && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5 gap-1 max-w-full bg-violet-50 text-violet-900 border-violet-200"
                  title={item.spk_name}
                >
                  <Landmark className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[180px]">{item.spk_name}</span>
                </Badge>
              )}
            </div>
            {item.kind_activity && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.kind_activity}</div>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-8">
          {searchQuery.trim() ? 'Ничего не найдено' : 'Нет данных'}
        </div>
      )}
    </div>
  );

  const renderRawPagination = () => (
    <div className="flex items-center justify-between gap-2 pt-3 px-1 shrink-0 border-t border-border/60 mt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rawPage <= 1 || rawListLoading}
        onClick={() => setRawPage((p) => Math.max(1, p - 1))}
      >
        Назад
      </Button>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {rawPages > 0 ? `${rawPage} из ${rawPages}` : '—'}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rawPage >= rawPages || rawListLoading || rawPages === 0}
        onClick={() => setRawPage((p) => p + 1)}
      >
        Вперёд
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Заголовок и статистика */}
      <div>
        <h1 className="page-title mb-1">Профессиональные стандарты</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Загрузка, обогащение и просмотр профессиональных стандартов
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего профстандартов</p>
                <p className="text-2xl font-bold text-gray-900">
                  {listLoading ? '—' : enrichmentStats.total_raw.toLocaleString('ru-RU')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Обогащённых</p>
                <p className="text-2xl font-bold text-gray-900">
                  {listLoading ? '—' : enrichmentStats.enriched.toLocaleString('ru-RU')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ожидают обогащения</p>
                <p className="text-2xl font-bold text-gray-900">
                  {listLoading ? '—' : enrichmentStats.pending.toLocaleString('ru-RU')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">С разработанными квалификациями</p>
                <p className="text-2xl font-bold text-gray-900">
                  {listLoading ? '—' : withQualificationsCount.toLocaleString('ru-RU')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".xml" onChange={handleUpload} className="hidden" />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          <Upload className="w-4 h-4 mr-2" />
          Загрузить XML
        </Button>
        <Button onClick={handleFetchBulk} disabled={bulkLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${bulkLoading ? 'animate-spin' : ''}`} />
          Загрузить все стандарты (bulk)
        </Button>
        <Button
          onClick={() => handleRunEnrichment(true)}
          disabled={enrichLoading || enrichAllLoading || enrichmentStats.pending === 0}
          variant="secondary"
        >
          <Zap className="w-4 h-4 mr-2" />
          {enrichLoading
            ? 'Обогащение...'
            : `Обогатить недостающие (${listLoading ? '…' : enrichmentStats.pending})`}
        </Button>
        <Button
          onClick={() => {
            if (window.confirm(`Переобогатить все ${enrichmentStats.total_raw} профстандартов? Это займёт много времени.`)) {
              handleRunEnrichment(false);
            }
          }}
          disabled={enrichLoading || enrichAllLoading || enrichmentStats.total_raw === 0}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${enrichAllLoading ? 'animate-spin' : ''}`} />
          Переобогатить все
        </Button>
        <Button
          variant="outline"
          onClick={handleRelinkQualifications}
          disabled={relinkLoading}
        >
          <Award className={`w-4 h-4 mr-2 ${relinkLoading ? 'animate-pulse' : ''}`} />
          {relinkLoading ? 'Пересвязка…' : 'Пересвязать квалификации'}
        </Button>
        <Button
          variant="outline"
          onClick={handleImportSpk}
          disabled={spkImportLoading}
        >
          <Landmark className={`w-4 h-4 mr-2 ${spkImportLoading ? 'animate-pulse' : ''}`} />
          {spkImportLoading ? 'Импорт СПК…' : 'Импорт СПК из Excel'}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Switch checked={viewMode === 'cards'} onCheckedChange={(checked) => setViewMode(checked ? 'cards' : 'tree')} />
          {viewMode === 'tree' ? <TreePine className="w-4 h-4 text-muted-foreground" /> : <LayoutGrid className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {message.text && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-96 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, рег. №, виду деятельности..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
                aria-label="Очистить поиск"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="px-1">
            <label htmlFor="area-filter" className="text-xs text-muted-foreground block mb-1">
              Область профессиональной деятельности
            </label>
            <select
              id="area-filter"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Все области ({areaFilterOptions.length || '—'})</option>
              {areaFilterOptions.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.code} — {area.name} ({area.count})
                </option>
              ))}
            </select>
          </div>
          <div className="px-1">
            <label htmlFor="spk-filter" className="text-xs text-muted-foreground block mb-1">
              СПК (совет по проф. квалификациям)
            </label>
            <select
              id="spk-filter"
              value={spkFilter}
              onChange={(e) => setSpkFilter(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Все СПК ({spkList.length || '—'})</option>
              {spkList.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <label htmlFor="only-with-qualifications" className="text-xs text-muted-foreground cursor-pointer">
              Только профстандарты с квалификациями
            </label>
            <Switch
              id="only-with-qualifications"
              checked={onlyWithQualifications}
              onCheckedChange={setOnlyWithQualifications}
            />
          </div>
          <p className="text-xs text-muted-foreground px-1">
            {activeTab === 'raw' && rawListLoading ? (
              'Поиск...'
            ) : searchQuery.trim() ? (
              <>Найдено: <strong>{foundCount.toLocaleString('ru-RU')}</strong> из {totalInTab.toLocaleString('ru-RU')}</>
            ) : (
              <>Всего в списке: {(activeTab === 'raw' ? rawTotal : totalInTab).toLocaleString('ru-RU')}</>
            )}
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 h-[62vh] max-h-[62vh]">
            <TabsList className="w-full mb-2 shrink-0">
              <TabsTrigger value="raw" className="flex-1">
                Сырые ({enrichmentStats.total_raw})
              </TabsTrigger>
              <TabsTrigger value="enriched" className="flex-1">
                Обогащённые ({enrichmentStats.enriched})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="raw" className="flex flex-col flex-1 min-h-0 mt-0">
              <div className="flex-1 min-h-0 overflow-y-auto">
                {listLoading && rawItems.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">Загрузка...</div>
                ) : (
                  renderStandardList(rawItems, handleSelectRaw)
                )}
              </div>
              {renderRawPagination()}
            </TabsContent>
            <TabsContent value="enriched" className="flex-1 min-h-0 overflow-y-auto mt-0">
              {listLoading ? (
                <div className="text-center text-muted-foreground text-sm py-8">Загрузка...</div>
              ) : (
                renderStandardList(filteredEnrichedStandards, handleSelectEnriched)
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex-1 min-w-0 min-h-0">
          {selected ? (
            <Card className="flex flex-col h-[70vh] max-h-[70vh]">
              <CardContent className="p-4 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-start mb-4 shrink-0 gap-4 border-b border-gray-100 pb-3">
                  <span className="font-semibold text-sm line-clamp-2">{selected.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeTab === 'raw' && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={async () => {
                            try {
                              const blob = await downloadStandardDocx(selected.reg_number);
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `PS_${selected.reg_number}.docx`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              setMessage({ type: 'error', text: err?.message || 'Не удалось скачать DOCX' });
                            }
                          }}
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          DOCX
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => {
                            const url = getStandardPrintHtmlUrl(selected.reg_number);
                            const token = localStorage.getItem('token');
                            // Открываем с токеном через fetch + blob, чтобы Authorization дошёл
                            fetch(url, {
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            })
                              .then((r) => {
                                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                                return r.text();
                              })
                              .then((html) => {
                                const w = window.open('', '_blank');
                                if (w) {
                                  w.document.write(html);
                                  w.document.close();
                                }
                              })
                              .catch((err) => {
                                setMessage({ type: 'error', text: err?.message || 'Не удалось открыть версию для печати' });
                              });
                          }}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Печать
                        </Button>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Рег. № {selected.reg_number}</span>
                  </div>
                </div>
                {selected?.spk_name && (
                  <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="w-4 h-4 text-violet-700 shrink-0" />
                      <span className="text-sm font-semibold text-violet-900">Закреплён за СПК</span>
                    </div>
                    <p className="text-sm text-violet-900 leading-snug">{selected.spk_name}</p>
                  </div>
                )}
                {selected?.type !== 'enriched' && (linkedQualificationsLoading || linkedQualifications.length > 0) && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span className="text-sm font-semibold text-emerald-900">
                        Разработанные квалификации
                      </span>
                    </div>
                    {linkedQualificationsLoading ? (
                      <p className="text-xs text-emerald-800">Загрузка списка…</p>
                    ) : (
                      <ul className="space-y-1">
                        {linkedQualifications.map((q) => (
                          <li key={q.id} className="text-sm text-emerald-900">
                            <a href={`/qualifications/${q.id}`} className="hover:underline">
                              {q.code ? `${q.code} — ` : ''}{q.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1">
                  {viewMode === 'tree' ? (
                    <StandardStructureViewer standard={selected} />
                  ) : (
                    <StandardCardGraph standard={selected} />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed flex flex-col h-[70vh] max-h-[70vh]">
              <CardContent className="p-12 text-center flex flex-col items-center justify-center h-full">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Выберите стандарт из списка слева</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogText}</DialogDescription>
          </DialogHeader>
          {dialogSpinning && (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StandardsPage;
