import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Bot, Check, Globe2, Link2, RefreshCw } from "lucide-react";
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

type SystemMapping = {
  system_code?: string;
  uri?: string;
  title?: string;
  match?: string;
  notes?: string;
  level_target?: string;
  rule_hint?: string;
  confidence?: string;
  source?: string;
  corpus_id?: string;
};

type SkillRow = {
  source_type?: string;
  source_id?: string;
  source_text?: string;
  esco_uri?: string;
  esco_title?: string;
  match?: string;
  notes?: string;
  systems?: Record<string, SystemMapping>;
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
    purpose?: HarmonizationPurpose | "";
    purposes?: HarmonizationPurpose[];
    depth?: string;
    target_systems?: string[];
    requirements?: { data?: string; formats?: string; verification?: string };
    bridge_snapshot?: Record<string, unknown>;
  };
  const selectedPurposes: HarmonizationPurpose[] = (() => {
    if (Array.isArray(step6.purposes) && step6.purposes.length > 0) {
      return step6.purposes.filter((p): p is HarmonizationPurpose => p in PURPOSE_LABELS_RU);
    }
    if (step6.purpose && step6.purpose in PURPOSE_LABELS_RU) {
      return [step6.purpose as HarmonizationPurpose];
    }
    return [];
  })();
  const purposeSet = new Set(selectedPurposes);
  const bridge = data?.bridge_context;
  const esco = data?.esco;
  const bridgeSystems = Array.isArray(bridge?.systems) ? bridge!.systems! : [];
  const selectedSystems = Array.isArray(step6.target_systems) ? step6.target_systems : [];
  const selectedSet = new Set(selectedSystems);
  const eqf = bridge?.level_bridge?.eqf;
  const isced =
    bridge?.education_bridge && typeof bridge.education_bridge === "object"
      ? String((bridge.education_bridge as { isced?: string }).isced || "")
      : "";
  const escoRules =
    selectedSet.has("ESCO") || selectedSystems.some((c) => c.toUpperCase() === "ESCO")
      ? bridge?.component_rules_esco || {}
      : {};

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

  const patchStep6 = (patch: Record<string, unknown>) => {
    if (!data) return;
    setData({
      ...data,
      step6: {
        ...data.step6,
        status: "edited",
        payload: { ...data.step6.payload, ...patch },
      },
    });
  };

  const setTargetSystems = (codes: string[]) => {
    const allowed = new Set(bridgeSystems.map((s) => s.code));
    patchStep6({ target_systems: codes.filter((c) => allowed.has(c)) });
  };

  const toggleSystem = (code: string) => {
    if (selectedSet.has(code)) {
      setTargetSystems(selectedSystems.filter((c) => c !== code));
    } else {
      setTargetSystems([...selectedSystems, code]);
    }
  };

  const setPurposes = (next: HarmonizationPurpose[]) => {
    const order = Object.keys(PURPOSE_LABELS_RU) as HarmonizationPurpose[];
    const sorted = order.filter((p) => next.includes(p));
    patchStep6({
      purposes: sorted,
      purpose: sorted[0] || "",
    });
  };

  const togglePurpose = (code: HarmonizationPurpose) => {
    if (purposeSet.has(code)) {
      setPurposes(selectedPurposes.filter((p) => p !== code));
    } else {
      setPurposes([...selectedPurposes, code]);
    }
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

  const statusLabel = (status: string | undefined) =>
    STATUS_LABELS_RU[(status || "empty") as keyof typeof STATUS_LABELS_RU];

  return (
    <div className="space-y-8 pb-20">
      <header className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step92Title")}</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">{t("wizard.step92Lead")}</p>
          </div>
          <Link
            to="/admin/international-mapping"
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            {t("intl.openVersions")}
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <Globe2 className="w-4 h-4 text-slate-600" />
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
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
              {t("intl.aiReady")}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
              {t("intl.aiNotReady")}
            </span>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {/* 1. Bridge + systems */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 border-l-slate-500">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                1
              </span>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-600" />
                {t("intl.bridgePanel")}
              </h3>
            </div>
            <p className="mt-1 text-xs text-gray-600 max-w-2xl pl-9">{t("intl.bridgePanelHint")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy || !versionId || selectedSystems.length === 0}
            onClick={() =>
              void run(async () => {
                await apiClient.applyPassportBridge(competenceId, {
                  version_id: versionId || undefined,
                  target_systems: selectedSystems,
                });
              })
            }
          >
            {t("intl.applyBridge")}
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {bridge?.version_title || t("intl.bridgeVersion")}
              </div>
              <div className={bridge?.ready_for_apply ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                {bridge?.ready_for_apply ? t("intl.bridgeReady") : t("intl.bridgeNotReady")}
              </div>
              <div className="h-px bg-slate-200 my-2" />
              <div className="text-gray-700">
                {t("intl.bridgeEqf")}:{" "}
                <span className="font-medium">{eqf != null && eqf !== "" ? String(eqf) : "—"}</span>
              </div>
              <div className="text-gray-700">
                {t("intl.bridgeIsced")}: <span className="font-medium">{isced || "—"}</span>
              </div>
              {Object.keys(escoRules).length > 0 ? (
                <div className="pt-2 border-t border-slate-200 mt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {t("intl.bridgeEscoRules")}
                  </div>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    {Object.entries(escoRules).map(([comp, rule]) => (
                      <li key={comp}>
                        <span className="font-semibold">{comp}</span>: {rule || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {step6.bridge_snapshot ? (
                <div className="text-xs text-emerald-700 pt-2 font-medium">✓ {t("intl.bridgeApplied")}</div>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("intl.escoLocal")}
              </div>
              {esco?.local_ready ? (
                <div className="text-emerald-800 font-medium">
                  {t("intl.escoLocalReady")
                    .replace("{occ}", String(esco.occupations ?? 0))
                    .replace("{skills}", String(esco.skills ?? 0))}
                </div>
              ) : (
                <div className="text-amber-800 text-xs leading-relaxed">{t("intl.escoLocalEmpty")}</div>
              )}
              <div className="h-px bg-slate-200 my-2" />
              <div className="text-xs text-gray-600">
                {t("intl.escoSource")}: {esco?.source || "—"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{t("intl.targetSystems")}</div>
                <p className="text-xs text-gray-600 mt-0.5">{t("intl.targetSystemsHint")}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {t("intl.targetSystemsSelected")
                  .replace("{n}", String(selectedSystems.length))
                  .replace("{total}", String(bridgeSystems.length))}
              </div>
            </div>
            {bridgeSystems.length === 0 ? (
              <p className="text-sm text-amber-800">{t("intl.noSystemsInBridge")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setTargetSystems(bridgeSystems.map((s) => s.code))}
                  >
                    {t("intl.selectAllSystems")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const escoCode = bridgeSystems.find((s) => s.code.toUpperCase() === "ESCO")?.code;
                      setTargetSystems(escoCode ? [escoCode] : []);
                    }}
                  >
                    {t("intl.selectEscoOnly")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy || selectedSystems.length === 0}
                    onClick={() => setTargetSystems([])}
                  >
                    {t("intl.clearSystems")}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/40 p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bridgeSystems.map((sys) => {
                    const checked = selectedSet.has(sys.code);
                    return (
                      <label
                        key={sys.code}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                          checked
                            ? "border-slate-400 bg-white shadow-sm text-gray-900"
                            : "border-transparent bg-transparent text-gray-700 hover:border-slate-200 hover:bg-white/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleSystem(sys.code)}
                        />
                        <span className="min-w-0">
                          <span className="font-semibold">{sys.code}</span>
                          <span className="block truncate text-gray-600">{sys.name}</span>
                          {sys.region ? (
                            <span className="block truncate text-gray-400">{sys.region}</span>
                          ) : null}
                          {sys.level_target ? (
                            <span className="block text-slate-700">
                              {t("intl.levelTargetShort")}: {sys.level_target}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Step 6 — purpose */}
      <section className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm border-l-4 border-l-sky-500">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
              2
            </span>
            <div>
              <h3 className="font-semibold text-gray-900">
                6. {t("intl.step6")}
              </h3>
              <p className="text-xs text-sky-800/80">{statusLabel(data?.step6?.status)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedPurposes.length === 0}
              onClick={() =>
                void run(async () => {
                  await apiClient.aiDraftPassportHarmonizationStep(competenceId, 6, {
                    version_id: versionId || undefined,
                    purposes: selectedPurposes,
                    purpose: selectedPurposes[0],
                    depth: step6.depth,
                    target_systems: selectedSystems,
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
              disabled={busy || selectedPurposes.length === 0}
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

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <p className="text-xs text-gray-600">{t("intl.purposesHint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(PURPOSE_LABELS_RU) as HarmonizationPurpose[]).map((key) => {
                const checked = purposeSet.has(key);
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer ${
                      checked
                        ? "border-sky-400 bg-sky-50 text-gray-900 shadow-sm"
                        : "border-gray-200 bg-gray-50/60 text-gray-700 hover:border-sky-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={busy}
                      onChange={() => togglePurpose(key)}
                    />
                    <span>{PURPOSE_LABELS_RU[key]}</span>
                  </label>
                );
              })}
            </div>
            {selectedPurposes.length === 0 ? (
              <p className="text-xs text-amber-700">{t("intl.purposesNone")}</p>
            ) : null}
            <label className="text-sm text-gray-700 flex items-center gap-2 pt-2">
              {t("intl.depth")}
              <select
                className="form-control w-auto"
                value={step6.depth || "medium"}
                onChange={(e) => patchStep6({ depth: e.target.value })}
              >
                <option value="low">{t("intl.depthLow")}</option>
                <option value="medium">{t("intl.depthMedium")}</option>
                <option value="high">{t("intl.depthHigh")}</option>
              </select>
            </label>
          </div>

          <div className="border-t border-sky-100 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800/70 mb-2">
              requirements
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {(["data", "formats", "verification"] as const).map((field) => (
                <label
                  key={field}
                  className="space-y-1 rounded-lg border border-sky-100 bg-sky-50/30 p-3"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-800/70">
                    {field}
                  </span>
                  <AutoTextarea
                    className="form-control text-sm bg-white"
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
                              ...(typeof data.step6.payload.requirements === "object" &&
                              data.step6.payload.requirements
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
          </div>
        </div>
      </section>

      {/* 3. Step 3 — multi-system mapping */}
      <section className="overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm border-l-4 border-l-teal-600">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 bg-teal-50/80 px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                3
              </span>
              <div>
                <h3 className="font-semibold text-gray-900">3. {t("intl.step3")}</h3>
                <p className="text-xs text-teal-900/70">{statusLabel(data?.step3?.status)}</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-teal-900/70 max-w-2xl pl-9">{t("intl.step3SystemsHint")}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedSystems.length === 0}
              onClick={() =>
                void run(async () => {
                  await apiClient.aiDraftPassportHarmonizationStep(competenceId, 3, {
                    version_id: versionId || undefined,
                    purposes: selectedPurposes,
                    purpose: selectedPurposes[0],
                    depth: step6.depth,
                    target_systems: selectedSystems,
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
              disabled={busy || selectedSystems.length === 0}
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

        <div className="p-5">
          {selectedSystems.length === 0 ? (
            <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              {t("intl.needSystemsForStep3")}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
              {t("intl.noRows")}
            </p>
          ) : (
            <div className="space-y-5">
              {rows.map((row, index) => {
                const rowSystems = (
                  row.systems && typeof row.systems === "object" ? row.systems : {}
                ) as Record<string, SystemMapping>;
                const codesForRow =
                  selectedSystems.length > 0 ? selectedSystems : Object.keys(rowSystems);

                const patchSystem = (code: string, patch: Partial<SystemMapping>) => {
                  const next = [...rows];
                  const systems = { ...(next[index].systems || {}) };
                  const prev = systems[code] || { system_code: code };
                  const updated = { ...prev, ...patch, system_code: code };
                  systems[code] = updated;
                  const nextRow: SkillRow = { ...row, systems };
                  if (code.toUpperCase() === "ESCO") {
                    nextRow.esco_uri = updated.uri || "";
                    nextRow.esco_title = updated.title || "";
                    nextRow.match = updated.match || "partial";
                  }
                  next[index] = nextRow;
                  patchRows(next);
                };

                return (
                  <article
                    key={`${row.source_id || ""}-${index}`}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-teal-100 bg-teal-50/40 px-4 py-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="rounded bg-teal-700/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {row.source_type || "item"}
                        </span>
                        {row.source_id ? (
                          <span className="text-[11px] font-mono text-teal-900/60">{row.source_id}</span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-gray-900 leading-snug">
                        {row.source_text || "—"}
                      </p>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {codesForRow.map((code) => {
                        const slot = rowSystems[code] || {
                          system_code: code,
                          uri: code.toUpperCase() === "ESCO" ? row.esco_uri : "",
                          title: code.toUpperCase() === "ESCO" ? row.esco_title : "",
                          match: row.match || "partial",
                          notes: "",
                          level_target:
                            bridgeSystems.find((s) => s.code === code)?.level_target || "",
                        };
                        const isEsco = code.toUpperCase() === "ESCO";
                        const sysMeta = bridgeSystems.find((s) => s.code === code);
                        const conf = (slot.confidence || "").toLowerCase();
                        const confClass =
                          conf === "high"
                            ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
                            : conf === "medium"
                              ? "bg-amber-100 text-amber-900 ring-amber-200"
                              : conf === "low"
                                ? "bg-rose-100 text-rose-900 ring-rose-200"
                                : "bg-gray-100 text-gray-600 ring-gray-200";
                        const confLabel =
                          conf === "high"
                            ? t("intl.confidenceHigh")
                            : conf === "medium"
                              ? t("intl.confidenceMedium")
                              : conf === "low"
                                ? t("intl.confidenceLow")
                                : t("intl.confidenceNone");
                        return (
                          <div
                            key={code}
                            className={`px-4 py-3.5 space-y-2.5 border-l-4 ${
                              isEsco
                                ? "border-l-emerald-500 bg-emerald-50/20"
                                : "border-l-amber-400 bg-amber-50/15"
                            }`}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div className="text-sm font-semibold text-gray-900">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold mr-1.5 ${
                                    isEsco
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {code}
                                </span>
                                {sysMeta?.name && sysMeta.name !== code ? (
                                  <span className="font-normal text-gray-500">{sysMeta.name}</span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${confClass}`}
                                  title={t("intl.mappingConfidence")}
                                >
                                  {t("intl.mappingConfidence")}: {confLabel}
                                </span>
                                {(slot.level_target || sysMeta?.level_target) && (
                                  <div className="text-xs font-medium text-gray-600 rounded-full bg-white/80 px-2 py-0.5 ring-1 ring-gray-200">
                                    {t("intl.levelFromBridge")}:{" "}
                                    {slot.level_target || sysMeta?.level_target}
                                  </div>
                                )}
                              </div>
                            </div>
                            {slot.rule_hint ? (
                              <div className="text-xs text-gray-500 rounded border border-dashed border-gray-200 bg-white/60 px-2 py-1">
                                {t("intl.ruleFromBridge")}: {slot.rule_hint}
                              </div>
                            ) : null}

                            {isEsco ? (
                              <EscoSearchPicker
                                kind="skill"
                                selectedTitle={slot.title || row.esco_title || ""}
                                selectedUri={slot.uri || row.esco_uri || ""}
                                placeholder={t("wizard.escoSkillPh")}
                                onSelect={(item) => {
                                  patchSystem(code, {
                                    uri: item?.uri || "",
                                    title: item?.title || "",
                                    match: item ? slot.match || "partial" : "none",
                                    confidence: item ? slot.confidence || "medium" : "",
                                    source: item?.uri || slot.source || "",
                                  });
                                }}
                              />
                            ) : (
                              <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  {t("intl.systemAnalogue")}
                                </span>
                                <input
                                  className="form-control text-sm bg-white"
                                  placeholder={t("intl.systemAnaloguePh")}
                                  value={slot.title || ""}
                                  onChange={(e) => patchSystem(code, { title: e.target.value })}
                                />
                              </label>
                            )}

                            <label className="block space-y-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t("intl.mappingSource")}
                              </span>
                              <input
                                className="form-control text-sm bg-white"
                                placeholder={t("intl.mappingSourcePh")}
                                value={slot.source || ""}
                                onChange={(e) => patchSystem(code, { source: e.target.value })}
                              />
                            </label>

                            <div className="flex flex-wrap gap-2">
                              <select
                                className="form-control w-auto text-sm bg-white"
                                value={slot.match || "partial"}
                                onChange={(e) => patchSystem(code, { match: e.target.value })}
                              >
                                <option value="full">{t("intl.matchFull")}</option>
                                <option value="partial">{t("intl.matchPartial")}</option>
                                <option value="none">{t("intl.matchNone")}</option>
                              </select>
                              <select
                                className="form-control w-auto text-sm bg-white"
                                value={conf || ""}
                                onChange={(e) => patchSystem(code, { confidence: e.target.value })}
                                title={t("intl.mappingConfidence")}
                              >
                                <option value="">{t("intl.confidenceNone")}</option>
                                <option value="high">{t("intl.confidenceHigh")}</option>
                                <option value="medium">{t("intl.confidenceMedium")}</option>
                                <option value="low">{t("intl.confidenceLow")}</option>
                              </select>
                              <input
                                className="form-control flex-1 text-sm bg-white"
                                placeholder={t("intl.notes")}
                                value={slot.notes || ""}
                                onChange={(e) => patchSystem(code, { notes: e.target.value })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-[2400px] px-4 py-3 flex justify-end">
          <Button type="button" onClick={() => void saveAll()} disabled={busy || !data}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
