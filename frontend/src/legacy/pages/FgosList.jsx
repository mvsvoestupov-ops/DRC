import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ScrollText, ExternalLink } from 'lucide-react';
import { getFgosCategories, getFgosList } from '@/api/compat';

const DEFAULT_CATEGORY = 'spo';

const FgosGrid = ({ items, loading, onOpen, emptyHint }) => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.code?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.qualification?.toLowerCase().includes(q)
    );
  }, [items, searchText]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, items]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по коду, названию, квалификации…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
          Найдено: {filtered.length}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-2">Записи не найдены</p>
            {emptyHint && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map((item) => (
              <Card
                key={item.id}
                className="hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => onOpen(item.id)}
              >
                <CardContent className="p-4 flex flex-col gap-2 min-h-[120px]">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">{item.code}</code>
                    {item.kind === 'profession' ? (
                      <Badge variant="outline" className="text-[10px]">профессия</Badge>
                    ) : (
                      item.category_label && (
                        <Badge variant="secondary" className="text-[10px]">{item.category_label}</Badge>
                      )
                    )}
                  </div>
                  <h4 className="font-medium text-sm line-clamp-3">{item.name}</h4>
                  {item.group_name && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {item.group_code} — {item.group_name}
                    </p>
                  )}
                  {item.qualification && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-auto">{item.qualification}</p>
                  )}
                  {item.qualification_tracks_count > 1 && (
                    <p className="text-[10px] text-primary mt-1">
                      {item.qualification_tracks_count} программы подготовки
                    </p>
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

const FgosList = () => {
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [loadingCategory, setLoadingCategory] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const loadedRef = useRef(new Set());

  const activeCategory = searchParams.get('section') || DEFAULT_CATEGORY;

  useEffect(() => {
    getFgosCategories()
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (loadedRef.current.has(activeCategory)) return;
    setLoadingCategory(activeCategory);
    getFgosList(activeCategory)
      .then((res) => {
        loadedRef.current.add(activeCategory);
        setItemsByCategory((prev) => ({
          ...prev,
          [activeCategory]: Array.isArray(res.data) ? res.data : [],
        }));
      })
      .catch(() => {
        loadedRef.current.add(activeCategory);
        setItemsByCategory((prev) => ({ ...prev, [activeCategory]: [] }));
      })
      .finally(() => setLoadingCategory(null));
  }, [activeCategory]);

  const activeItems = itemsByCategory[activeCategory] || [];
  const totalCount = categories.reduce((sum, c) => sum + (c.local_count || 0), 0);

  const handleTabChange = (value) => {
    setSearchParams({ section: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">ФГОС</h2>
        <p className="page-subtitle">
          Федеральные государственные образовательные стандарты (classinform.ru).
          В системе: {totalCount.toLocaleString('ru-RU')} записей
        </p>
      </div>

      {!categories.length ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">Загрузка разделов…</CardContent>
        </Card>
      ) : (
        <Tabs value={activeCategory} onValueChange={handleTabChange} className="flex flex-col md:flex-row gap-6 w-full">
          <TabsList className="flex flex-col h-auto w-full md:w-80 md:min-w-80 md:flex-shrink-0 items-stretch gap-1 p-2 bg-muted/40">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="justify-start text-left whitespace-normal h-auto py-2.5 px-3 data-[state=active]:bg-background"
              >
                <span className="flex flex-col gap-0.5 w-full">
                  <span className="font-medium text-sm">{cat.short_label}</span>
                  <span className="text-[11px] text-muted-foreground font-normal line-clamp-2 leading-snug">
                    {cat.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cat.local_count ?? 0} в базе
                  </span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-w-0">
            {categories.map((cat) => (
              <TabsContent key={cat.id} value={cat.id} className="mt-0">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold leading-snug">{cat.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Записей в базе: {cat.local_count ?? 0}
                          {cat.id === 'spo' && cat.local_count === 0 && (
                            <> — запустите <code className="text-xs">backend\run-parse-fgos.bat</code></>
                          )}
                          {cat.parse_hint && cat.local_count === 0 && cat.id !== 'spo' && (
                            <> — {cat.parse_hint}</>
                          )}
                        </p>
                      </div>
                      {cat.root_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={cat.root_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            classinform.ru
                          </a>
                        </Button>
                      )}
                    </div>

                    <FgosGrid
                      items={activeCategory === cat.id ? activeItems : []}
                      loading={loadingCategory === cat.id}
                      onOpen={(id) => navigate(`/fgos/${id}?section=${cat.id}`)}
                      emptyHint={
                        cat.local_count === 0
                          ? `Раздел «${cat.short_label}» пока пуст. ${cat.parse_hint || ''}`
                          : undefined
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
    </div>
  );
};

export default FgosList;
