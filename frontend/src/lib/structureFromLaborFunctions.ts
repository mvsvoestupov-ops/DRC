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
  standard_id?: number;
  standard_reg_number?: string;
  standard_name?: string;
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

export type StructureABC = {
  A: StructureItem[];
  B: StructureItem[];
  C: StructureItem[];
};

let idCounter = 0;
export const createStructureItemId = () => `si-${++idCounter}-${Date.now()}`;

export const emptyStructure = (): StructureABC => ({ A: [], B: [], C: [] });

export function structureToPayload(structure: StructureABC) {
  return {
    A: structure.A.map((item) => item.text.trim()).filter(Boolean),
    B: structure.B.map((item) => item.text.trim()).filter(Boolean),
    C: structure.C.map((item) => item.text.trim()).filter(Boolean),
  };
}

export function buildStructureFromLaborFunctions(
  selectedLaborFunctions: LaborFunctionDetail[],
  previous: StructureABC = emptyStructure(),
): StructureABC {
  const knowledge: StructureItem[] = [];
  const skills: StructureItem[] = [];
  const seenA = new Set<string>();
  const seenB = new Set<string>();
  const movedToC = new Set(previous.C.map(structureItemKey));

  selectedLaborFunctions.forEach((tf) => {
    const tfCode = tf.code;
    (tf.labor_actions || []).forEach((la, idx) => {
      const tdText = la.text?.trim() || `ТД ${idx + 1}`;
      (la.knowledges || []).forEach((raw) => {
        const text = (typeof raw === 'string' ? raw : (raw as { text?: string }).text || '').trim();
        if (!text) return;
        const key = `${tfCode}::${text.toLowerCase()}`;
        if (seenA.has(key) || movedToC.has(key)) return;
        seenA.add(key);
        knowledge.push({
          id: createStructureItemId(),
          text,
          tfCode,
          tdText,
          origin: 'ps',
        });
      });
      (la.skills || []).forEach((raw) => {
        const text = (typeof raw === 'string' ? raw : (raw as { text?: string }).text || '').trim();
        if (!text) return;
        const key = `${tfCode}::${text.toLowerCase()}`;
        if (seenB.has(key) || movedToC.has(key)) return;
        seenB.add(key);
        skills.push({
          id: createStructureItemId(),
          text,
          tfCode,
          tdText,
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
    if (seenB.has(key) || movedToC.has(key)) return;
    seenB.add(key);
    skills.push(item);
  });

  return {
    A: knowledge,
    B: skills,
    C: previous.C,
  };
}
