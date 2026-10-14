export type ResourceGroupId = "A" | "B" | "C";

export type CompetenceResources = Record<ResourceGroupId, string[]>;

export const RESOURCE_GROUPS: ResourceGroupId[] = ["A", "B", "C"];

export function emptyCompetenceResources(): CompetenceResources {
  return { A: [""], B: [""], C: [""] };
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ""));
}

export function parseCompetenceResources(raw: unknown): CompetenceResources {
  if (Array.isArray(raw)) {
    const items = asList(raw);
    return { A: items.length ? items : [""], B: [""], C: [""] };
  }
  if (raw && typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    const take = (key: ResourceGroupId): string[] => {
      const items = asList(row[key]);
      return items.length ? items : [""];
    };
    return { A: take("A"), B: take("B"), C: take("C") };
  }
  return emptyCompetenceResources();
}

export function trimResourceList(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function resourcesPayload(resources: CompetenceResources): CompetenceResources {
  return {
    A: trimResourceList(resources.A),
    B: trimResourceList(resources.B),
    C: trimResourceList(resources.C),
  };
}

export function resourcesFilled(resources: CompetenceResources): boolean {
  return RESOURCE_GROUPS.every((group) => trimResourceList(resources[group]).length > 0);
}

export function resourcesHasAny(resources: unknown): boolean {
  const parsed = parseCompetenceResources(resources);
  return RESOURCE_GROUPS.some((group) => trimResourceList(parsed[group]).length > 0);
}
