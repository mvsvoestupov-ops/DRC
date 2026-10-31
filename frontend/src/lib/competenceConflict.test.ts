import { describe, expect, it } from "vitest";
import {
  checkCompetenceConflict,
  CollaboratorSession,
  normalizeCompetenceTs,
  SharedCompetenceStore,
  type CompetenceConflictError,
} from "@/lib/competenceConflict";

function isConflict(err: unknown): err is CompetenceConflictError {
  return Boolean(err && typeof err === "object" && (err as CompetenceConflictError).code === "competence_conflict");
}

describe("конфликт сохранения при трёх пользователях", () => {
  it("нормализует метки времени с точностью до секунды", () => {
    expect(normalizeCompetenceTs("2026-10-22T10:00:00.123Z")).toBe(
      normalizeCompetenceTs("2026-10-22T10:00:00Z"),
    );
    expect(normalizeCompetenceTs("2026-10-22T10:00:01Z")).not.toBe(
      normalizeCompetenceTs("2026-10-22T10:00:00Z"),
    );
  });

  it("checkCompetenceConflict: совпадающая база — ок, устаревшая — 409", () => {
    expect(checkCompetenceConflict("2026-10-22T10:00:00Z", "2026-10-22T10:00:00Z")).toBeNull();
    expect(checkCompetenceConflict("2026-10-22T10:00:00.999Z", "2026-10-22T10:00:00Z")).toBeNull();

    const conflict = checkCompetenceConflict("2026-10-22T10:00:05Z", "2026-10-22T10:00:00Z");
    expect(conflict?.status).toBe(409);
    expect(conflict?.code).toBe("competence_conflict");
  });

  it("трое открыли один паспорт: первый сохранил — двое других получают 409", () => {
    const store = new SharedCompetenceStore({
      id: 44,
      updated_at: "2026-10-22T10:00:00Z",
      payload: {
        name: "RUS-PK-0044",
        wizard_step: 5,
        discipline_mapping: [],
      },
    });

    // Три участника РГ открыли черновик одновременно (одна и та же база updated_at).
    const leader = new CollaboratorSession("руководитель", store.get());
    const memberA = new CollaboratorSession("участник-A", store.get());
    const memberB = new CollaboratorSession("участник-B", store.get());

    expect(leader.baseUpdatedAt).toBe(memberA.baseUpdatedAt);
    expect(memberA.baseUpdatedAt).toBe(memberB.baseUpdatedAt);

    // Каждый правит свой фрагмент шага 5 локально.
    leader.edit({
      wizard_step: 5,
      discipline_mapping: [{ text: "Знание 1", discipline: "Логистика", control: "зачёт" }],
      last_editor: "руководитель",
    });
    memberA.edit({
      wizard_step: 5,
      discipline_mapping: [{ text: "Знание 1", discipline: "Транспорт", control: "экзамен" }],
      last_editor: "участник-A",
    });
    memberB.edit({
      wizard_step: 5,
      description: "Правка описания от B",
      last_editor: "участник-B",
    });

    // Руководитель успевает сохранить первым.
    const savedByLeader = leader.save(store);
    expect(savedByLeader.payload.last_editor).toBe("руководитель");
    expect(savedByLeader.updated_at).not.toBe("2026-10-22T10:00:00");

    // Участник A сохраняет со старой базой → конфликт, серверные данные не затёрты.
    let errorA: unknown;
    try {
      memberA.save(store);
    } catch (err) {
      errorA = err;
    }
    expect(isConflict(errorA)).toBe(true);
    if (isConflict(errorA)) {
      expect(errorA.status).toBe(409);
      expect(errorA.updated_at).toBe(savedByLeader.updated_at);
    }
    expect(store.get().payload.last_editor).toBe("руководитель");
    expect(store.get().payload.discipline_mapping).toEqual([
      { text: "Знание 1", discipline: "Логистика", control: "зачёт" },
    ]);

    // Участник B тоже со старой базой → 409.
    let errorB: unknown;
    try {
      memberB.save(store);
    } catch (err) {
      errorB = err;
    }
    expect(isConflict(errorB)).toBe(true);
    expect(store.get().payload.last_editor).toBe("руководитель");
    expect(store.get().payload.description).toBeUndefined();
  });

  it("после 409 участник перезагружает базу и может сохранить свои правки поверх", () => {
    const store = new SharedCompetenceStore({
      updated_at: "2026-10-22T11:00:00Z",
      payload: { name: "Черновик", note: "v1" },
    });

    const user1 = new CollaboratorSession("stol1", store.get());
    const user2 = new CollaboratorSession("stol2", store.get());
    const user3 = new CollaboratorSession("stol3", store.get());

    user1.edit({ note: "правка-1" });
    user1.save(store);

    // user2 и user3 устарели.
    expect(() => user2.save(store)).toThrow();
    expect(() => user3.save(store)).toThrow();

    // user2 делает как UI: reload → правит → сохраняет.
    user2.reloadFromServer(store);
    user2.edit({ note: "правка-2-после-reload", step5_ok: true });
    const saved2 = user2.save(store);
    expect(saved2.payload.note).toBe("правка-2-после-reload");
    expect(saved2.payload.step5_ok).toBe(true);

    // user3 всё ещё на старой базе (до reload user2) → снова 409.
    expect(() => user3.save(store)).toThrow();

    user3.reloadFromServer(store);
    user3.edit({ note: "правка-3-финал" });
    const saved3 = user3.save(store);
    expect(saved3.payload.note).toBe("правка-3-финал");
    expect(store.get().payload.step5_ok).toBe(true);
  });

  it("трое по очереди с актуальной базой сохраняются без конфликта", () => {
    const store = new SharedCompetenceStore({
      updated_at: "2026-10-22T12:00:00Z",
      payload: { marks: [] as string[] },
    });

    const u1 = new CollaboratorSession("u1", store.get());
    const u2 = new CollaboratorSession("u2", store.get());
    const u3 = new CollaboratorSession("u3", store.get());

    u1.edit({ marks: ["u1"] });
    u1.save(store);

    u2.reloadFromServer(store);
    u2.edit({ marks: ["u1", "u2"] });
    u2.save(store);

    u3.reloadFromServer(store);
    u3.edit({ marks: ["u1", "u2", "u3"] });
    u3.save(store);

    expect(store.get().payload.marks).toEqual(["u1", "u2", "u3"]);
  });
});
