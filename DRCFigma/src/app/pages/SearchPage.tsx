import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Filter, X, Download } from "lucide-react";
import { competencies, industries } from "../data/competencies";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialIndustry = searchParams.get("industry") || "";

  const [filters, setFilters] = useState({
    industry: initialIndustry,
    status: [] as string[],
    educationLevel: "",
    search: ""
  });

  const statusOptions = [
    { value: "active", label: "Действует", color: "#10B981" },
    { value: "draft", label: "Проект", color: "#6B7280" },
    { value: "review", label: "На экспертизе", color: "#F59E0B" },
    { value: "archived", label: "Архив", color: "#64748B" }
  ];

  const educationLevels = ["Бакалавриат", "Магистратура", "СПО", "ДПО"];

  const filteredCompetencies = competencies.filter((comp) => {
    if (filters.industry && comp.industry !== filters.industry) return false;
    if (filters.status.length > 0 && !filters.status.includes(comp.status)) return false;
    if (filters.educationLevel && comp.educationLevel !== filters.educationLevel) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        comp.id.toLowerCase().includes(searchLower) ||
        comp.title.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const toggleStatus = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status]
    }));
  };

  const clearFilters = () => {
    setFilters({
      industry: "",
      status: [],
      educationLevel: "",
      search: ""
    });
  };

  const activeFiltersCount = [
    filters.industry,
    ...filters.status,
    filters.educationLevel
  ].filter(Boolean).length;

  const statusColors = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    draft: "bg-gray-50 text-gray-700 border-gray-200",
    review: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-slate-50 text-slate-700 border-slate-200"
  };

  const statusLabels = {
    active: "Действует",
    draft: "Проект",
    review: "На экспертизе",
    archived: "Архив"
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="max-w-[1440px] mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
            Поиск компетенций
          </h1>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '16px', color: '#6B7280' }}>
              Найдено компетенций: <strong style={{ color: '#111827' }}>{filteredCompetencies.length}</strong>
            </p>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: 'white',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}
              className="hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Экспорт результатов
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-80 flex-shrink-0">
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '24px',
              position: 'sticky',
              top: '24px'
            }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Filter className="w-5 h-5" style={{ color: '#374151' }} />
                  <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                    Фильтры
                  </h2>
                  {activeFiltersCount > 0 && (
                    <span style={{
                      backgroundColor: '#EFF6FF',
                      color: '#3B82F6',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: '600'
                    }}>
                      {activeFiltersCount}
                    </span>
                  )}
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    style={{ fontSize: '13px', color: '#3B82F6', fontWeight: '500' }}
                    className="hover:underline"
                  >
                    Очистить
                  </button>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Отрасль
                  </label>
                  <select
                    value={filters.industry}
                    onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                    className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Все отрасли</option>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Статус
                  </label>
                  <div className="space-y-3">
                    {statusOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(option.value)}
                          onChange={() => toggleStatus(option.value)}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: '2px solid #D1D5DB',
                            accentColor: option.color
                          }}
                        />
                        <span style={{ fontSize: '14px', color: '#374151' }}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Уровень образования
                  </label>
                  <select
                    value={filters.educationLevel}
                    onChange={(e) => setFilters({ ...filters, educationLevel: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                    className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Все уровни</option>
                    {educationLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Поиск по тексту
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Название или ID..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="flex-1">
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              overflow: 'hidden'
            }}>
              <table className="min-w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      ID
                    </th>
                    <th style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Название
                    </th>
                    <th style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Статус
                    </th>
                    <th style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Версия
                    </th>
                    <th style={{
                      padding: '16px 24px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Разработчик
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetencies.map((competency, index) => (
                    <tr
                      key={competency.id}
                      style={{
                        borderBottom: index < filteredCompetencies.length - 1 ? '1px solid #F3F4F6' : 'none'
                      }}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td style={{ padding: '20px 24px' }}>
                        <Link
                          to={`/competency/${competency.id}`}
                          style={{
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            color: '#3B82F6',
                            fontWeight: '600'
                          }}
                          className="hover:underline"
                        >
                          {competency.id}
                        </Link>
                      </td>
                      <td style={{ padding: '20px 24px', maxWidth: '400px' }}>
                        <Link
                          to={`/competency/${competency.id}`}
                          style={{
                            fontSize: '14px',
                            color: '#111827',
                            fontWeight: '500',
                            display: '-webkit-box',
                            WebkitLineClamp: '2',
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {competency.title}
                        </Link>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          fontWeight: '500'
                        }} className={statusColors[competency.status]}>
                          {statusLabels[competency.status]}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px', fontSize: '14px', color: '#6B7280' }}>
                        {competency.version}
                      </td>
                      <td style={{ padding: '20px 24px', fontSize: '14px', color: '#6B7280' }}>
                        {competency.developer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCompetencies.length === 0 && (
                <div className="text-center py-16">
                  <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <Filter className="w-8 h-8" style={{ color: '#9CA3AF' }} />
                  </div>
                  <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '16px' }}>
                    Компетенции не найдены
                  </p>
                  <button
                    onClick={clearFilters}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    className="hover:bg-blue-700 transition-colors"
                  >
                    Очистить фильтры
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
