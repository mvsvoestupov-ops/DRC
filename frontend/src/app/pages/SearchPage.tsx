import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Filter, Download } from "lucide-react";
import { apiClient } from "@/api/client";
import type { Competence } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { useI18n } from "@/context/I18nContext";
import { translateAreaName } from "@/i18n/helpers";
import {
  PROFESSIONAL_AREAS,
  areaDisplayCode,
  findProfessionalArea,
  competenceMatchesArea,
} from "@/lib/professionalAreas";
import {
  toListItem,
  statusColors,
  type CompetenceListItem,
  type UiStatus,
} from "@/lib/competenceMappers";

export function SearchPage() {
  const { t } = useI18n();
  const parseStatusParam = (raw: string | null): UiStatus[] => {
    if (!raw) return [];
    return raw.split(",").filter((s): s is UiStatus =>
      ["active", "draft", "review", "archived"].includes(s)
    );
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const initialArea = searchParams.get("area") || "";
  const initialQuery = searchParams.get("q") || "";
  const initialStatus = parseStatusParam(searchParams.get("status"));

  const [competencies, setCompetencies] = useState<CompetenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    area: initialArea,
    status: initialStatus,
    educationLevel: "",
    search: initialQuery,
  });

  const statusOptions: { value: UiStatus; label: string; color: string }[] = [
    { value: "active", label: t("status.active"), color: "#10B981" },
    { value: "draft", label: t("status.draft"), color: "#6B7280" },
    { value: "review", label: t("status.review"), color: "#F59E0B" },
    { value: "archived", label: t("status.archived"), color: "#64748B" },
  ];

  const educationLevels = [
    t("searchPage.levelBachelor"),
    t("searchPage.levelMaster"),
    t("searchPage.levelSpo"),
    t("searchPage.levelDpo"),
  ];

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      area: searchParams.get("area") || "",
      status: parseStatusParam(searchParams.get("status")),
      search: searchParams.get("q") || "",
    }));
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient.getPublicCompetences()
      .then((data) => {
        setCompetencies((data as Competence[]).map(toListItem));
      })
      .catch(() => setError(t("searchPage.error")))
      .finally(() => setLoading(false));
  }, []);

  const selectedArea = findProfessionalArea(filters.area);
  const filteredCompetencies = competencies.filter((comp) => {
    if (filters.area && !competenceMatchesArea(comp, filters.area)) return false;
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
    setFilters({ area: "", status: [], educationLevel: "", search: "" });
    setSearchParams({});
  };

  const activeFiltersCount = [filters.area, ...filters.status, filters.educationLevel].filter(Boolean).length;

  return (
    <PageShell>
      <PageHeader
        title={t("searchPage.title")}
        description={
          <>
            {selectedArea ? (
              <>
                {t("searchPage.foundInArea", {
                  code: areaDisplayCode(selectedArea),
                  name: translateAreaName(t, selectedArea.code, selectedArea.name),
                })}{" "}
              </>
            ) : (
              <>{t("searchPage.found")} </>
            )}
            <strong className="text-gray-900">{filteredCompetencies.length}</strong>
          </>
        }
        actions={
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t("searchPage.export")}
          </Button>
        }
      />
      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="surface-padded sticky top-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">{t("searchPage.filters")}</h2>
                {activeFiltersCount > 0 && (
                  <span className="bg-secondary text-primary text-sm px-2 py-0.5 rounded-full font-semibold">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-base text-primary font-medium hover:underline">
                  {t("searchPage.clear")}
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">
                  {t("searchPage.area")}
                </label>
                <select
                  value={filters.area}
                  onChange={(e) => {
                    const area = e.target.value;
                    setFilters({ ...filters, area });
                    const next = new URLSearchParams(searchParams);
                    if (area) next.set("area", area);
                    else next.delete("area");
                    setSearchParams(next, { replace: true });
                  }}
                  className="form-control"
                >
                  <option value="">{t("searchPage.allAreas")}</option>
                  {PROFESSIONAL_AREAS.map((area) => (
                    <option key={area.code} value={area.code}>
                      {areaDisplayCode(area)} — {translateAreaName(t, area.code, area.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">{t("searchPage.status")}</label>
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
                      <span className="text-base text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">{t("searchPage.educationLevel")}</label>
                <select
                  value={filters.educationLevel}
                  onChange={(e) => setFilters({ ...filters, educationLevel: e.target.value })}
                  className="form-control"
                >
                  <option value="">{t("searchPage.allLevels")}</option>
                  {educationLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">{t("searchPage.textSearch")}</label>
                <Input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder={t("searchPage.textPlaceholder")}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
            <div className="surface overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-gray-500">{t("home.loading")}</div>
            ) : (
              <>
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      {[
                        t("searchPage.colId"),
                        t("searchPage.colName"),
                        t("searchPage.colStatus"),
                        t("searchPage.colVersion"),
                        t("searchPage.colDeveloper"),
                      ].map((head) => (
                        <th key={head}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetencies.map((competency) => (
                      <tr key={competency.id} className="cursor-pointer">
                        <td>
                          <Link to={`/competency/${competency.id}`} className="text-base font-mono text-primary font-semibold hover:underline whitespace-nowrap">
                            {competency.displayId}
                          </Link>
                        </td>
                        <td className="max-w-[400px]">
                          <Link to={`/competency/${competency.id}`} className="text-base text-gray-900 font-medium hover:text-primary transition-colors line-clamp-2">
                            {competency.title}
                          </Link>
                        </td>
                        <td>
                          <span className={`status-pill ${statusColors[competency.status]}`}>
                            {t(`status.${competency.status}`)}
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
                    <p className="text-base text-gray-500 mb-4">{t("searchPage.notFound")}</p>
                    <Button onClick={clearFilters}>
                      {t("searchPage.clearFilters")}
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
