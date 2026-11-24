import { Injectable } from '@angular/core';

/** Minimal synchronous string storage. Abstracted so tests and private-mode browsers work. */
export abstract class KeyValueStorage {
  abstract getItem(key: string): string | null;
  abstract setItem(key: string, value: string): void;
  abstract removeItem(key: string): void;
}

export class MemoryStorage extends KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/**
 * `localStorage` with graceful degradation: if unavailable (private mode, quota, SSR),
 * falls back to in-memory storage for the session instead of crashing.
 */
@Injectable()
export class BrowserStorage extends KeyValueStorage {
  private readonly fallback = new MemoryStorage();
  private readonly native: Storage | null = BrowserStorage.probe();

  /** True when data will survive a reload. */
  get isPersistent(): boolean {
    return this.native !== null;
  }

  private static probe(): Storage | null {
    try {
      const s = globalThis.localStorage;
      const k = '__apros_probe__';
      s.setItem(k, k);
      s.removeItem(k);
      return s;
    } catch {
      return null;
    }
  }

  getItem(key: string): string | null {
    try {
      return this.native ? this.native.getItem(key) : this.fallback.getItem(key);
    } catch {
      return this.fallback.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    try {
      if (this.native) this.native.setItem(key, value);
      else this.fallback.setItem(key, value);
    } catch (err) {
      // Quota exceeded: keep the session working in memory.
      console.error('[APROs] Persisting to localStorage failed; continuing in memory.', err);
      this.fallback.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      this.native?.removeItem(key);
    } finally {
      this.fallback.removeItem(key);
    }
  }
}
