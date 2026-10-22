export interface LaborActionDetail {
  text: string;
  knowledges?: string[];
  skills?: string[];
}

export interface LaborFunctionDetail {
  id: number;
  code: string;
  name: string;
  otf_code?: string;
  otf_name?: string;
  otf_level?: string | null;
  labor_actions?: LaborActionDetail[];
  knowledges?: string[];
  skills?: string[];
  standard_id?: number;
  standard_reg_number?: string;
  standard_name?: string;
  okz_codes?: string[];
}

export type StructureItemOrigin = 'ps' | 'manual';

export interface StructureItem {
  id: string;
  text: string;
  tfCode?: string | null;
  tdText?: string | null;
  origin?: StructureItemOrigin;
}

export function isManualStructureItem(item: StructureItem): boolean {
  return item.origin === 'manual';
}

function structureItemKey(item: Pick<StructureItem, 'text' | 'tfCode'>): string {
  return `${item.tfCode || ''}::${item.text.trim().toLowerCase()}`;
}

function laborItemText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && "text" in raw) {
    return String((raw as { text?: string }).text || "").trim();
  }
  return "";
}

export function wasMovedToC(
  text: string,
  tfCode: string | null | undefined,
  moved: StructureItem[],
): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return false;
  return moved.some((item) => {
    if (item.text.trim().toLowerCase() !== needle) return false;
    if (!item.tfCode || !tfCode) return true;
    return item.tfCode === tfCode;
  });
}

function collectTfTdHints(selectedLaborFunctions: LaborFunctionDetail[]) {
  const hints: Array<{ text: string; tfCode: string; tdText: string }> = [];
  selectedLaborFunctions.forEach((tf) => {
    (tf.labor_actions || []).forEach((la, idx) => {
      const tdText = la.text?.trim() || `ТД ${idx + 1}`;
      const push = (raw: unknown) => {
        const text = laborItemText(raw).toLowerCase();
        if (text) hints.push({ text, tfCode: tf.code, tdText });
      };
      (la.knowledges || []).forEach(push);
      (la.skills || []).forEach(push);
    });
  });
  return hints;
}

export function enrichStructureItems(
  items: StructureItem[],
  hints: Array<{ text: string; tfCode: string; tdText: string }>,
): StructureItem[] {
  return items.map((item) => {
    if (item.tfCode && item.tdText) {
      return { ...item, origin: item.origin || "ps" };
    }
    const needle = item.text.trim().toLowerCase();
    const match = hints.find((hint) => {
      if (hint.text !== needle) return false;
      if (item.tfCode) return hint.tfCode === item.tfCode;
      return true;
    });
    if (!match) return item;
    return {
      ...item,
      tfCode: item.tfCode || match.tfCode,
      tdText: item.tdText || match.tdText,
      origin: item.origin || "ps",
    };
  });
}

export type StructureABC = {
  A: StructureItem[];
  B: StructureItem[];
  C: StructureItem[];
};

let idCounter = 0;
export const createStructureItemId = () => `si-${++idCounter}-${Date.now()}`;

export const emptyStructure = (): StructureABC => ({ A: [], B: [], C: [] });

/** Убрать из A/B/C элементы, привязанные к ТФ, которых больше нет в выборе. */
export function pruneStructureToSelectedTfs(
  structure: StructureABC,
  selectedTfCodes: Iterable<string>,
): StructureABC {
  const codes = new Set(
    Array.from(selectedTfCodes)
      .map((code) => String(code || "").trim())
      .filter(Boolean),
  );
  const keep = (item: StructureItem) => {
    const tfCode = (item.tfCode || "").trim();
    if (!tfCode) {
      // Без кода ТФ оставляем только явно ручные строки; PS-рудименты без привязки отбрасываем.
      return isManualStructureItem(item);
    }
    return codes.has(tfCode);
  };
  return {
    A: structure.A.filter(keep),
    B: structure.B.filter(keep),
    C: structure.C.filter(keep),
  };
}

export function structureToPayload(structure: StructureABC) {
  const toRow = (item: StructureItem) => {
    const text = item.text.trim();
    if (!text) return null;
    return {
      // Стабильный id нужен шагу 5 (привязки) и шагу 6 (ФОС), иначе после
      // пересборки структуры привязки «отлипают» и уходят в PUT пустыми.
      id: item.id || null,
      text,
      tfCode: item.tfCode || null,
      tdText: item.tdText || null,
      origin: item.origin || "ps",
    };
  };
  return {
    A: structure.A.map(toRow).filter(Boolean),
    B: structure.B.map(toRow).filter(Boolean),
    C: structure.C.map(toRow).filter(Boolean),
  };
}

