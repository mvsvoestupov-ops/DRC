import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/client';

export interface FgosSearchItem {
  id: number;
  code: string;
  name: string;
  category: string;
  category_label?: string;
  qualification?: string;
  group_name?: string;
}

export const FGOS_CATEGORY_LABELS: Record<string, string> = {
  spo: 'СПО',
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
  specialist: 'Специалитет',
  aspirantura: 'Аспирантура',
  adjunct: 'Адъюнктура',
  ordinatura: 'Ординатура',
};

export const FGOS_CATEGORIES_BY_EDUCATION_LEVEL: Record<string, string[]> = {
  'среднее профессиональное образование': ['spo'],
  'высшее образование - бакалавриат': ['bachelor'],
  'высшее образование - специалитет, магистратура': ['specialist', 'master'],
  'высшее образование - подготовка кадров высшей квалификации': [
    'aspirantura',
    'adjunct',
    'ordinatura',
  ],
};

export const ALL_FGOS_CATEGORY_IDS = Object.keys(FGOS_CATEGORY_LABELS);

type Props = {
  selectedId: number | null;
  selected: FgosSearchItem | null;
  categories: string[];
  allowCategoryFilter?: boolean;
  onSelect: (item: FgosSearchItem | null) => void;
};

const LIMIT = 40;

export function FgosSearchPicker({
  selectedId,
  selected,
  categories,
  allowCategoryFilter = false,
  onSelect,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [results, setResults] = useState<FgosSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCategories = categoryFilter ? [categoryFilter] : categories;
  const categoryHint = activeCategories.map((id) => FGOS_CATEGORY_LABELS[id] || id).join(', ');

  useEffect(() => {
    setCategoryFilter('');
  }, [categories.join(',')]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      try {
        const data = await apiClient.searchFgos(
          {
            q,
            categories: activeCategories.length ? activeCategories : undefined,
            limit: LIMIT,
          },
          { signal: controller.signal },
        );
        if (cancelled) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
      } catch (err: unknown) {
        if (cancelled) return;
        setResults([]);
        setTotal(0);
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        setError(
          aborted
            ? 'Сервер не ответил. Перезапустите backend и повторите поиск.'
            : err instanceof Error
              ? err.message
              : 'Ошибка поиска ФГОС',
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchQuery, categoryFilter, categories.join(',')]);

  if (selected) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-primary">Выбран ФГОС</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {selected.code} — {selected.name}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {[selected.category_label || FGOS_CATEGORY_LABELS[selected.category], selected.qualification]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
          Сменить
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 ${allowCategoryFilter ? 'lg:grid-cols-[1fr_220px]' : ''} gap-3`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск ФГОС по коду или названию…"
            className="pl-10 pr-10"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Очистить поиск"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {allowCategoryFilter && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Категория ФГОС"
          >
            <option value="">Все уровни ФГОС</option>
            {(categories.length ? categories : ALL_FGOS_CATEGORY_IDS).map((id) => (
              <option key={id} value={id}>
                {FGOS_CATEGORY_LABELS[id] || id}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Поиск среди: {categoryHint || 'всех ФГОС'}. Минимум 2 символа — например, «09.02.07» или «информацион».
      </p>

      {error && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 min-h-[220px] max-h-[320px] overflow-y-auto">
        {searchQuery.trim().length < 2 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center px-6 text-gray-500">
            <Search className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Начните ввод, чтобы найти ФГОС</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 h-[220px] text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Поиск…</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center px-6 text-gray-500">
            <p className="text-sm">Ничего не найдено. Измените запрос.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedId === item.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {item.code}
                    </span>
                    {(item.category_label || FGOS_CATEGORY_LABELS[item.category]) && (
                      <span className="text-xs text-gray-500">
                        {item.category_label || FGOS_CATEGORY_LABELS[item.category]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
                  {item.qualification && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.qualification}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && results.length > 0 && (
        <p className="text-xs text-gray-500">
          Показано {results.length} из {total.toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  );
}
