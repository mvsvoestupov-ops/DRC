import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Filter, Download } from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  toListItem,
  statusColors,
  statusLabels,
  defaultIndustries,
  type CompetenceListItem,
  type UiStatus,
} from "@/lib/competenceMappers";

export function SearchPage() {
  const parseStatusParam = (raw: string | null): UiStatus[] => {
    if (!raw) return [];
    return raw.split(",").filter((s): s is UiStatus =>
      ["active", "draft", "review", "archived"].includes(s)
    );
  };

  const [searchParams] = useSearchParams();
  const initialIndustry = searchParams.get("industry") || "";
  const initialQuery = searchParams.get("q") || "";
  const initialStatus = parseStatusParam(searchParams.get("status"));

  const [competencies, setCompetencies] = useState<CompetenceListItem[]>([]);
  const [industries, setIndustries] = useState<string[]>(defaultIndustries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    industry: initialIndustry,
    status: initialStatus,
    educationLevel: "",
    search: initialQuery,
  });

  const statusOptions: { value: UiStatus; label: string; color: string }[] = [
    { value: "active", label: "Действует", color: "#10B981" },
    { value: "draft", label: "Проект", color: "#6B7280" },
    { value: "review", label: "На экспертизе", color: "#F59E0B" },
    { value: "archived", label: "Архив", color: "#64748B" },
  ];

  const educationLevels = ["Бакалавриат", "Магистратура", "СПО", "ДПО"];

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      industry: searchParams.get("industry") || "",
      status: parseStatusParam(searchParams.get("status")),
      search: searchParams.get("q") || "",
    }));
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient.getPublicCompetences()
      .then((data) => {
        const items = (data as Competence[]).map(toListItem);
        setCompetencies(items);
        const fromApi = [...new Set(items.map((c) => c.industry).filter((i) => i && i !== "—"))];
        if (fromApi.length > 0) {
          setIndustries([...new Set([...fromApi, ...defaultIndustries])]);
        }
      })
      .catch(() => setError("Не удалось загрузить компетенции. Проверьте, что сервер API запущен."))
      .finally(() => setLoading(false));
  }, []);

  const filteredCompetencies = competencies.filter((comp) => {
    if (filters.industry && comp.industry !== filters.industry) return false;
    if (filters.status.length > 0 && !filters.status.includes(comp.status)) return false;
    if (filters.educationLevel && comp.educationLevel !== filters.educationLevel) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        comp.displayId.toLowerCase().includes(searchLower) ||
        comp.title.toLowerCase().includes(searchLower) ||
        String(comp.id).includes(searchLower)
      );
    }
    return true;
  });

  const toggleStatus = (status: UiStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  };

  const clearFilters = () => {
    setFilters({ industry: "", status: [], educationLevel: "", search: "" });
  };

  const activeFiltersCount = [filters.industry, ...filters.status, filters.educationLevel].filter(Boolean).length;

  return (
    <PageShell>
      <PageHeader
        title="Поиск компетенций"
        description={
          <>
            Найдено компетенций:{" "}
            <strong className="text-gray-900">{filteredCompetencies.length}</strong>
          </>
        }
        actions={
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Экспорт результатов
          </Button>
        }
      />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0">
          <div className="surface-padded sticky top-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
                {activeFiltersCount > 0 && (
                  <span className="bg-secondary text-primary text-xs px-2 py-0.5 rounded-full font-semibold">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-primary font-medium hover:underline">
                  Очистить
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Отрасль</label>
                <select
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                  className="form-control"
                >
                  <option value="">Все отрасли</option>
                  {industries.map((industry) => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                <div className="space-y-3">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(option.value)}
                        onChange={() => toggleStatus(option.value)}
                        className="w-4.5 h-4.5 rounded border-2 border-gray-300 text-primary focus:ring-primary"
                        style={{ accentColor: option.color }}
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Уровень образования</label>
                <select
                  value={filters.educationLevel}
                  onChange={(e) => setFilters({ ...filters, educationLevel: e.target.value })}
                  className="form-control"
                >
                  <option value="">Все уровни</option>
                  {educationLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Поиск по тексту</label>
                <Input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Название или ID..."
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="surface overflow-hidden">
            {loading ? (
              <div className="text-center py-16 text-gray-500">Загрузка...</div>
            ) : (
              <>
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      {["ID", "Название", "Статус", "Версия", "Разработчик"].map((head) => (
                        <th key={head}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetencies.map((competency) => (
                      <tr key={competency.id} className="cursor-pointer">
                        <td>
                          <Link to={`/competency/${competency.id}`} className="text-sm font-mono text-primary font-semibold hover:underline">
                            {competency.displayId}
                          </Link>
                        </td>
                        <td className="max-w-[400px]">
                          <Link to={`/competency/${competency.id}`} className="text-sm text-gray-900 font-medium hover:text-primary transition-colors line-clamp-2">
                            {competency.title}
                          </Link>
                        </td>
                        <td>
                          <span className={`status-pill ${statusColors[competency.status]}`}>
                            {statusLabels[competency.status]}
                          </span>
                        </td>
                        <td className="text-gray-500">{competency.version}</td>
                        <td className="text-gray-500">{competency.developer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredCompetencies.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Filter className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-base text-gray-500 mb-4">Компетенции не найдены</p>
                    <Button onClick={clearFilters}>
                      Очистить фильтры
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
