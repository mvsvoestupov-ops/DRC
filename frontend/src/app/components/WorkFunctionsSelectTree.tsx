import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useI18n } from "@/context/I18nContext";
import type { LaborFunctionDetail } from "@/lib/structureFromLaborFunctions";
import {
  addExtraItemToCard,
  buildTdZuCards,
  incompleteTdZuCards,
  moveItemToCard,
  removeItemFromCard,
  type TdZuCard,
  type TdZuItem,
  type ZuKind,
} from "@/lib/tdZuDistribution";
import "./WorkFunctionsSelectTree.css";

type StandardInfo = {
  name: string;
  ps_code?: string | null;
  reg_number?: string | null;
};

type Props = {
  standard: StandardInfo;
  laborFunctions: LaborFunctionDetail[];
  selectedIds: number[];
  onToggleTf: (id: number) => void;
  disableReason: (lf: LaborFunctionDetail) => string | null;
  selectionLocked: boolean;
  expandedIds: number[];
  onToggleExpand: (id: number) => void;
  confirmed: boolean;
  cards: TdZuCard[];
  onChangeCards: (cards: TdZuCard[]) => void;
  loading?: boolean;
};

type OtfGroup = {
  key: string;
  code: string;
  name: string;
  level: string;
  functions: LaborFunctionDetail[];
};

