import { mockDelay } from "../../utils/mockDelay";
import { getCollection, setCollection } from "../../utils/localStorage";

export interface ListParams {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function listFromStorage<T extends { id: string }>(
  key: string,
  seed: T[],
  params: ListParams = {},
  searchFields: Array<keyof T> = [],
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const query = params.query?.trim().toLowerCase();
  const status = params.status?.trim();
  let items = getCollection(key, seed);

  if (query) {
    items = items.filter((item) =>
      searchFields.some((field) => String(item[field] ?? "").toLowerCase().includes(query)),
    );
  }

  if (status && status !== "all") {
    items = items.filter((item) => String((item as T & { status?: string }).status ?? "") === status);
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;

  return mockDelay<ListResult<T>>({
    items: items.slice(start, start + pageSize),
    totalItems,
    page,
    pageSize,
    totalPages,
  });
}

export function getByIdFromStorage<T extends { id: string }>(key: string, seed: T[], id: string) {
  const item = getCollection(key, seed).find((entry) => entry.id === id);
  return mockDelay(item ?? null);
}

export function createInStorage<T extends { id: string }>(key: string, seed: T[], payload: T) {
  const collection = getCollection(key, seed);
  const next = [payload, ...collection];
  setCollection(key, next);
  return mockDelay(payload);
}

export function updateInStorage<T extends { id: string }>(key: string, seed: T[], id: string, payload: Partial<T>) {
  const collection = getCollection(key, seed);
  const next = collection.map((item) => (item.id === id ? { ...item, ...payload } : item));
  setCollection(key, next);
  return mockDelay(next.find((item) => item.id === id) ?? null);
}

export function deleteFromStorage<T extends { id: string }>(key: string, seed: T[], id: string) {
  const collection = getCollection(key, seed);
  setCollection(
    key,
    collection.filter((item) => item.id !== id),
  );
  return mockDelay(undefined);
}
