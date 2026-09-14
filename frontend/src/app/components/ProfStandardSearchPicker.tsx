import { useEffect, useRef, useState } from 'react';

import { CheckCircle2, Loader2, Search, X, Award } from 'lucide-react';

import { Input } from '@/components/ui/input';

import { Button } from '@/components/ui/button';

import { apiClient } from '@/api/client';

import { areaCodeFromPsCode, getAreaLabel, PROF_STANDARD_AREAS } from '@/lib/profStandardAreas';



export interface ProfStandardSearchItem {

  id: number;

  name: string;

  reg_number: string;

  kind_activity?: string;

  purpose?: string;

  professional_area_code?: string;

  ps_code?: string;

  has_qualifications?: boolean;

  qualification_count?: number;

  matched_okso_codes?: string[];

  matched_okpdtr_codes?: string[];

}



type Props = {

  selectedId: number | null;

  selected: ProfStandardSearchItem | null;

  onSelect: (standard: ProfStandardSearchItem | null) => void;

  selectedIds?: number[];

  allowMultiple?: boolean;

};



const LIMIT = 50;



function standardAreaCode(item: ProfStandardSearchItem): string | null {

  if (item.professional_area_code) {

    return item.professional_area_code.padStart(2, '0');

  }

  return areaCodeFromPsCode(item.ps_code);

}



function matchesArea(item: ProfStandardSearchItem, areaCode: string): boolean {

  if (!areaCode) return true;

  return standardAreaCode(item) === areaCode.padStart(2, '0');

}



function filterStandardsLocal(

  items: ProfStandardSearchItem[],

  query: string,

  areaCode: string,

): ProfStandardSearchItem[] {

  const q = query.trim().toLowerCase();

  if (q.length < 2) return [];



  return items

    .filter((item) => {

      if (!matchesArea(item, areaCode)) return false;

      const haystack = [

        item.name,

        item.reg_number,

        item.kind_activity,

        item.purpose,

        item.ps_code,

      ]

        .filter(Boolean)

        .join(' ')

        .toLowerCase();

      return haystack.includes(q);

    })

    .slice(0, LIMIT);

}



function mergeSearchResults(

  primary: ProfStandardSearchItem[],

  secondary: ProfStandardSearchItem[],

): ProfStandardSearchItem[] {

  const seen = new Set<number>();

  const merged: ProfStandardSearchItem[] = [];

  for (const item of [...primary, ...secondary]) {

    if (seen.has(item.id)) continue;

    seen.add(item.id);

    merged.push(item);

    if (merged.length >= LIMIT) break;

  }

  return merged;

}



