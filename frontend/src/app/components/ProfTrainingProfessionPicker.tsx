import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/client';

export interface ProfTrainingProfessionItem {
  id: number;
  item_number: string;
  name: string;
  category: string;
  category_label?: string;
  section?: string | null;
  okpdtr_code?: string | null;
  qualification_rank?: string | null;
}

type Props = {
  selectedId: number | null;
  selected: ProfTrainingProfessionItem | null;
  onSelect: (item: ProfTrainingProfessionItem | null) => void;
};

const LIMIT = 40;

export function ProfTrainingProfessionPicker({ selectedId, selected, onSelect }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<ProfTrainingProfessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const data = await apiClient.getProfTrainingProfessions(
          {
            q,
            category: category || undefined,
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
        setError(aborted ? 'Сервер не ответил. Перезапустите backend и повторите поиск.' : err instanceof Error ? err.message : 'Ошибка загрузки перечня');
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
  }, [searchQuery, category]);

  const handleSelect = (item: ProfTrainingProfessionItem) => {
    onSelect(item);
    setSearchQuery('');
  };

  const handleClear = () => {
    onSelect(null);
    setSearchQuery('');
  };

  if (selected) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-primary">Выбрана профессия / должность</span>
          </div>
          <p className="text-sm font-medium text-gray-900">{selected.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            {[selected.category_label, selected.section, selected.okpdtr_code ? `ОКПДТР ${selected.okpdtr_code}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {selected.qualification_rank && (
            <p className="text-xs text-gray-500 mt-0.5">Разряд: {selected.qualification_rank}</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Сменить
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, коду ОКПДТР, разделу…"
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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          <option value="worker">Профессии рабочих</option>
          <option value="employee">Должности служащих</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">
        Перечень по приказу Минпросвещения №534. Введите не менее 2 символов — например, «спасат» или код ОКПДТР.
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
            <p className="text-sm">Начните ввод, чтобы найти профессию или должность</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 h-[220px] text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Загрузка…</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center px-6 text-gray-500">
            <p className="text-sm">Ничего не найдено. Измените запрос или категорию.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedId === item.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {[
                      item.category_label,
                      item.section,
                      item.okpdtr_code ? `ОКПДТР ${item.okpdtr_code}` : null,
                      item.qualification_rank ? `разр. ${item.qualification_rank}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
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
