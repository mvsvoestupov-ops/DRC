/**
 * Оптимистичная блокировка паспорта (зеркало серверной логики PUT /competences/{id}).
 * Клиент шлёт expected_updated_at; если на сервере уже новее — 409 competence_conflict.
 */

export type CompetenceConflictError = {
  status: 409;
  code: "competence_conflict";
  message: string;
  updated_at: string;
};

export type SharedCompetenceRecord = {
  id: number;
  updated_at: string;
  payload: Record<string, unknown>;
};

/** Как `_normalize_competence_ts` в backend/app/main.py — сравнение с точностью до секунды. */
export function normalizeCompetenceTs(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const dt = new Date(value.getTime());
    dt.setMilliseconds(0);
    return dt.toISOString().replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
  }
  let text = String(value).trim();
  if (!text) return "";
  if (text.endsWith("Z")) text = `${text.slice(0, -1)}+00:00`;
  else if (!/[+-]\d{2}:\d{2}$/.test(text)) text = `${text}+00:00`;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return String(value).trim().slice(0, 19);
  const dt = new Date(ms);
  // UTC без миллисекунд — сравнение как на сервере (точность до секунды).
  return new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      dt.getUTCMinutes(),
      dt.getUTCSeconds(),
    ),
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "");
}

export function checkCompetenceConflict(
  serverUpdatedAt: string | null | undefined,
  expectedUpdatedAt: string | null | undefined,
): CompetenceConflictError | null {
  if (expectedUpdatedAt == null || !String(expectedUpdatedAt).trim()) return null;
  const serverTs = normalizeCompetenceTs(serverUpdatedAt);
  const clientTs = normalizeCompetenceTs(expectedUpdatedAt);
  if (serverTs && clientTs && serverTs !== clientTs) {
    return {
      status: 409,
      code: "competence_conflict",
      message:
        "Паспорт изменён другим участником. Данные не сохранены, чтобы не затереть чужие правки.",
      updated_at: serverUpdatedAt || serverTs,
    };
  }
  return null;
}

function bumpTimestamp(prev: string): string {
  const base = Date.parse(prev.endsWith("Z") ? prev : `${prev}Z`);
  const next = new Date((Number.isNaN(base) ? Date.now() : base) + 1000);
  return normalizeCompetenceTs(next.toISOString());
}

/** In-memory «сервер» для тестов многопользовательского сохранения. */
export class SharedCompetenceStore {
  private record: SharedCompetenceRecord;

  constructor(initial?: Partial<SharedCompetenceRecord>) {
    const updated_at = normalizeCompetenceTs(initial?.updated_at || "2026-10-22T10:00:00Z");
    this.record = {
      id: initial?.id ?? 44,
      updated_at,
      payload: { ...(initial?.payload || {}) },
    };
  }

  get(): SharedCompetenceRecord {
    return {
      id: this.record.id,
      updated_at: this.record.updated_at,
      payload: { ...this.record.payload },
    };
  }

  /**
   * PUT с optimistic concurrency.
   * Успех → новый updated_at и смерженный payload.
   * Конфликт → 409, запись не меняется.
   */
  put(
    patch: Record<string, unknown>,
    expectedUpdatedAt: string | null | undefined,
  ): SharedCompetenceRecord {
    const conflict = checkCompetenceConflict(this.record.updated_at, expectedUpdatedAt);
    if (conflict) {
      throw conflict;
    }
    this.record = {
      ...this.record,
      updated_at: bumpTimestamp(this.record.updated_at),
      payload: { ...this.record.payload, ...patch },
    };
    return this.get();
  }
}

/** Локальная сессия участника РГ: держит свою копию expected_updated_at. */
export class CollaboratorSession {
  readonly name: string;
  private expectedUpdatedAt: string;
  private localPayload: Record<string, unknown>;

  constructor(name: string, snapshot: SharedCompetenceRecord) {
    this.name = name;
    this.expectedUpdatedAt = snapshot.updated_at;
    this.localPayload = { ...snapshot.payload };
  }

  get baseUpdatedAt() {
    return this.expectedUpdatedAt;
  }

  edit(patch: Record<string, unknown>) {
    this.localPayload = { ...this.localPayload, ...patch };
  }

  /** Попытка сохранить на общий сервер. */
  save(store: SharedCompetenceStore): SharedCompetenceRecord {
    const saved = store.put(this.localPayload, this.expectedUpdatedAt);
    this.expectedUpdatedAt = saved.updated_at;
    this.localPayload = { ...saved.payload };
    return saved;
  }

  /** Как UI после 409: перезагрузить чужие правки и сбросить базу. */
  reloadFromServer(store: SharedCompetenceStore) {
    const snap = store.get();
    this.expectedUpdatedAt = snap.updated_at;
    this.localPayload = { ...snap.payload };
    return snap;
  }
}
