import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetConfig, getConfig } from '../../src/config/index.js';
import { ConfigurationError } from '../../src/utils/errors.js';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load configuration with valid env vars', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.LLM_MODEL = 'gpt-4o-mini';
    process.env.CHUNK_SIZE = '800';
    process.env.CHUNK_OVERLAP = '100';

    resetConfig();
    const config = getConfig();

    expect(config.openaiApiKey).toBe('test-key');
    expect(config.embeddingModel).toBe('text-embedding-3-small');
    expect(config.llmModel).toBe('gpt-4o-mini');
    expect(config.chunkSize).toBe(800);
    expect(config.chunkOverlap).toBe(100);
  });

  it('should use default values when env vars are missing', () => {
    process.env.OPENAI_API_KEY = 'test-key';

    resetConfig();
    const config = getConfig();

    expect(config.embeddingModel).toBe('text-embedding-3-small');
    expect(config.llmModel).toBe('gpt-4o-mini');
    expect(config.chunkSize).toBe(800);
    expect(config.chunkOverlap).toBe(100);
  });

  it('should throw error when OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY;

    resetConfig();
    expect(() => getConfig()).toThrow(ConfigurationError);
  });

  it('should validate chunk overlap is less than chunk size', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.CHUNK_SIZE = '100';
    process.env.CHUNK_OVERLAP = '150';

    resetConfig();
    const config = getConfig();
    expect(config.chunkOverlap).toBe(150);
  });
});
