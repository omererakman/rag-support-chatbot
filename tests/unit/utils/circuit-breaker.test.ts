import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../../src/utils/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeout: 100,
      monitoringPeriod: 1000,
    });
  });

  it('should execute successfully when closed', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(fn);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after failure threshold', async () => {
    const error = new Error('test error');
    const fn = vi.fn().mockRejectedValue(error);

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    
    await expect(circuitBreaker.execute(fn)).rejects.toThrow(/Circuit breaker.*is OPEN/);
  });

  it('should transition to half-open after reset timeout', async () => {
    const error = new Error('test error');
    const fn = vi.fn().mockRejectedValue(error);

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

    await new Promise(resolve => setTimeout(resolve, 150));

    const successFn = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successFn);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close after successful half-open attempts', async () => {
    const error = new Error('test error');
    const failFn = vi.fn().mockRejectedValue(error);
    const successFn = vi.fn().mockResolvedValue('success');

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failFn);
      } catch (e) {
      }
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    await circuitBreaker.execute(successFn);
    await circuitBreaker.execute(successFn);

    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
});
