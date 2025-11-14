import { Cache } from './index.js';
import { logger } from '../logger.js';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MemoryCache implements Cache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(private defaultTtl?: number) {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlMs = ttl || this.defaultTtl ? (ttl || this.defaultTtl!) * 1000 : undefined;
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;

    this.cache.set(key, { value, expiresAt });
    logger.debug({ key, ttl, expiresAt }, 'Cache entry set');
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired cache entries');
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}
