import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Bot, Check, Copy, Globe2, Plus, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import { apiClient } from "@/api/client";
import { HarmonizationStepMatrix } from "@/app/components/HarmonizationMatrices";
import {
  GLOBAL_HARMONIZATION_STEPS,
  STATUS_LABELS_RU,
  STEP_LABELS_RU,
  type HarmonizationStepState,
  type HarmonizationVersion,
} from "@/lib/harmonization";

function asListRegistries(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

export function InternationalMappingAdminPage() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<HarmonizationVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HarmonizationVersion | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);

  const loadVersions = useCallback(async () => {
    setError(null);
    const rows = await apiClient.listHarmonizationVersions();
    setVersions(rows);
    return rows;
  }, []);

  const loadDetail = useCallback(async (id: number, step = activeStep) => {
    const row = await apiClient.getHarmonizationVersion(id);
    setDetail(row);
    const stepState = row.steps?.find((s) => s.step === step) || row.steps?.[0];
    setPayload((stepState?.payload as Record<string, unknown>) || {});
    setDirty(false);
  }, [activeStep]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadVersions(), apiClient.getHarmonizationStatus()])
      .then(([rows, status]) => {
        if (cancelled) return;
        setAiReady(Boolean(status.ai_agent?.configured));
        setSelectedId((prev) => {
          if (prev) return prev;
          if (!rows.length) return null;
          return rows.find((r) => r.ready_for_apply)?.id ?? rows[0].id;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("intl.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVersions, t]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setPayload({});
      return;
    }
    let cancelled = false;
    loadDetail(selectedId).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : t("intl.error"));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadDetail, t]);

  useEffect(() => {
    if (!detail || dirty) return;
    const step = detail.steps?.find((s) => s.step === activeStep);
    setPayload((step?.payload as Record<string, unknown>) || {});
  }, [activeStep, detail, dirty]);

  const currentStep: HarmonizationStepState | undefined = detail?.steps?.find((s) => s.step === activeStep);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await loadVersions();
      if (selectedId) await loadDetail(selectedId, activeStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("intl.error"));
    } finally {
      setBusy(false);
    }
  };

  const createVersion = () =>
    run(async () => {
      const created = await apiClient.createHarmonizationVersion({
        title: t("intl.newVersionTitle"),
      });
      setSelectedId(created.id);
    });

  const cloneVersion = () => {
    if (!selectedId) return;
    return run(async () => {
      const created = await apiClient.createHarmonizationVersion({
        title: `${detail?.title || t("intl.version")} (копия)`,
        clone_from_id: selectedId,
      });
      setSelectedId(created.id);
    });
  };

  const markReady = () => {
    if (!selectedId) return;
    return run(async () => {
      await apiClient.patchHarmonizationVersion(selectedId, { ready_for_apply: true });
    });
  };

  const saveStep = () => {
    if (!selectedId) return;
    return run(async () => {
      await apiClient.putHarmonizationStep(selectedId, activeStep, payload);
      setDirty(false);
    });
  };

  const aiDraft = () => {
    if (!selectedId) return;
    return run(async () => {
      await apiClient.aiDraftHarmonizationStep(selectedId, activeStep);
      setDirty(false);
    });
  };

  const verifyStep = () => {
    if (!selectedId) return;
    return run(async () => {
      if (dirty) {
        await apiClient.putHarmonizationStep(selectedId, activeStep, payload);
      }
      await apiClient.verifyHarmonizationStep(selectedId, activeStep);
      setDirty(false);
    });
  };

  const onPayloadChange = (next: Record<string, unknown>) => {
    setPayload(next);
    setDirty(true);
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" />
            {t("intl.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">{t("intl.lead")}</p>
          <p className="text-xs text-gray-400 mt-2">
            {aiReady ? t("intl.aiReady") : t("intl.aiNotReady")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void createVersion()} disabled={busy}>
            <Plus className="w-4 h-4 mr-1.5" />
            {t("intl.createVersion")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void cloneVersion()} disabled={busy || !selectedId}>
            <Copy className="w-4 h-4 mr-1.5" />
            {t("intl.cloneVersion")}
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 shrink-0">
          {t("intl.versions")}
        </span>
        {versions.length === 0 ? (
          <span className="text-sm text-gray-500">{t("intl.noVersions")}</span>
        ) : (
          <>
            <select
              className="form-control max-w-md flex-1 min-w-[14rem]"
              value={selectedId ?? ""}
              onChange={(e) => {
                if (dirty && !window.confirm(t("intl.unsavedLeave"))) return;
                setDirty(false);
                setSelectedId(Number(e.target.value));
              }}
            >
              {versions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.ready_for_apply ? ` — ${t("intl.ready")}` : ""}
                  {` (${GLOBAL_HARMONIZATION_STEPS.map(
                    (step) =>
                      `${step}:${STATUS_LABELS_RU[(row.steps_summary?.[String(step)] || "empty") as keyof typeof STATUS_LABELS_RU]}`,
                  ).join(" · ")})`}
                </option>
              ))}
            </select>
            {detail?.ready_for_apply ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <Star className="w-3.5 h-3.5" />
                {t("intl.ready")}
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-4">
        {!detail ? (
          <p className="text-sm text-gray-500">{t("intl.selectVersion")}</p>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                  <Input
                    className="max-w-md font-semibold"
                    value={detail.title}
                    onChange={(e) => setDetail({ ...detail, title: e.target.value })}
                    onBlur={() => {
                      if (!selectedId) return;
                      void run(async () => {
                        await apiClient.patchHarmonizationVersion(selectedId, { title: detail.title });
                      });
                    }}
                  />
                  <span className="text-xs text-gray-500">ID {detail.id} · {detail.status}</span>
                </div>
                <Button type="button" variant="outline" onClick={() => void markReady()} disabled={busy || detail.ready_for_apply}>
                  <Star className="w-4 h-4 mr-1.5" />
                  {detail.ready_for_apply ? t("intl.ready") : t("intl.markReady")}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {t("intl.passportHint")}{" "}
                <Link to="/search" className="text-primary font-semibold hover:underline">
                  {t("nav.search")}
                </Link>
                {" → "}
                {t("intl.step92")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {GLOBAL_HARMONIZATION_STEPS.map((step) => {
                const st = detail.steps?.find((s) => s.step === step)?.status || "empty";
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      if (dirty && !window.confirm(t("intl.unsavedLeave"))) return;
                      setDirty(false);
                      setActiveStep(step);
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm border ${
                      activeStep === step ? "border-primary bg-primary text-white" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {step}. {STEP_LABELS_RU[step]}
                    <span className="ml-2 opacity-80 text-xs">({STATUS_LABELS_RU[st as keyof typeof STATUS_LABELS_RU]})</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => void aiDraft()} disabled={busy}>
                  <Bot className="w-4 h-4 mr-1.5" />
                  {t("intl.aiDraft")}
                </Button>
                <Button type="button" variant="outline" onClick={() => void saveStep()} disabled={busy || !dirty}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  {t("common.save")}
                  {dirty ? " *" : ""}
                </Button>
                <Button type="button" onClick={() => void verifyStep()} disabled={busy || currentStep?.status === "verified"}>
                  <Check className="w-4 h-4 mr-1.5" />
                  {t("intl.verify")}
                </Button>
                {dirty ? <span className="text-xs text-amber-700">{t("intl.unsaved")}</span> : null}
              </div>

              <HarmonizationStepMatrix
                step={activeStep}
                payload={payload}
                onChange={onPayloadChange}
                step1Registries={
                  asListRegistries(
                    detail.steps?.find((s) => s.step === 1)?.payload?.registries,
                  )
                }
              />

              {currentStep?.ai_meta && Object.keys(currentStep.ai_meta).length > 0 ? (
                <p className="text-xs text-gray-400">
                  {t("intl.aiMeta")}: {String((currentStep.ai_meta as { mode?: string }).mode || "—")}
                  {(currentStep.ai_meta as { generated_at?: string }).generated_at
                    ? ` · ${(currentStep.ai_meta as { generated_at?: string }).generated_at}`
                    : ""}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
