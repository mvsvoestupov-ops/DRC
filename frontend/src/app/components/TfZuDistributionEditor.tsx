import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import type { LaborFunctionDetail } from "@/lib/structureFromLaborFunctions";
import {
  addExtraItemToCard,
  assignPsItemToCard,
  incompleteTdZuCards,
  remainingPsPool,
  removeItemFromCard,
  type TdZuCard,
  type TdZuItem,
  type ZuKind,
} from "@/lib/tdZuDistribution";

type Props = {
  laborFunctions: LaborFunctionDetail[];
  cards: TdZuCard[];
  onChange: (cards: TdZuCard[]) => void;
};

export function TfZuDistributionEditor({ laborFunctions, cards, onChange }: Props) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const incomplete = useMemo(() => new Set(incompleteTdZuCards(cards).map((card) => card.key)), [cards]);

  const grouped = useMemo(() => {
    return laborFunctions
      .map((lf) => ({
        lf,
        pool: remainingPsPool(lf, cards),
        cards: cards.filter((card) => card.tfId === lf.id),
      }))
      .filter((group) => group.cards.length > 0);
  }, [laborFunctions, cards]);

  const setDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const addExtra = (cardKey: string, kind: ZuKind) => {
    const fieldKey = `${cardKey}:${kind}`;
    const text = (drafts[fieldKey] || "").trim();
    if (!text) return;
    onChange(addExtraItemToCard(cards, cardKey, kind, text));
    setDraft(fieldKey, "");
  };

  const renderChips = (card: TdZuCard, items: TdZuItem[], kind: ZuKind) => (
    <ul className="space-y-2 min-h-[2.5rem]">
      {items.length === 0 ? (
        <li className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
          {kind === "knowledge" ? t("wizard.needOneKnowledge") : t("wizard.needOneSkill")}
        </li>
      ) : (
        items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 leading-snug">{item.text}</p>
              {item.origin === "extra" ? (
                <span className="mt-1 inline-flex text-[11px] font-medium uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                  {t("wizard.extraMarker")}
                </span>
              ) : (
                <span className="mt-1 inline-flex text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {t("wizard.fromPs")}
                </span>
              )}
            </div>
            {item.origin === "extra" ? (
              <button
                type="button"
                className="shrink-0 p-1 rounded-md text-red-600 hover:bg-red-50"
                title={t("wizard.deleteExtra")}
                aria-label={t("wizard.deleteExtra")}
                onClick={() => onChange(removeItemFromCard(cards, card.key, item.id))}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-100"
                title={t("wizard.returnToPool")}
                aria-label={t("wizard.returnToPool")}
                onClick={() => onChange(removeItemFromCard(cards, card.key, item.id))}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </li>
        ))
      )}
    </ul>
  );

  const renderAssign = (card: TdZuCard, kind: ZuKind, pool: string[]) => {
    const fieldKey = `${card.key}:${kind}`;
    return (
      <div className="space-y-2">
        {pool.length > 0 && (
          <select
            className="form-control text-sm h-9"
            defaultValue=""
            onChange={(event) => {
              const text = event.target.value;
              if (!text) return;
              onChange(assignPsItemToCard(cards, card.key, kind, text));
              event.target.value = "";
            }}
          >
            <option value="">{t("wizard.assignFromPs")}</option>
            {pool.map((text) => (
              <option key={text} value={text}>
                {text.length > 120 ? `${text.slice(0, 117)}…` : text}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <Input
            value={drafts[fieldKey] || ""}
            onChange={(event) => setDraft(fieldKey, event.target.value)}
            placeholder={kind === "knowledge" ? t("wizard.addKnowledgePh") : t("wizard.addSkillPh")}
            className="h-9"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addExtra(card.key, kind);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => addExtra(card.key, kind)}
          >
            <Plus className="w-4 h-4" />
            {t("wizard.addExtra")}
          </Button>
        </div>
      </div>
    );
  };

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{t("wizard.tfCardsTitle")}</h3>
        <p className="text-sm text-gray-500 mt-1">{t("wizard.tfCardsHelp")}</p>
      </div>
      {grouped.map(({ lf, pool, cards: tfCards }) => (
        <article key={lf.id} className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
          <header className="px-4 py-3 border-b border-primary/15 bg-white/70">
            <p className="text-xs font-semibold text-primary">
              {lf.code}
              {lf.otf_code ? ` · ОТФ ${lf.otf_code}` : ""}
            </p>
            <h4 className="text-sm font-medium text-gray-900 leading-snug mt-0.5">{lf.name}</h4>
            {(pool.knowledges.length > 0 || pool.skills.length > 0) && (
              <p className="text-xs text-gray-500 mt-2">
                {t("wizard.poolLeft", {
                  z: pool.knowledges.length,
                  u: pool.skills.length,
                })}
              </p>
            )}
          </header>
          <div className="p-3 space-y-3">
            {tfCards.map((card) => {
              const bad = incomplete.has(card.key);
              return (
                <section
                  key={card.key}
                  className={`rounded-xl border bg-white p-3 ${
                    bad ? "border-amber-300" : "border-gray-200"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-2">
                      {t("wizard.laborAction")}
                    </span>
                    {card.tdText}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("wizard.knowledge")}
                      </p>
                      {renderChips(card, card.knowledges, "knowledge")}
                      {renderAssign(card, "knowledge", pool.knowledges)}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("wizard.skills")}
                      </p>
                      {renderChips(card, card.skills, "skill")}
                      {renderAssign(card, "skill", pool.skills)}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