export function ProfStandardSearchPicker({ selectedId, selected, onSelect, selectedIds = [], allowMultiple = false }: Props) {

  const [searchQuery, setSearchQuery] = useState('');

  const [areaCode, setAreaCode] = useState('');

  const [results, setResults] = useState<ProfStandardSearchItem[]>([]);

  const [allStandards, setAllStandards] = useState<ProfStandardSearchItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [searchError, setSearchError] = useState('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const selectedStandard = selected;



  useEffect(() => {

    apiClient

      .getStandards()

      .then((data) => setAllStandards(Array.isArray(data) ? data : []))

      .catch(() => setAllStandards([]));

  }, []);



  useEffect(() => {

    const q = searchQuery.trim();

    if (timerRef.current) clearTimeout(timerRef.current);



    if (q.length < 2) {

      setResults([]);

      setLoading(false);

      setSearchError('');

      return;

    }



    setLoading(true);

    setSearchError('');

    timerRef.current = setTimeout(async () => {

      const local = filterStandardsLocal(allStandards, q, areaCode);

      try {

        const data = await apiClient.searchStandards(q, LIMIT, areaCode || undefined);

        const remote = Array.isArray(data) ? data : [];

        setResults(mergeSearchResults(remote, local));

      } catch (err: unknown) {

        console.error('Standard search failed:', err);

        setResults(local);

        if (local.length === 0) {

          const message = err instanceof Error ? err.message : 'Ошибка поиска';

          setSearchError(message);

        }

      } finally {

        setLoading(false);

      }

    }, 350);



    return () => {

      if (timerRef.current) clearTimeout(timerRef.current);

    };

  }, [searchQuery, areaCode, allStandards]);



  const handleSelect = (item: ProfStandardSearchItem) => {

    onSelect(item);

    setSearchQuery('');

    setResults([]);

    setSearchError('');

  };



  const handleClear = () => {

    onSelect(null);

    setSearchQuery('');

    setResults([]);

    setSearchError('');

  };



  const showResults = searchQuery.trim().length >= 2;



  return (

    <div className="space-y-4">

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">

        <div className="relative">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />

          <Input

            type="text"

            value={searchQuery}

            onChange={(e) => setSearchQuery(e.target.value)}

            placeholder="Поиск по названию, рег. номеру, коду ПС…"

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

          value={areaCode}

          onChange={(e) => setAreaCode(e.target.value)}

          className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

          aria-label="Область профессиональной деятельности"

        >

          <option value="">Все области деятельности</option>

          {PROF_STANDARD_AREAS.map((area) => (

            <option key={area.code} value={area.code}>

              {area.code} — {area.name}

            </option>

          ))}

        </select>

      </div>



      <p className="text-xs text-gray-500">

        Поиск по реестру профстандартов. Минимум 2 символа — например, «программист», «06.001» или «1224». Можно добавить несколько профстандартов.

      </p>



      {searchError && (

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">

          Серверный поиск недоступен ({searchError}). Показаны локальные результаты из загруженного реестра.

        </p>

      )}



      {selectedStandard && !allowMultiple && (

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-3">

          <div className="min-w-0">

            <div className="flex items-center gap-2 mb-1">

              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />

              <span className="text-sm font-semibold text-primary">Выбран профстандарт</span>

            </div>

            <p className="text-sm font-medium text-gray-900">{selectedStandard.reg_number}</p>

            <p className="text-sm text-gray-700 mt-1">{selectedStandard.name}</p>

            {standardAreaCode(selectedStandard) && (

              <p className="text-xs text-gray-500 mt-1">

                Область {standardAreaCode(selectedStandard)}: {getAreaLabel(standardAreaCode(selectedStandard))}

              </p>

            )}

          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleClear}>

            Сменить

          </Button>

        </div>

      )}



      {(!selectedStandard || allowMultiple) && (

        <div className="rounded-xl border border-gray-200 min-h-[280px] max-h-[420px] overflow-y-auto">

          {!showResults ? (

            <div className="flex flex-col items-center justify-center h-[280px] text-center px-6 text-gray-500">

              <Search className="w-10 h-10 mb-3 opacity-40" />

              <p className="text-sm">Начните ввод для поиска среди профстандартов</p>

            </div>

          ) : loading ? (

            <div className="flex items-center justify-center gap-2 h-[280px] text-gray-500">

              <Loader2 className="w-5 h-5 animate-spin" />

              <span className="text-sm">Поиск…</span>

            </div>

          ) : results.length === 0 ? (

            <div className="flex flex-col items-center justify-center h-[280px] text-center px-6 text-gray-500">

              <p className="text-sm">Ничего не найдено. Попробуйте другой запрос или область деятельности.</p>

            </div>

          ) : (

            <ul className="divide-y divide-gray-100">

              {results.map((item) => (

                <li key={item.id}>

                  <button

                    type="button"

                    onClick={() => handleSelect(item)}

                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${

                      selectedId === item.id || selectedIds.includes(item.id) ? 'bg-primary/5' : ''

                    }`}

                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2 mb-1">

                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">

                            {item.reg_number}

                          </span>

                          {item.ps_code && (

                            <span className="text-xs text-gray-500">{item.ps_code}</span>

                          )}

                          {item.has_qualifications && (

                            <span

                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded"

                              title={`Разработано квалификаций: ${item.qualification_count ?? 0}`}

                            >

                              <Award className="w-3 h-3" />

                              {item.qualification_count}

                            </span>

                          )}

                          {standardAreaCode(item) && (

                            <span className="text-xs text-gray-500" title={getAreaLabel(standardAreaCode(item)) || undefined}>

                              Обл. {standardAreaCode(item)}

                            </span>

                          )}

                        </div>

                        <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>

                        {item.kind_activity && (

                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.kind_activity}</p>

                        )}

                      </div>

                      {(selectedId === item.id || selectedIds.includes(item.id)) && (

                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />

                      )}

                    </div>

                  </button>

                </li>

              ))}

            </ul>

          )}

        </div>

      )}



      {showResults && !loading && results.length > 0 && !selectedStandard && (

        <p className="text-xs text-gray-500">Найдено: {results.length}. Показаны первые {LIMIT} результатов.</p>

      )}

    </div>

  );

}


