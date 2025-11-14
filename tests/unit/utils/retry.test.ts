import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, isRetryableError } from '../../../src/utils/retry.js';

describe('retryWithBackoff', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('retryable'))
      .mockResolvedValueOnce('success');
    
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      initialDelay: 10,
      retryableErrors: () => true,
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const error = new Error('persistent error');
    const fn = vi.fn().mockRejectedValue(error);
    
    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 10,
        retryableErrors: () => true,
      })
    ).rejects.toThrow('persistent error');
    
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const error = new Error('non-retryable');
    const fn = vi.fn().mockRejectedValue(error);
    
    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        retryableErrors: () => false,
      })
    ).rejects.toThrow('non-retryable');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableError', () => {
  it('should identify retryable errors', () => {
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('timeout occurred'))).toBe(true);
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('Error 429'))).toBe(true);
  });

  it('should identify non-retryable errors', () => {
    expect(isRetryableError(new Error('invalid input'))).toBe(false);
    expect(isRetryableError(new Error('not found'))).toBe(false);
  });
});
