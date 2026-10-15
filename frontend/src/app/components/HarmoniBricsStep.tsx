import { useEffect, useState } from "react";
import { Bot, Check, Globe2, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import { apiClient } from "@/api/client";
import {
  HARMONI_RELATION_TYPES,
  MOBILITY_REGIMES,
  type HarmoniBricsCountry,
  type HarmoniBricsMapping,
  type HarmoniConfidence,
  type HarmoniRelationType,
  type MobilityRegime,
} from "@/lib/harmoniBrics";

type Props = {
  value: HarmoniBricsMapping;
  onChange: (next: HarmoniBricsMapping) => void;
  onAskAssistant: () => Promise<void>;
  assistantBusy?: boolean;
  assistantError?: string | null;
  aiAgentConfigured?: boolean | null;
};

const TYPE_RU: Record<HarmoniRelationType, string> = {
  equivalent: "эквивалент",
  broader: "шире",
  narrower: "уже",
  related: "смежный",
  none: "нет соответствия",
};

const REGIME_RU: Record<MobilityRegime, string> = {
  notify: "уведомительный допуск",
  adapt: "допуск с адаптацией",
  refuse: "отказ / локальная аттестация",
};

export function HarmoniBricsStep({
  value,
  onChange,
  onAskAssistant,
  assistantBusy,
  assistantError,
  aiAgentConfigured,
}: Props) {
  const { t } = useI18n();
  const [countries, setCountries] = useState<HarmoniBricsCountry[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHarmoniBricsCountries()
      .then((res) => {
        if (!cancelled) setCountries(res.countries || []);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (partial: Partial<HarmoniBricsMapping>) => onChange({ ...value, ...partial });

  const selected = countries.find((c) => c.code === value.targetCountry);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step91Title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("wizard.step91Lead")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/methodology/harmoni-brics" className="text-xs font-semibold text-primary hover:underline">
            {t("wizard.hbMethod")}
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={assistantBusy || !value.targetCountry}
            onClick={() => void onAskAssistant()}
          >
            {assistantBusy ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-1.5" />
            )}
            {t("wizard.hbAskAi")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 flex gap-3">
        <Bot className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">{t("wizard.hbAiTitle")}</div>
          <p className="mt-1 text-indigo-900/80">
            {aiAgentConfigured === false
              ? t("wizard.hbAiNoKey")
              : aiAgentConfigured
                ? t("wizard.hbAiReady")
                : t("wizard.hbAiHint")}
          </p>
          {assistantError ? <p className="mt-2 text-rose-700">{assistantError}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
            <Globe2 className="w-4 h-4" /> {t("wizard.hbCountry")}
          </span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.targetCountry}
            onChange={(event) => {
              const code = event.target.value;
              const country = countries.find((c) => c.code === code);
              patch({
                targetCountry: code,
                partnerNqfName: country?.nqf || "",
                expertConfirmed: false,
              });
            }}
          >
            <option value="">{t("wizard.hbCountryPh")}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name_ru} ({country.code}) — {country.nqf}
              </option>
            ))}
          </select>
          {selected ? (
            <p className="text-xs text-gray-500 leading-relaxed">{selected.bridge}</p>
          ) : null}
        </label>

        <div
          className={`rounded-2xl border p-5 flex gap-4 ${
            value.admitted ? "border-emerald-200 bg-emerald-50/80" : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0 ${
              value.admitted ? "bg-emerald-600" : "bg-amber-600"
            }`}
          >
            {value.admitted ? <Check className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1">
              {value.admitted ? t("wizard.hbAdmitted") : t("wizard.hbNotAdmitted")}
            </div>
            <p className="text-sm text-gray-700">
              {value.admitted ? t("wizard.hbAdmittedHint") : value.denyReason || t("wizard.hbNotAdmittedHint")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.hbNqfLevel")}</span>
          <Input
            value={value.partnerNqfLevel}
            onChange={(event) => patch({ partnerNqfLevel: event.target.value, expertConfirmed: false })}
            placeholder={t("wizard.hbNqfLevelPh")}
          />
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.hbOccCode")}</span>
          <Input
            value={value.partnerOccupationCode}
            onChange={(event) => patch({ partnerOccupationCode: event.target.value, expertConfirmed: false })}
            placeholder={t("wizard.hbOccCodePh")}
          />
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.hbOccTitle")}</span>
          <Input
            value={value.partnerOccupationTitle}
            onChange={(event) => patch({ partnerOccupationTitle: event.target.value, expertConfirmed: false })}
            placeholder={t("wizard.hbOccTitlePh")}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">ISCO-08</span>
          <Input value={value.isco} onChange={(event) => patch({ isco: event.target.value })} />
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">EQF meta</span>
          <Input
            type="number"
            min={1}
            max={8}
            value={value.eqfMeta ?? ""}
            onChange={(event) =>
              patch({
                eqfMeta: event.target.value ? Number(event.target.value) : null,
                expertConfirmed: false,
              })
            }
          />
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.hbRelation")}</span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.relationType}
            onChange={(event) =>
              patch({ relationType: event.target.value as HarmoniRelationType, expertConfirmed: false })
            }
          >
            {HARMONI_RELATION_TYPES.map((item) => (
              <option key={item} value={item}>
                {item} ({TYPE_RU[item]})
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.hbRegime")}</span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.mobilityRegime}
            onChange={(event) =>
              patch({ mobilityRegime: event.target.value as MobilityRegime, expertConfirmed: false })
            }
          >
            {MOBILITY_REGIMES.map((item) => (
              <option key={item} value={item}>
                {REGIME_RU[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.imapConfidence")}</span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.confidence}
            onChange={(event) =>
              patch({ confidence: event.target.value as HarmoniConfidence, expertConfirmed: false })
            }
          >
            <option value="high">{t("wizard.imapHigh")}</option>
            <option value="medium">{t("wizard.imapMedium")}</option>
            <option value="low">{t("wizard.imapLow")}</option>
          </select>
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.expertConfirmed}
            onChange={(event) => patch({ expertConfirmed: event.target.checked })}
          />
          <span>
            <span className="text-sm font-semibold text-gray-900 block">{t("wizard.hbConfirm")}</span>
            <span className="text-xs text-gray-500">{t("wizard.hbConfirmHint")}</span>
          </span>
        </label>
      </div>

      {value.nationalOnly.length > 0 ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-800 mb-2">
            {t("wizard.hbNationalOnly")}
          </div>
          <ul className="text-sm text-rose-950 space-y-1 list-disc pl-5">
            {value.nationalOnly.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
          <Link2 className="w-4 h-4" /> {t("wizard.hbRationale")}
        </span>
        <textarea
          className="w-full min-h-[96px] rounded-md border border-gray-200 px-3 py-2 text-sm"
          value={value.rationale}
          onChange={(event) => patch({ rationale: event.target.value })}
          placeholder={t("wizard.hbRationalePh")}
        />
        {value.assistant ? (
          <p className="text-xs text-gray-400">
            {t("wizard.hbSource")}: {value.assistant}
            {value.model ? ` · ${value.model}` : ""}
            {value.analyzedAt ? ` · ${new Date(value.analyzedAt).toLocaleString()}` : ""}
          </p>
        ) : null}
      </label>

      <label className="block rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.imapNotes")}</span>
        <textarea
          className="w-full min-h-[72px] rounded-md border border-gray-200 px-3 py-2 text-sm"
          value={value.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          placeholder={t("wizard.hbNotesPh")}
        />
      </label>
    </div>
  );
}

export function HarmoniBricsPreview({ value }: { value: HarmoniBricsMapping }) {
  const { t } = useI18n();
  if (!value.analyzedAt && !value.targetCountry) {
    return <p className="text-base text-gray-400">{t("wizard.empty")}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200 font-semibold">
          {value.targetCountry || "—"}
        </span>
        {value.partnerNqfLevel ? (
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-100 font-semibold">
            NQF {value.partnerNqfLevel}
          </span>
        ) : null}
        {value.eqfMeta != null ? (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
            EQF {value.eqfMeta}
          </span>
        ) : null}
        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold">
          {value.relationType} ({TYPE_RU[value.relationType]})
        </span>
        <span
          className={`px-2.5 py-1 rounded-full border font-semibold ${
            value.expertConfirmed
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-900 border-amber-200"
          }`}
        >
          {value.expertConfirmed ? t("wizard.hbConfirmed") : t("wizard.hbDraft")}
        </span>
      </div>
      {value.partnerOccupationTitle || value.partnerOccupationCode ? (
        <p className="text-base text-gray-800">
          <span className="font-semibold text-primary">{t("wizard.hbOccTitle")}: </span>
          {value.partnerOccupationTitle || "—"}
          {value.partnerOccupationCode ? ` (${value.partnerOccupationCode})` : ""}
        </p>
      ) : null}
      {value.rationale ? <p className="text-base text-gray-600 leading-relaxed">{value.rationale}</p> : null}
    </div>
  );
}
