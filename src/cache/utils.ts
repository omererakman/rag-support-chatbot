import { createHash } from 'crypto';
import { logger } from '../logger.js';
import { Cache } from './index.js';

/**
 * Creates a deterministic hash from input data
 */
export function hashData(data: string | string[] | Record<string, unknown>): string {
  const normalized = Array.isArray(data)
    ? JSON.stringify(data.sort()) // Sort arrays for deterministic hashing
    : typeof data === 'string'
      ? data
      : JSON.stringify(data);

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Safely executes a cache operation with error handling
 * Returns null on cache errors, allowing graceful degradation
 */
export async function safeCacheGet<T>(cache: Cache | null, key: string): Promise<T | null> {
  if (!cache) {
    return null;
  }

  try {
    return await cache.get<T>(key);
  } catch (error) {
    logger.debug({ error, key }, 'Cache get operation failed, continuing without cache');
    return null;
  }
}

/**
 * Safely executes a cache set operation with error handling
 * Fails silently to allow graceful degradation
 */
export async function safeCacheSet<T>(
  cache: Cache | null,
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  if (!cache) {
    return;
  }

  try {
    await cache.set(key, value, ttl);
  } catch (error) {
    logger.debug({ error, key }, 'Cache set operation failed, continuing without cache');
  }
}
