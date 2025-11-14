export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export { MemoryCache } from './memory-cache.js';
export { getCache, createCacheKey } from './factory.js';
export { hashData, safeCacheGet, safeCacheSet } from './utils.js';
