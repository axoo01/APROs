import type { EntityTable, Id } from '../models';

export function emptyTable<T extends { readonly id: Id }>(): EntityTable<T> {
  return { ids: [], entities: {} };
}

export function tableFrom<T extends { readonly id: Id }>(items: readonly T[]): EntityTable<T> {
  const entities: Record<Id, T> = {};
  const ids: Id[] = [];
  for (const item of items) {
    if (!(item.id in entities)) ids.push(item.id);
    entities[item.id] = item;
  }
  return { ids, entities };
}

export function selectAll<T extends { readonly id: Id }>(table: EntityTable<T>): T[] {
  return table.ids.map((id) => table.entities[id]).filter((e): e is T => e !== undefined);
}

export function selectById<T extends { readonly id: Id }>(table: EntityTable<T>, id: Id): T | undefined {
  return table.entities[id];
}

/** Insert or replace; returns the same table instance when nothing changed. */
export function upsertOne<T extends { readonly id: Id }>(table: EntityTable<T>, item: T): EntityTable<T> {
  const exists = item.id in table.entities;
  if (exists && table.entities[item.id] === item) return table;
  return {
    ids: exists ? table.ids : [...table.ids, item.id],
    entities: { ...table.entities, [item.id]: item },
  };
}

export function upsertMany<T extends { readonly id: Id }>(table: EntityTable<T>, items: readonly T[]): EntityTable<T> {
  if (items.length === 0) return table;
  const entities: Record<Id, T> = { ...table.entities };
  const ids = [...table.ids];
  for (const item of items) {
    if (!(item.id in entities)) ids.push(item.id);
    entities[item.id] = item;
  }
  return { ids, entities };
}

export function removeOne<T extends { readonly id: Id }>(table: EntityTable<T>, id: Id): EntityTable<T> {
  if (!(id in table.entities)) return table;
  const entities: Record<Id, T> = { ...table.entities };
  delete entities[id];
  return { ids: table.ids.filter((x) => x !== id), entities };
}
