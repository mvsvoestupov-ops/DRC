import { Award, Briefcase, Check, Globe2, Hash, Layers, RefreshCw, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import {
  COVERAGE_TYPES,
  RELATION_TYPES,
  type InternationalMapping,
  type RelationType,
  type SkillCoverage,
} from "@/lib/internationalMapping";

type Props = {
  value: InternationalMapping;
  onChange: (next: InternationalMapping) => void;
  onRecalculate: () => void;
};

const TYPE_RU: Record<RelationType, string> = {
  equivalent: "эквивалент",
  broader: "шире",
  narrower: "уже",
  related: "смежный",
  none: "нет соответствия",
};

export function InternationalMappingStep({ value, onChange, onRecalculate }: Props) {
  const { t } = useI18n();

  const patch = (partial: Partial<InternationalMapping>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t("wizard.step9Title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("wizard.step9Lead")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/methodology/harmonization" className="text-xs font-semibold text-primary hover:underline">
            {t("wizard.imapMethod")}
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={onRecalculate}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            {t("wizard.imapRefresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-2xl border p-5 flex gap-4 ${value.admitted ? "border-emerald-200 bg-emerald-50/80" : "border-rose-200 bg-rose-50/80"}`}>
          <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0 ${value.admitted ? "bg-emerald-600" : "bg-rose-600"}`}>
            {value.admitted ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1">
              {value.admitted ? t("wizard.imapYes") : t("wizard.imapNo")}
            </div>
            <p className="text-sm text-gray-700">
              {value.admitted
                ? t("wizard.imapYesHint")
                : value.denyReason === "no-tf"
                  ? t("wizard.imapDenyNoTf")
                  : t("wizard.imapDenyGeneric")}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 grid grid-cols-2 gap-3">
          <Stamp icon={Hash} label="ОКЗ" value={value.okz || "—"} />
          <Stamp icon={Globe2} label="ISCO-08" value={value.isco || "—"} />
          <Stamp icon={Award} label="EQF occ." value={value.eqfOccupational != null ? String(value.eqfOccupational) : "—"} />
          <Stamp icon={Award} label="EQF edu." value={value.eqfEducational != null ? String(value.eqfEducational) : "—"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> {t("wizard.imapOccupation")}
          </span>
          <Input
            value={value.escoOccupation}
            onChange={(event) => patch({ escoOccupation: event.target.value })}
            placeholder="lawyer"
          />
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.imapOccType")}</span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.occupationType}
            onChange={(event) => patch({ occupationType: event.target.value as RelationType })}
          >
            {RELATION_TYPES.map((item) => (
              <option key={item} value={item}>
                {item} ({TYPE_RU[item]})
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.imapAggType")}</span>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.aggregateType}
            onChange={(event) => patch({ aggregateType: event.target.value as RelationType })}
          >
            {RELATION_TYPES.map((item) => (
              <option key={item} value={item}>
                {item} ({TYPE_RU[item]})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{t("wizard.imapIsced")}</div>
          <Input value={value.isced} onChange={(event) => patch({ isced: event.target.value })} />
        </label>
        <label className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{t("wizard.imapConfidence")}</div>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={value.confidence}
            onChange={(event) => patch({ confidence: event.target.value as InternationalMapping["confidence"] })}
          >
            <option value="high">{t("wizard.imapHigh")}</option>
            <option value="medium">{t("wizard.imapMedium")}</option>
            <option value="low">{t("wizard.imapLow")}</option>
          </select>
        </label>
        <label className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{t("wizard.imapVersion")}</div>
          <Input value={value.escoVersion} onChange={(event) => patch({ escoVersion: event.target.value })} />
        </label>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-900">{t("wizard.imapSkills")}</h3>
        </div>
        {value.skills.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">{t("wizard.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("wizard.imapComponent")}</th>
                  <th>{t("wizard.imapNational")}</th>
                  <th>ESCO</th>
                  <th>{t("wizard.imapCoverage")}</th>
                </tr>
              </thead>
              <tbody>
                {value.skills.map((row, index) => (
                  <tr key={row.id}>
                    <td className="text-xs font-semibold text-primary whitespace-nowrap">{row.component}</td>
                    <td className="text-sm text-gray-800 leading-snug">{row.text}</td>
                    <td>
                      <Input
                        value={row.escoTerm}
                        onChange={(event) => {
                          const skills = value.skills.map((item, i) =>
                            i === index ? { ...item, escoTerm: event.target.value } : item,
                          );
                          patch({ skills });
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs"
                        value={row.coverage}
                        onChange={(event) => {
                          const skills = value.skills.map((item, i) =>
                            i === index ? { ...item, coverage: event.target.value as SkillCoverage } : item,
                          );
                          patch({ skills });
                        }}
                      >
                        {COVERAGE_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {t(`wizard.imapCov_${item.replace("-", "_")}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("wizard.imapNotes")}</span>
        <textarea
          className="w-full min-h-[96px] rounded-xl border border-gray-200 px-3 py-2 text-sm"
          value={value.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          placeholder={t("wizard.imapNotesPh")}
        />
      </label>
    </div>
  );
}

function Stamp({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-base font-bold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

export function InternationalMappingPreview({ value }: { value: InternationalMapping }) {
  const { t } = useI18n();
  if (!value.analyzedAt && !value.escoOccupation && value.skills.length === 0) {
    return <p className="text-base text-gray-400">{t("wizard.empty")}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`px-2.5 py-1 rounded-full font-semibold ${value.admitted ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {value.admitted ? t("wizard.imapYes") : t("wizard.imapNo")}
        </span>
        {value.escoOccupation ? (
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 font-semibold">
            {value.escoOccupation} ({TYPE_RU[value.occupationType]})
          </span>
        ) : null}
        {value.eqfOccupational != null ? (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
            EQF {value.eqfOccupational}
          </span>
        ) : null}
        <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-semibold">
          {value.aggregateType} ({TYPE_RU[value.aggregateType]})
        </span>
      </div>
      {value.skills.filter((row) => row.escoTerm || row.coverage === "national-only").length ? (
        <ul className="text-base text-gray-800 space-y-1.5 leading-relaxed">
          {value.skills
            .filter((row) => row.escoTerm || row.coverage === "national-only")
            .slice(0, 8)
            .map((row) => (
              <li key={row.id}>
                <span className="font-semibold text-primary">{row.component}</span>
                {" → "}
                {row.escoTerm || t("wizard.imapNatOnly")}
              </li>
            ))}
        </ul>
      ) : null}
      {value.notes.trim() ? <p className="text-base text-gray-600 leading-relaxed">{value.notes}</p> : null}
    </div>
  );
}