export function structureItemText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && "text" in item) {
    return String((item as { text?: string }).text || "").trim();
  }
  return "";
}

export function structureFromPayload(raw?: Record<string, unknown> | null): StructureABC {
  const out = emptyStructure();
  const parse = (value: unknown): StructureItem | null => {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return null;
      return { id: createStructureItemId(), text };
    }
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const text = String(row.text || row.name || "").trim();
    if (!text) return null;
    const origin = row.origin === "manual" ? "manual" : row.origin === "ps" ? "ps" : undefined;
    const tfCode = row.tfCode ? String(row.tfCode) : null;
    const tdText = row.tdText ? String(row.tdText) : null;
    const savedId = String(row.id || "").trim();
    return {
      id: savedId || createStructureItemId(),
      text,
      tfCode,
      tdText,
      origin: origin || (tfCode ? "ps" : undefined),
    };
  };
  (["A", "B", "C"] as const).forEach((category) => {
    const list = Array.isArray(raw?.[category]) ? (raw?.[category] as unknown[]) : [];
    out[category] = list.map(parse).filter((item): item is StructureItem => Boolean(item));
  });
  return out;
}

export function buildStructureFromLaborFunctions(
  selectedLaborFunctions: LaborFunctionDetail[],
  previous: StructureABC = emptyStructure(),
): StructureABC {
  const knowledge: StructureItem[] = [];
  const skills: StructureItem[] = [];
  const seenA = new Set<string>();
  const seenB = new Set<string>();
  const moved = previous.C;
  const prevAByKey = new Map(previous.A.map((item) => [structureItemKey(item), item]));
  const prevBByKey = new Map(previous.B.map((item) => [structureItemKey(item), item]));

  selectedLaborFunctions.forEach((tf) => {
    const tfCode = tf.code;
    (tf.labor_actions || []).forEach((la, idx) => {
      const tdText = la.text?.trim() || `ТД ${idx + 1}`;
      (la.knowledges || []).forEach((raw) => {
        const text = laborItemText(raw);
        if (!text) return;
        const key = `${tfCode}::${text.toLowerCase()}`;
        if (seenA.has(key) || wasMovedToC(text, tfCode, moved)) return;
        seenA.add(key);
        const prev = prevAByKey.get(key);
        knowledge.push({
          id: prev?.id || createStructureItemId(),
          text,
          tfCode,
          tdText: prev?.tdText || tdText,
          origin: 'ps',
        });
      });
      (la.skills || []).forEach((raw) => {
        const text = laborItemText(raw);
        if (!text) return;
        const key = `${tfCode}::${text.toLowerCase()}`;
        if (seenB.has(key) || wasMovedToC(text, tfCode, moved)) return;
        seenB.add(key);
        const prev = prevBByKey.get(key);
        skills.push({
          id: prev?.id || createStructureItemId(),
          text,
          tfCode,
          tdText: prev?.tdText || tdText,
          origin: 'ps',
        });
      });
    });
  });

  previous.A.filter(isManualStructureItem).forEach((item) => {
    const key = structureItemKey(item);
    if (seenA.has(key)) return;
    seenA.add(key);
    knowledge.push(item);
  });
  previous.B.filter(isManualStructureItem).forEach((item) => {
    const key = structureItemKey(item);
    if (seenB.has(key) || wasMovedToC(item.text, item.tfCode, moved)) return;
    seenB.add(key);
    skills.push(item);
  });

  return {
    A: knowledge,
    B: skills,
    C: enrichStructureItems(previous.C, collectTfTdHints(selectedLaborFunctions)),
  };
}

export function tdOrdinalWithinTf(
  selectedLaborFunctions: LaborFunctionDetail[],
  tfCode?: string | null,
  tdText?: string | null,
): number | null {
  if (!tfCode) return null;
  const tf = selectedLaborFunctions.find((lf) => lf.code === tfCode);
  if (!tf) return null;
  const actions = tf.labor_actions || [];
  if (actions.length === 0) return null;
  const needle = (tdText || "").trim().toLowerCase();
  if (needle) {
    const idx = actions.findIndex((la, i) => {
      const text = (la.text?.trim() || `ТД ${i + 1}`).toLowerCase();
      return text === needle;
    });
    if (idx >= 0) return idx + 1;
  }
  if (actions.length === 1) return 1;
  return null;
}
