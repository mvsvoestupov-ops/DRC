import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Bot, Check, Globe2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import { apiClient } from "@/api/client";
import { AutoTextarea } from "@/app/components/AutoTextarea";
import { EscoSearchPicker } from "@/app/components/EscoSearchPicker";
import {
  PURPOSE_LABELS_RU,
  STATUS_LABELS_RU,
  type HarmonizationPurpose,
  type PassportHarmonization,
} from "@/lib/harmonization";

type Props = {
  competenceId: number | null;
};

type SkillRow = {
  source_type?: string;
  source_id?: string;
  source_text?: string;
  esco_uri?: string;
  esco_title?: string;
  match?: string;
  notes?: string;
};

export function HarmonizationStep92({ competenceId }: Props) {
  const { t } = useI18n();
  const [data, setData] = useState<PassportHarmonization | null>(null);
  const [versions, setVersions] = useState<Array<{ id: number; title: string; ready_for_apply: boolean }>>([]);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!competenceId) return;
    setError(null);
    const [passport, vers] = await Promise.all([
      apiClient.getPassportHarmonization(competenceId, versionId || undefined),
      apiClient.listHarmonizationVersions(),
    ]);
    setData(passport);
    setVersions(vers.map((v) => ({ id: v.id, title: v.title, ready_for_apply: v.ready_for_apply })));
    setVersionId(passport.version_id);
  }, [competenceId, versionId]);

  useEffect(() => {
    if (!competenceId) return;
    let cancelled = false;
    setBusy(true);
    load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("intl.error"));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // initial / competence change only — version switch handled explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competenceId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("intl.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!competenceId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {t("intl.savePassportFirst")}
      </div>
    );
  }

  const rows = (Array.isArray(data?.step3?.payload?.rows) ? data!.step3.payload.rows : []) as SkillRow[];
  const step6 = (data?.step6?.payload || {}) as {
    purpose?: HarmonizationPurpose;
    depth?: string;
    requirements?: { data?: string; formats?: string; verification?: string };
  };

  const patchRows = (nextRows: SkillRow[]) => {
    if (!data) return;
    setData({
      ...data,
      step3: {
        ...data.step3,
        payload: { ...data.step3.payload, rows: nextRows },
        status: "edited",
      },
    });
  };

  const saveAll = () =>
    run(async () => {
      if (!data) return;
      await apiClient.putPassportHarmonization(competenceId, {
        version_id: versionId || data.version_id,
        step3_payload: data.step3.payload,
        step6_payload: data.step6.payload,
      });
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step92Title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("wizard.step92Lead")}</p>
        </div>
        <Link to="/admin/international-mapping" className="text-xs font-semibold text-primary hover:underline">
          {t("intl.openVersions")}
        </Link>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-3">
        <Globe2 className="w-4 h-4 text-primary" />
        <label className="text-sm text-gray-700 flex items-center gap-2">
          {t("intl.bridgeVersion")}
          <select
            className="form-control w-auto px-2 py-1 text-sm"
            value={versionId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setVersionId(id);
              void run(async () => {
                const passport = await apiClient.getPassportHarmonization(competenceId, id);
                setData(passport);
              });
            }}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
                {v.ready_for_apply ? ` — ${t("intl.ready")}` : ""}
              </option>
            ))}
          </select>
        </label>
        {data?.ai_agent?.configured ? (
          <span className="text-xs text-emerald-700">{t("intl.aiReady")}</span>
        ) : (
          <span className="text-xs text-amber-700">{t("intl.aiNotReady")}</span>
        )}
      </div>

      {/* Step 6 — purpose first (affects depth of step 3) */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">
            6. {t("intl.step6")}{" "}
            <span className="text-xs font-normal text-gray-500">
              ({STATUS_LABELS_RU[(data?.step6?.status || "empty") as keyof typeof STATUS_LABELS_RU]})
            </span>
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiClient.aiDraftPassportHarmonizationStep(competenceId, 6, {
                    version_id: versionId || undefined,
                    purpose: step6.purpose,
                  });
                })
              }
            >
              <Bot className="w-4 h-4 mr-1" />
              {t("intl.aiDraft")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiClient.verifyPassportHarmonizationStep(competenceId, 6, {
                    version_id: versionId || undefined,
                  });
                })
              }
            >
              <Check className="w-4 h-4 mr-1" />
              {t("intl.verify")}
            </Button>
          </div>
        </div>
        <select
          className="form-control max-w-md"
          value={step6.purpose || "migration"}
          onChange={(e) => {
            if (!data) return;
            const purpose = e.target.value as HarmonizationPurpose;
            setData({
              ...data,
              step6: {
                ...data.step6,
                status: "edited",
                payload: { ...data.step6.payload, purpose },
              },
            });
          }}
        >
          {(Object.keys(PURPOSE_LABELS_RU) as HarmonizationPurpose[]).map((key) => (
            <option key={key} value={key}>
              {PURPOSE_LABELS_RU[key]}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {(["data", "formats", "verification"] as const).map((field) => (
            <label key={field} className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{field}</span>
              <AutoTextarea
                className="form-control text-sm"
                minRows={3}
                maxRows={14}
                value={step6.requirements?.[field] || ""}
                onChange={(e) => {
                  if (!data) return;
                  setData({
                    ...data,
                    step6: {
                      ...data.step6,
                      status: "edited",
                      payload: {
                        ...data.step6.payload,
                        requirements: {
                          ...(typeof data.step6.payload.requirements === "object" && data.step6.payload.requirements
                            ? (data.step6.payload.requirements as Record<string, string>)
                            : {}),
                          [field]: e.target.value,
                        },
                      },
                    },
                  });
                }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Step 3 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">
            3. {t("intl.step3")}{" "}
            <span className="text-xs font-normal text-gray-500">
              ({STATUS_LABELS_RU[(data?.step3?.status || "empty") as keyof typeof STATUS_LABELS_RU]})
            </span>
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiClient.aiDraftPassportHarmonizationStep(competenceId, 3, {
                    version_id: versionId || undefined,
                    purpose: step6.purpose,
                  });
                })
              }
            >
              <Bot className="w-4 h-4 mr-1" />
              {t("intl.aiDraft")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiClient.verifyPassportHarmonizationStep(competenceId, 3, {
                    version_id: versionId || undefined,
                  });
                })
              }
            >
              <Check className="w-4 h-4 mr-1" />
              {t("intl.verify")}
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t("intl.noRows")}</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row, index) => (
              <div key={`${row.source_id || ""}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                <div className="text-sm text-gray-800">
                  <span className="text-xs uppercase text-gray-500 mr-2">{row.source_type || "item"}</span>
                  {row.source_text || "—"}
                </div>
                <EscoSearchPicker
                  kind="skill"
                  selectedTitle={row.esco_title || ""}
                  selectedUri={row.esco_uri || ""}
                  placeholder={t("wizard.escoSkillPh")}
                  onSelect={(item) => {
                    const next = [...rows];
                    next[index] = {
                      ...row,
                      esco_uri: item?.uri || "",
                      esco_title: item?.title || "",
                      match: item ? row.match || "partial" : "none",
                    };
                    patchRows(next);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    className="form-control w-auto text-sm"
                    value={row.match || "partial"}
                    onChange={(e) => {
                      const next = [...rows];
                      next[index] = { ...row, match: e.target.value };
                      patchRows(next);
                    }}
                  >
                    <option value="full">{t("intl.matchFull")}</option>
                    <option value="partial">{t("intl.matchPartial")}</option>
                    <option value="none">{t("intl.matchNone")}</option>
                  </select>
                  <input
                    className="form-control flex-1 text-sm"
                    placeholder={t("intl.notes")}
                    value={row.notes || ""}
                    onChange={(e) => {
                      const next = [...rows];
                      next[index] = { ...row, notes: e.target.value };
                      patchRows(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveAll()} disabled={busy || !data}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
