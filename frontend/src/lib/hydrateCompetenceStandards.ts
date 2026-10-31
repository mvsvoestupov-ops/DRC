import { apiClient } from "@/api/client";
import type { ProfStandardSearchItem } from "@/app/components/ProfStandardSearchPicker";
import type { LaborFunctionDetail } from "@/lib/structureFromLaborFunctions";
import { formatTfLevel } from "@/lib/tfLevelRules";

export type SavedLaborFunction = {
  id?: number;
  code?: string;
  name?: string;
  otf_level?: string | null;
  otf_code?: string;
  standard_id?: number | null;
  standard_reg_number?: string | null;
  standard_name?: string | null;
  okz_codes?: string[];
};

export type HydratedCompetenceStandards = {
  standards: ProfStandardSearchItem[];
  laborFunctions: LaborFunctionDetail[];
  selectedLaborFunctionIds: number[];
  profStandardId: number | null;
};

type StandardBucket = {
  key: string;
  preferredId: number | null;
  regNumber: string;
  name: string;
  codes: Set<string>;
};

function asPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function tagLaborFunctions(
  data: LaborFunctionDetail[],
  standard: ProfStandardSearchItem,
): LaborFunctionDetail[] {
  return (Array.isArray(data) ? data : []).map((lf) => ({
    ...lf,
    standard_id: lf.standard_id ?? standard.id,
    standard_reg_number: lf.standard_reg_number ?? standard.reg_number,
    standard_name: lf.standard_name ?? standard.name,
    otf_level: formatTfLevel(lf.otf_level, lf.code) ?? "",
  }));
}

function collectBuckets(
  lfList: SavedLaborFunction[],
  fallbackStandardId: number | null,
): StandardBucket[] {
  const buckets = new Map<string, StandardBucket>();

  const ensure = (key: string, seed: Partial<StandardBucket>) => {
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.preferredId && seed.preferredId) existing.preferredId = seed.preferredId;
      if (!existing.regNumber && seed.regNumber) existing.regNumber = seed.regNumber;
      if ((!existing.name || existing.name === "Профессиональный стандарт") && seed.name) {
        existing.name = seed.name;
      }
      return existing;
    }
    const created: StandardBucket = {
      key,
      preferredId: seed.preferredId ?? null,
      regNumber: seed.regNumber ?? "",
      name: seed.name || "Профессиональный стандарт",
      codes: new Set(),
    };
    buckets.set(key, created);
    return created;
  };

  for (const lf of lfList) {
    const id = asPositiveId(lf.standard_id);
    const reg = String(lf.standard_reg_number || "").trim();
    const key = id ? `id:${id}` : reg ? `reg:${reg}` : "";
    if (!key) continue;
    const bucket = ensure(key, {
      preferredId: id,
      regNumber: reg,
      name: String(lf.standard_name || "").trim(),
    });
    if (lf.code) bucket.codes.add(String(lf.code));
  }

  if (buckets.size === 0 && fallbackStandardId) {
    ensure(`id:${fallbackStandardId}`, {
      preferredId: fallbackStandardId,
      name: "Профессиональный стандарт",
    });
  }

  const byReg = new Map<string, StandardBucket>();
  const merged: StandardBucket[] = [];
  for (const bucket of buckets.values()) {
    if (!bucket.regNumber) {
      merged.push(bucket);
      continue;
    }
    const prev = byReg.get(bucket.regNumber);
    if (!prev) {
      byReg.set(bucket.regNumber, bucket);
      merged.push(bucket);
      continue;
    }
    if (!prev.preferredId && bucket.preferredId) prev.preferredId = bucket.preferredId;
    if (!prev.name || prev.name === "Профессиональный стандарт") prev.name = bucket.name;
    for (const code of bucket.codes) prev.codes.add(code);
  }
  return merged;
}

async function loadStandardBundle(
  bucket: StandardBucket,
): Promise<{ standard: ProfStandardSearchItem; laborFunctions: LaborFunctionDetail[] } | null> {
  const loadById = async (id: number, meta: Partial<ProfStandardSearchItem>) => {
    const data = await apiClient.getLaborFunctions(id);
    const standard: ProfStandardSearchItem = {
      id,
      name: meta.name || bucket.name || "Профессиональный стандарт",
      reg_number: meta.reg_number || bucket.regNumber || "",
      ps_code: meta.ps_code,
      professional_area_code: meta.professional_area_code,
      kind_activity: meta.kind_activity,
    };
    return { standard, laborFunctions: tagLaborFunctions(data as LaborFunctionDetail[], standard) };
  };

  if (bucket.preferredId) {
    try {
      return await loadById(bucket.preferredId, {
        name: bucket.name,
        reg_number: bucket.regNumber,
      });
    } catch {
      /* stale id after PS re-import — fall back to reg_number */
    }
  }

  const reg = bucket.regNumber.trim();
  if (!reg) return null;
  try {
    const std = await apiClient.getStandardByRegNumber(reg);
    const id = asPositiveId(std?.id);
    if (!id) return null;
    return await loadById(id, {
      name: String(std.name || bucket.name || "Профессиональный стандарт"),
      reg_number: String(std.reg_number || reg),
      ps_code: std.ps_code,
      professional_area_code: std.professional_area_code,
      kind_activity: std.kind_activity,
    });
  } catch {
    return null;
  }
}

/**
 * Restore step-2 PS chips + TF tree after reload.
 * Survives stale prof_standard_id (e.g. after PS HTML re-import changed DB ids)
 * by falling back to standard_reg_number from saved labor_functions.
 */
export async function hydrateCompetenceStandards(args: {
  profStandardId?: number | null;
  laborFunctions?: SavedLaborFunction[] | null;
}): Promise<HydratedCompetenceStandards> {
  const lfList = Array.isArray(args.laborFunctions) ? args.laborFunctions : [];
  const fallbackId = asPositiveId(args.profStandardId);
  const buckets = collectBuckets(lfList, fallbackId);
  const selectedCodes = new Set(
    lfList.map((item) => String(item.code || "").trim()).filter(Boolean),
  );

  const standards: ProfStandardSearchItem[] = [];
  const laborFunctions: LaborFunctionDetail[] = [];
  const selectedLaborFunctionIds: number[] = [];
  const seenLf = new Set<number>();

  for (const bucket of buckets) {
    const bundle = await loadStandardBundle(bucket);
    if (!bundle) continue;
    standards.push(bundle.standard);
    for (const lf of bundle.laborFunctions) {
      if (seenLf.has(lf.id)) continue;
      seenLf.add(lf.id);
      laborFunctions.push(lf);
      if (selectedCodes.size === 0) continue;
      if (selectedCodes.has(lf.code) || bucket.codes.has(lf.code)) {
        selectedLaborFunctionIds.push(lf.id);
      }
    }
  }

  return {
    standards,
    laborFunctions,
    selectedLaborFunctionIds,
    profStandardId: standards[0]?.id ?? fallbackId,
  };
}
