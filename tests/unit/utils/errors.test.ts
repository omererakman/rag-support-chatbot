import { describe, it, expect } from 'vitest';
import {
  RAGError,
  VectorStoreError,
  LLMError,
  SafetyCheckError,
  ConfigurationError,
} from '../../../src/utils/errors.js';

describe('Error Types', () => {
  it('should create RAGError with correct properties', () => {
    const error = new RAGError('Test error', 'TEST_ERROR', 500);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('RAGError');
  });

  it('should create VectorStoreError', () => {
    const cause = new Error('Original error');
    const error = new VectorStoreError('Vector store failed', cause);
    expect(error.message).toBe('Vector store failed');
    expect(error.code).toBe('VECTOR_STORE_ERROR');
    expect(error.statusCode).toBe(503);
    expect(error.cause).toBe(cause);
  });

  it('should create LLMError', () => {
    const error = new LLMError('LLM failed');
    expect(error.message).toBe('LLM failed');
    expect(error.code).toBe('LLM_ERROR');
    expect(error.statusCode).toBe(502);
  });

  it('should create SafetyCheckError', () => {
    const error = new SafetyCheckError('Unsafe input');
    expect(error.message).toBe('Unsafe input');
    expect(error.code).toBe('SAFETY_CHECK_ERROR');
    expect(error.statusCode).toBe(400);
  });

  it('should create ConfigurationError', () => {
    const error = new ConfigurationError('Config invalid');
    expect(error.message).toBe('Config invalid');
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.statusCode).toBe(500);
  });
});
