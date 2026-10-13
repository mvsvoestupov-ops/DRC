import {
  type LaborFunctionDetail,
  type StructureABC,
  type StructureItem,
  emptyStructure,
} from "@/lib/structureFromLaborFunctions";

export type ZuOrigin = "ps" | "extra";
export type ZuKind = "knowledge" | "skill";

export type TdZuItem = {
  id: string;
  text: string;
  origin: ZuOrigin;
  kind: ZuKind;
};

export type TdZuCard = {
  key: string;
  tfId: number;
  tfCode: string;
  tfName: string;
  tdIndex: number;
  tdText: string;
  knowledges: TdZuItem[];
  skills: TdZuItem[];
};

export type TdZuState = {
  confirmed: boolean;
  confirmedTfKey: string;
  cards: TdZuCard[];
};

let zuCounter = 0;
export const createZuItemId = () => `zu-${++zuCounter}-${Date.now()}`;

export const emptyTdZuState = (): TdZuState => ({
  confirmed: false,
  confirmedTfKey: "",
  cards: [],
});

function uniqueTexts(values: Array<string | { text?: string } | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const text = (typeof raw === "string" ? raw : raw?.text || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function psPoolTexts(lf: LaborFunctionDetail): { knowledges: string[]; skills: string[] } {
  const knowledges: Array<string | { text?: string }> = [...(lf.knowledges || [])];
  const skills: Array<string | { text?: string }> = [...(lf.skills || [])];
  for (const action of lf.labor_actions || []) {
    knowledges.push(...(action.knowledges || []));
    skills.push(...(action.skills || []));
  }
  return {
    knowledges: uniqueTexts(knowledges),
    skills: uniqueTexts(skills),
  };
}

function toPsItems(values: Array<string | { text?: string } | null | undefined>, kind: ZuKind): TdZuItem[] {
  return uniqueTexts(values).map((text) => ({
    id: createZuItemId(),
    text,
    origin: "ps" as const,
    kind,
  }));
}

function listFingerprint(values: Array<string | { text?: string } | null | undefined>): string {
  return uniqueTexts(values)
    .map((text) => text.toLowerCase())
    .sort()
    .join("\n");
}

export function buildTdZuCards(laborFunctions: LaborFunctionDetail[]): TdZuCard[] {
  const cards: TdZuCard[] = [];
  for (const lf of laborFunctions) {
    const actions =
      lf.labor_actions && lf.labor_actions.length > 0
        ? lf.labor_actions
        : [{ text: lf.name || lf.code, knowledges: lf.knowledges || [], skills: lf.skills || [] }];
    const actionHasZu = actions.some(
      (action) => uniqueTexts(action.knowledges || []).length + uniqueTexts(action.skills || []).length > 0,
    );
    const seeded = actions.map((action, tdIndex) => {
      if (actionHasZu || tdIndex > 0) return action;
      return {
        ...action,
        knowledges: uniqueTexts([...(action.knowledges || []), ...(lf.knowledges || [])]),
        skills: uniqueTexts([...(action.skills || []), ...(lf.skills || [])]),
      };
    });
    const knowledgePrints = seeded.map((action) => listFingerprint(action.knowledges || []));
    const skillPrints = seeded.map((action) => listFingerprint(action.skills || []));
    const sharedKnowledges = knowledgePrints.length > 1 && knowledgePrints.every((item) => item === knowledgePrints[0]);
    const sharedSkills = skillPrints.length > 1 && skillPrints.every((item) => item === skillPrints[0]);
    seeded.forEach((action, tdIndex) => {
      const keepKnowledge = tdIndex === 0 || !sharedKnowledges;
      const keepSkill = tdIndex === 0 || !sharedSkills;
      cards.push({
        key: `${lf.id}:${tdIndex}`,
        tfId: lf.id,
        tfCode: lf.code,
        tfName: lf.name,
        tdIndex,
        tdText: (action.text || "").trim() || `ТД ${tdIndex + 1}`,
        knowledges: keepKnowledge ? toPsItems(action.knowledges || [], "knowledge") : [],
        skills: keepSkill ? toPsItems(action.skills || [], "skill") : [],
      });
    });
  }
  return cards;
}

export function confirmTdZuState(
  laborFunctions: LaborFunctionDetail[],
  tfKey: string,
  previous: TdZuState,
): TdZuState {
  const cards = buildTdZuCards(laborFunctions);
  const keep = previous.confirmedTfKey === tfKey && previous.cards.length > 0;
  const prevByKey = new Map(previous.cards.map((card) => [card.key, card]));
  return {
    confirmed: true,
    confirmedTfKey: tfKey,
    cards: keep
      ? cards.map((card) => {
          const prior = prevByKey.get(card.key);
          if (!prior) return card;
          const hasPrior = prior.knowledges.length + prior.skills.length > 0;
          return hasPrior
            ? { ...card, knowledges: prior.knowledges, skills: prior.skills }
            : card;
        })
      : cards,
  };
}

export function remainingPsPool(
  lf: LaborFunctionDetail,
  cards: TdZuCard[],
): { knowledges: string[]; skills: string[] } {
  const pool = psPoolTexts(lf);
  const assignedK = new Set(
    cards
      .filter((card) => card.tfId === lf.id)
      .flatMap((card) => card.knowledges.filter((item) => item.origin === "ps").map((item) => item.text.toLowerCase())),
  );
  const assignedS = new Set(
    cards
      .filter((card) => card.tfId === lf.id)
      .flatMap((card) => card.skills.filter((item) => item.origin === "ps").map((item) => item.text.toLowerCase())),
  );
  return {
    knowledges: pool.knowledges.filter((text) => !assignedK.has(text.toLowerCase())),
    skills: pool.skills.filter((text) => !assignedS.has(text.toLowerCase())),
  };
}

export function incompleteTdZuCards(cards: TdZuCard[]): TdZuCard[] {
  return cards.filter((card) => card.knowledges.length < 1 || card.skills.length < 1);
}

export function assignPsItemToCard(
  cards: TdZuCard[],
  cardKey: string,
  kind: ZuKind,
  text: string,
): TdZuCard[] {
  const trimmed = text.trim();
  if (!trimmed) return cards;
  return cards.map((card) => {
    if (card.key !== cardKey) return card;
    const list = kind === "knowledge" ? card.knowledges : card.skills;
    if (list.some((item) => item.origin === "ps" && item.text.toLowerCase() === trimmed.toLowerCase())) {
      return card;
    }
    const nextItem: TdZuItem = {
      id: createZuItemId(),
      text: trimmed,
      origin: "ps",
      kind,
    };
    return kind === "knowledge"
      ? { ...card, knowledges: [...card.knowledges, nextItem] }
      : { ...card, skills: [...card.skills, nextItem] };
  });
}

export function addExtraItemToCard(
  cards: TdZuCard[],
  cardKey: string,
  kind: ZuKind,
  text: string,
): TdZuCard[] {
  const trimmed = text.trim();
  if (!trimmed) return cards;
  return cards.map((card) => {
    if (card.key !== cardKey) return card;
    const nextItem: TdZuItem = {
      id: createZuItemId(),
      text: trimmed,
      origin: "extra",
      kind,
    };
    return kind === "knowledge"
      ? { ...card, knowledges: [...card.knowledges, nextItem] }
      : { ...card, skills: [...card.skills, nextItem] };
  });
}

export function removeItemFromCard(cards: TdZuCard[], cardKey: string, itemId: string): TdZuCard[] {
  return cards.map((card) => {
    if (card.key !== cardKey) return card;
    return {
      ...card,
      knowledges: card.knowledges.filter((item) => item.id !== itemId),
      skills: card.skills.filter((item) => item.id !== itemId),
    };
  });
}

export function moveItemToCard(
  cards: TdZuCard[],
  fromKey: string,
  itemId: string,
  toKey: string,
): TdZuCard[] {
  if (fromKey === toKey) return cards;
  const source = cards.find((card) => card.key === fromKey);
  const target = cards.find((card) => card.key === toKey);
  if (!source || !target || source.tfId !== target.tfId) return cards;
  const item = [...source.knowledges, ...source.skills].find((entry) => entry.id === itemId);
  if (!item) return cards;
  const listKey = item.kind === "knowledge" ? "knowledges" : "skills";
  if (
    target[listKey].some(
      (entry) =>
        entry.id === item.id ||
        (entry.origin === "ps" && entry.text.toLowerCase() === item.text.toLowerCase()),
    )
  ) {
    return cards;
  }
  return cards.map((card) => {
    if (card.key === fromKey) {
      return {
        ...card,
        knowledges: card.knowledges.filter((entry) => entry.id !== itemId),
        skills: card.skills.filter((entry) => entry.id !== itemId),
      };
    }
    if (card.key === toKey) {
      return { ...card, [listKey]: [...card[listKey], item] };
    }
    return card;
  });
}

function structureItemKey(item: Pick<StructureItem, "text" | "tfCode">): string {
  return `${item.tfCode || ""}::${item.text.trim().toLowerCase()}`;
}

export function buildStructureFromTdZu(
  cards: TdZuCard[],
  previous: StructureABC = emptyStructure(),
): StructureABC {
  const knowledge: StructureItem[] = [];
  const skills: StructureItem[] = [];
  const seenA = new Set<string>();
  const seenB = new Set<string>();
  const movedToC = new Set(previous.C.map(structureItemKey));

  for (const card of cards) {
    for (const item of card.knowledges) {
      const key = `${card.tfCode}::${item.text.toLowerCase()}`;
      if (seenA.has(key) || movedToC.has(key)) continue;
      seenA.add(key);
      knowledge.push({
        id: item.id,
        text: item.text,
        tfCode: card.tfCode,
        tdText: card.tdText,
        origin: item.origin === "extra" ? "manual" : "ps",
      });
    }
    for (const item of card.skills) {
      const key = `${card.tfCode}::${item.text.toLowerCase()}`;
      if (seenB.has(key) || movedToC.has(key)) continue;
      seenB.add(key);
      skills.push({
        id: item.id,
        text: item.text,
        tfCode: card.tfCode,
        tdText: card.tdText,
        origin: item.origin === "extra" ? "manual" : "ps",
      });
    }
  }

  return {
    A: knowledge,
    B: skills,
    C: previous.C,
  };
}

export function parseTdZuState(raw: unknown): TdZuState {
  if (!raw || typeof raw !== "object") return emptyTdZuState();
  const data = raw as Partial<TdZuState>;
  const cards = Array.isArray(data.cards) ? data.cards : [];
  return {
    confirmed: Boolean(data.confirmed),
    confirmedTfKey: String(data.confirmedTfKey || ""),
    cards: cards
      .filter((card) => card && typeof card === "object")
      .map((card) => ({
        key: String(card.key || `${card.tfId}:${card.tdIndex}`),
        tfId: Number(card.tfId) || 0,
        tfCode: String(card.tfCode || ""),
        tfName: String(card.tfName || ""),
        tdIndex: Number(card.tdIndex) || 0,
        tdText: String(card.tdText || ""),
        knowledges: Array.isArray(card.knowledges) ? card.knowledges : [],
        skills: Array.isArray(card.skills) ? card.skills : [],
      })),
  };
}
