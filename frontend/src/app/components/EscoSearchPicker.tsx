import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/api/client";
import type { EscoConcept } from "@/api/types";
import { useI18n } from "@/context/I18nContext";

type Kind = "occupation" | "skill";

type Props = {
  kind: Kind;
  selectedTitle?: string;
  selectedUri?: string;
  iscoHint?: string;
  occupationUri?: string;
  placeholder?: string;
  onSelect: (item: EscoConcept | null) => void;
};

function portalUrl(item: EscoConcept) {
  const encoded = encodeURIComponent(item.uri);
  return item.kind === "occupation" || item.isco
    ? `https://esco.ec.europa.eu/en/classification/occupation?uri=${encoded}`
    : `https://esco.ec.europa.eu/en/classification/skill?uri=${encoded}`;
}

export function EscoSearchPicker({
  kind,
  selectedTitle,
  selectedUri,
  iscoHint,
  occupationUri,
  placeholder,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EscoConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected =
    selectedUri || selectedTitle
      ? { uri: selectedUri || "", title: selectedTitle || selectedUri || "", kind }
      : null;

  useEffect(() => {
    if (selectedUri || selectedTitle) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    const canSearch = kind === "occupation" ? q.length >= 2 || Boolean(iscoHint) : q.length >= 2 || Boolean(occupationUri);
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data =
          kind === "occupation"
            ? await apiClient.searchEscoOccupations(
                { q, isco: iscoHint, limit: 20 },
                { signal: controller.signal },
              )
            : await apiClient.searchEscoSkills(
                { q, occupation_uri: occupationUri, limit: 30 },
                { signal: controller.signal },
              );
        if (cancelled) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (err: unknown) {
        if (cancelled) return;
        const aborted = err instanceof DOMException && err.name === "AbortError";
        setResults([]);
        setError(aborted ? "" : err instanceof Error ? err.message : t("wizard.escoError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, kind, iscoHint, occupationUri, selectedUri, selectedTitle, t]);

  if (selected) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{selected.title}</p>
          {selected.uri ? (
            <a
              href={portalUrl(selected)}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline break-all"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              ESCO
            </a>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0" onClick={() => onSelect(null)}>
          {t("wizard.escoChange")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-10"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={t("wizard.escoClear")}
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t("wizard.escoSearching")}</span>
          </div>
        ) : results.length === 0 ? (
          <p className="text-xs text-gray-500 px-3 py-4 text-center">
            {kind === "occupation" && iscoHint && !query
              ? t("wizard.escoByIsco", { code: iscoHint })
              : t("wizard.escoHint")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {results.map((item) => (
              <li key={item.uri}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {[item.isco ? `ISCO ${item.isco}` : "", item.code, item.relation, item.skill_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
