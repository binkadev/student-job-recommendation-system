const STORAGE_PREFIX = "job-system:";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getStorageItem<T>(key: string, fallback: T): T {
  return readStorage(key, fallback);
}

export function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
}

export function setStorageItem<T>(key: string, value: T): void {
  writeStorage(key, value);
}

export function removeStorage(key: string) {
  window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

export function removeStorageItem(key: string): void {
  removeStorage(key);
}

export function resetMockStorage() {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function restoreSampleData(): void {
  resetMockStorage();
}

export function getCollection<T>(key: string, seed: T[]): T[] {
  const existing = readStorage<T[] | null>(key, null);
  if (existing) return existing;
  writeStorage(key, seed);
  return seed;
}

export function setCollection<T>(key: string, value: T[]) {
  writeStorage(key, value);
}
