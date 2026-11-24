/** Opaque string identifier (UUID in persistence). */
export type Id = string;

/** Local calendar date, `YYYY-MM-DD`. Lexicographic order === chronological order. */
export type IsoDate = `${number}-${number}-${number}`;

/** ISO-8601 timestamp, e.g. `2026-11-23T08:52:11.000Z`. */
export type IsoDateTime = string;

/** Normalized table: `ids` preserves insertion order, `entities` gives O(1) lookup. */
export interface EntityTable<T extends { readonly id: Id }> {
  readonly ids: readonly Id[];
  readonly entities: Readonly<Record<Id, T>>;
}

export interface Auditable {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