function groupByOtf(functions: LaborFunctionDetail[]): OtfGroup[] {
  const groups = new Map<string, OtfGroup>();
  for (const lf of functions) {
    const code = (lf.otf_code || "").trim();
    const name = (lf.otf_name || "").trim();
    const key = `${code}::${name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.functions.push(lf);
      continue;
    }
    groups.set(key, {
      key,
      code,
      name,
      level: String(lf.otf_level || "").trim(),
      functions: [lf],
    });
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code, "ru"));
}

export function WorkFunctionsSelectTree({
  standard,
  laborFunctions,
  selectedIds,
  onToggleTf,
  disableReason,
  selectionLocked,
  expandedIds,
  onToggleExpand,
  confirmed,
  cards,
  onChangeCards,
  loading = false,
}: Props) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const visibleFunctions = useMemo(
    () =>
      confirmed ? laborFunctions.filter((lf) => selectedIds.includes(lf.id)) : laborFunctions,
    [confirmed, laborFunctions, selectedIds],
  );
  const otfGroups = useMemo(() => groupByOtf(visibleFunctions), [visibleFunctions]);
  const incomplete = useMemo(
    () => new Set(confirmed ? incompleteTdZuCards(cards).map((card) => card.key) : []),
    [cards, confirmed],
  );
  const previewByTf = useMemo(() => {
    const map = new Map<number, TdZuCard[]>();
    for (const lf of laborFunctions) {
      map.set(lf.id, buildTdZuCards([lf]));
    }
    return map;
  }, [laborFunctions]);

  const cardsForTf = (tfId: number): TdZuCard[] => {
    if (confirmed) {
      const stored = cards.filter((card) => card.tfId === tfId);
      if (stored.length > 0) return stored;
    }
    return previewByTf.get(tfId) || [];
  };

  const addExtra = (cardKey: string, kind: ZuKind) => {
    const fieldKey = `${cardKey}:${kind}`;
    const text = (drafts[fieldKey] || "").trim();
    if (!text) return;
    onChangeCards(addExtraItemToCard(cards, cardKey, kind, text));
    setDrafts((prev) => ({ ...prev, [fieldKey]: "" }));
  };

  if (loading && laborFunctions.length === 0) {
    return (
      <div className="wf-select__loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="mt-3">{t("wizard.loadingTf")}</div>
      </div>
    );
  }

  if (laborFunctions.length === 0) {
    return <div className="wf-select__empty">{t("wizard.tfNotFound")}</div>;
  }

  return (
    <div className="wf-select">
      <p className="wf-select__help">{t("wizard.wfHierarchyHelp")}</p>
      <div className="wf-select__grid">
        <aside className="wf-card wf-card--ps wf-sticky">
          <div className="wf-card__label">{t("wizard.psLabel")}</div>
          <div className="wf-card__title">{standard.name}</div>
          {(standard.ps_code || standard.reg_number) && (
            <div className="wf-card__meta">
              {[standard.reg_number, standard.ps_code].filter(Boolean).join(" · ")}
            </div>
          )}
        </aside>

        <div className="wf-select__otf-list">
          {otfGroups.length === 0 ? (
            <div className="wf-select__empty">{t("wizard.noOtf")}</div>
          ) : (
            otfGroups.map((otf) => (
              <section key={otf.key} className="wf-otf-block">
                <aside className="wf-card wf-card--otf wf-sticky">
                  <div className="wf-card__label">
                    {t("wizard.otfLabel", { code: otf.code ? ` ${otf.code}` : "" })}
                  </div>
                  <div className="wf-card__title">{otf.name}</div>
                  {otf.level ? (
                    <div className="wf-card__meta">{t("wizard.otfLevel", { n: otf.level })}</div>
                  ) : null}
                </aside>

                <div className="wf-select__tf-list">
                  {otf.functions.map((lf) => {
                    const selected = selectedIds.includes(lf.id);
                    const expanded = expandedIds.includes(lf.id);
                    const reason = selected ? null : disableReason(lf);
                    const tfCards = cardsForTf(lf.id);
                    return (
                      <div key={lf.id} className="wf-tf-row">
                        <div className={`wf-card wf-card--tf wf-sticky${selected ? " wf-card--selected" : ""}`}>
                          <div className="wf-tf-head">
                            <div className="min-w-0 flex-1">
                              <div className="wf-card__label">
                                {t("wizard.tfMark", { code: lf.code ? ` ${lf.code}` : "" })}
                              </div>
                              <div className="wf-card__title">{lf.name}</div>
                              {reason ? <div className="wf-reason">{reason}</div> : null}
                            </div>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={selectionLocked || Boolean(reason)}
                              onChange={() => onToggleTf(lf.id)}
                              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                            />
                          </div>
                          <div className="wf-tf-actions">
                            <button
                              type="button"
                              className="wf-expand-btn inline-flex items-center gap-1"
                              onClick={() => onToggleExpand(lf.id)}
                            >
                              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {expanded ? t("wizard.hideTd") : t("wizard.showTdZu")}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="wf-select__td-list">
                            {tfCards.length === 0 ? (
                              <div className="text-sm text-gray-500 px-2 py-2">{t("wizard.noTd")}</div>
                            ) : (
                              tfCards.map((card) => {
                                const active = selected;
                                const bad = selected && incomplete.has(card.key);
                                const siblings = tfCards.filter((item) => item.key !== card.key);
                                const items: TdZuItem[] = [...card.skills, ...card.knowledges];
                                return (
                                  <div key={card.key} className="wf-td-row">
                                    <div
                                      className={`wf-card wf-card--td${active ? " wf-card--active" : ""}${
                                        bad ? " wf-card--incomplete" : ""
                                      }`}
                                    >
                                      <div className="wf-card__label">{t("wizard.laborAction")}</div>
                                      <div className="wf-card__title">{card.tdText}</div>
                                      {bad ? (
                                        <div className="wf-reason">
                                          {card.knowledges.length < 1 ? t("wizard.needOneKnowledge") : ""}
                                          {card.knowledges.length < 1 && card.skills.length < 1 ? " · " : ""}
                                          {card.skills.length < 1 ? t("wizard.needOneSkill") : ""}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="wf-select__uz-list">
                                      {items.length === 0 ? (
                                        <div className="text-xs text-gray-500 px-2 py-2">{t("wizard.noTdZu")}</div>
                                      ) : (
                                        items.map((item) => (
                                          <div
                                            key={item.id}
                                            className={`wf-card wf-card--skill ${
                                              item.kind === "skill" ? "wf-card--um" : "wf-card--zn"
                                            }${active ? " wf-card--active" : ""}`}
                                          >
                                            <div className="wf-skill-row">
                                              <div className="wf-skill-row__text">
                                                <b>
                                                  {item.kind === "skill"
                                                    ? t("wizard.skillMark")
                                                    : t("wizard.knowledgeMark")}
                                                </b>{" "}
                                                {item.text}
                                                {item.origin === "extra" ? (
                                                  <span className="wf-extra">{t("wizard.extraMarker")}</span>
                                                ) : null}
                                              </div>
                                              {confirmed && selected && item.origin === "ps" && siblings.length > 0 ? (
                                                <span className="wf-moves">
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <button
                                                        type="button"
                                                        className="wf-move-btn"
                                                        title={t("wizard.moveZuHint")}
                                                        aria-label={t("wizard.moveZu")}
                                                      >
                                                        ↑↓
                                                      </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="max-w-md">
                                                      <DropdownMenuLabel>{t("wizard.moveZuTo")}</DropdownMenuLabel>
                                                      {siblings.map((target) => (
                                                        <DropdownMenuItem
                                                          key={target.key}
                                                          className="whitespace-normal"
                                                          onSelect={() =>
                                                            onChangeCards(
                                                              moveItemToCard(cards, card.key, item.id, target.key),
                                                            )
                                                          }
                                                        >
                                                          {target.tdText}
                                                        </DropdownMenuItem>
                                                      ))}
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                </span>
                                              ) : null}
                                              {confirmed && selected && item.origin === "extra" ? (
                                                <button
                                                  type="button"
                                                  className="wf-delete-btn"
                                                  title={t("wizard.deleteExtra")}
                                                  aria-label={t("wizard.deleteExtra")}
                                                  onClick={() =>
                                                    onChangeCards(removeItemFromCard(cards, card.key, item.id))
                                                  }
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                      {confirmed && selected ? (
                                        <>
                                          <ExtraRow
                                            kind="skill"
                                            value={drafts[`${card.key}:skill`] || ""}
                                            onChange={(value) =>
                                              setDrafts((prev) => ({ ...prev, [`${card.key}:skill`]: value }))
                                            }
                                            onAdd={() => addExtra(card.key, "skill")}
                                            placeholder={t("wizard.addSkillPh")}
                                            addLabel={t("wizard.addExtra")}
                                          />
                                          <ExtraRow
                                            kind="knowledge"
                                            value={drafts[`${card.key}:knowledge`] || ""}
                                            onChange={(value) =>
                                              setDrafts((prev) => ({ ...prev, [`${card.key}:knowledge`]: value }))
                                            }
                                            onAdd={() => addExtra(card.key, "knowledge")}
                                            placeholder={t("wizard.addKnowledgePh")}
                                            addLabel={t("wizard.addExtra")}
                                          />
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ExtraRow({
  kind,
  value,
  onChange,
  onAdd,
  placeholder,
  addLabel,
}: {
  kind: ZuKind;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="wf-extra-add">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAdd();
          }
        }}
        aria-label={placeholder}
        data-kind={kind}
      />
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1 h-8" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}
