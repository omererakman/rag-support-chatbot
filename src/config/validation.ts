import { getConfig } from './index.js';
import { logger } from '../logger.js';
import { ConfigurationError } from '../utils/errors.js';
import { checkChromaHealth } from '../vector-stores/health.js';
import { validatePositiveNumber } from '../utils/validation.js';

export async function validateConfig(): Promise<void> {
  const config = getConfig();

  logger.debug('Validating configuration...');

  if (!config.openaiApiKey.startsWith('sk-')) {
    throw new ConfigurationError('Invalid OpenAI API key format');
  }

  if (config.vectorStoreType === 'chromadb') {
    try {
      const isHealthy = await checkChromaHealth();
      if (!isHealthy) {
        logger.debug('ChromaDB health check failed, but continuing...');
      } else {
        logger.debug('ChromaDB health check passed');
      }
    } catch (error) {
      logger.debug({ error }, 'ChromaDB health check error, but continuing...');
    }
  }

  if (config.chunkOverlap >= config.chunkSize) {
    throw new ConfigurationError('CHUNK_OVERLAP must be less than CHUNK_SIZE');
  }

  if (config.confidenceEnabled) {
    if (
      config.confidenceLowThreshold >= config.confidenceMediumThreshold ||
      config.confidenceMediumThreshold >= config.confidenceHighThreshold
    ) {
      throw new ConfigurationError(
        'Confidence thresholds must be ordered: LOW_THRESHOLD < MEDIUM_THRESHOLD < HIGH_THRESHOLD'
      );
    }
  }

  try {
    validatePositiveNumber(config.chunkSize, 'CHUNK_SIZE');
    validatePositiveNumber(config.chunkOverlap, 'CHUNK_OVERLAP');
    validatePositiveNumber(config.topK, 'TOP_K');
    if (config.cacheEnabled) {
      validatePositiveNumber(config.cacheTtl, 'CACHE_TTL');
    }
  } catch (error) {
    throw new ConfigurationError(
      error instanceof Error ? error.message : 'Invalid configuration value',
      error instanceof Error ? error : undefined
    );
  }

  logger.debug('Configuration validation passed');
}
