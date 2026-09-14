import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Search, Filter } from 'lucide-react';
import { getQualifications } from '../api';

const QualificationsList = () => {
  const [allQualifications, setAllQualifications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const navigate = useNavigate();

  useEffect(() => {
    getQualifications()
      .then(res => {
        setAllQualifications(res.data);
        setFiltered(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = allQualifications;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(q =>
        q.name?.toLowerCase().includes(lower) ||
        q.code?.toLowerCase().includes(lower) ||
        q.prof_standard_name?.toLowerCase().includes(lower)
      );
    }
    if (levelFilter && levelFilter !== 'all') {
      result = result.filter(q => q.level === levelFilter);
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [searchText, levelFilter, allQualifications]);

  const handleCardClick = (id) => {
    navigate(`/qualifications/${id}`);
  };

  const levels = [...new Set(allQualifications.map(q => q.level).filter(Boolean))];

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium">Сведения о квалификациях</h2>
        <p className="text-muted-foreground text-sm mt-1">Найдите квалификацию по названию, коду или профессиональному стандарту</p>
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
        <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Уровень квалификации" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все уровни</SelectItem>
            {levels.map(lv => (
              <SelectItem key={lv} value={lv}>{lv}</SelectItem>
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
            {paginated.map(q => (
              <Card
                key={q.id}
                className="hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => handleCardClick(q.id)}
              >
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">{q.code}</code>
                    {q.level && <Badge variant="secondary">{q.level}</Badge>}
                  </div>
                  <h4 className="font-medium text-sm line-clamp-2">{q.name}</h4>
                  {q.prof_standard_name && (
                    <div className="text-xs text-muted-foreground mt-auto">
                      ПС: {q.prof_standard_name.slice(0, 40)}...
                    </div>
                  )}
                  {q.activity_area && (
                    <div className="text-xs text-muted-foreground">{q.activity_area}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage(p => p + 1)}
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
