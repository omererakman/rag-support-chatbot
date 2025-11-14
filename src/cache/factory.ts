import { getConfig } from '../config/index.js';
import { Cache } from './index.js';
import { MemoryCache } from './memory-cache.js';
import { logger } from '../logger.js';

let cacheInstance: Cache | null = null;
let cacheConfig: { enabled: boolean; ttl: number } | null = null;

export function getCache(): Cache | null {
  const config = getConfig();

  if (
    cacheConfig &&
    cacheConfig.enabled === config.cacheEnabled &&
    cacheConfig.ttl === config.cacheTtl
  ) {
    return config.cacheEnabled ? cacheInstance : null;
  }

  cacheConfig = {
    enabled: config.cacheEnabled,
    ttl: config.cacheTtl,
  };

  if (!config.cacheEnabled) {
    cacheInstance = null;
    return null;
  }

  if (!cacheInstance) {
    cacheInstance = new MemoryCache(config.cacheTtl);
    logger.debug({ ttl: config.cacheTtl }, 'Cache instance created');
  }

  return cacheInstance;
}

export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}
