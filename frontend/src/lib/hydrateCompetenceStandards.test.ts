import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: {
    getLaborFunctions: vi.fn(),
    getStandardByRegNumber: vi.fn(),
  },
}));

import { apiClient } from "@/api/client";
import { hydrateCompetenceStandards } from "@/lib/hydrateCompetenceStandards";

describe("hydrateCompetenceStandards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to reg_number when prof_standard_id is stale", async () => {
    vi.mocked(apiClient.getLaborFunctions).mockImplementation(async (id: number) => {
      if (id === 999) throw new Error("not found");
      return [
        { id: 11, code: "C/05.6", name: "TF 05", otf_level: "6" },
        { id: 12, code: "C/06.6", name: "TF 06", otf_level: "6" },
      ];
    });
    vi.mocked(apiClient.getStandardByRegNumber).mockResolvedValue({
      id: 2418,
      name: "Работник авиатопливообеспечения",
      reg_number: "1674",
      ps_code: "19.085",
    });

    const result = await hydrateCompetenceStandards({
      profStandardId: 999,
      laborFunctions: [
        {
          code: "C/05.6",
          name: "TF 05",
          standard_id: 999,
          standard_reg_number: "1674",
          standard_name: "Работник авиатопливообеспечения",
        },
        {
          code: "C/06.6",
          name: "TF 06",
          standard_id: 999,
          standard_reg_number: "1674",
          standard_name: "Работник авиатопливообеспечения",
        },
      ],
    });

    expect(result.standards).toHaveLength(1);
    expect(result.standards[0].id).toBe(2418);
    expect(result.standards[0].reg_number).toBe("1674");
    expect(result.profStandardId).toBe(2418);
    expect(result.selectedLaborFunctionIds).toEqual([11, 12]);
    expect(apiClient.getStandardByRegNumber).toHaveBeenCalledWith("1674");
  });

  it("resolves by reg_number when standard_id is missing", async () => {
    vi.mocked(apiClient.getLaborFunctions).mockResolvedValue([
      { id: 21, code: "C/04.6", name: "TF 04", otf_level: "6" },
    ]);
    vi.mocked(apiClient.getStandardByRegNumber).mockResolvedValue({
      id: 100,
      name: "ПС",
      reg_number: "1674",
    });

    const result = await hydrateCompetenceStandards({
      profStandardId: null,
      laborFunctions: [{ code: "C/04.6", standard_reg_number: "1674", standard_name: "ПС" }],
    });

    expect(result.standards[0]?.id).toBe(100);
    expect(result.selectedLaborFunctionIds).toEqual([21]);
  });
});
