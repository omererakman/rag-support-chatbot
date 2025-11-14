import { RunnableLambda } from '@langchain/core/runnables';
import { checkModeration } from './moderation.js';
import { detectPII, redactPII } from './pii.js';
import { detectPromptInjection } from './injection.js';
import { SafetyCheckResult } from '../types/schemas.js';
import { logger } from '../logger.js';
import { trace } from '../monitoring/tracing.js';

export const safetyCheckChain = RunnableLambda.from(
  async (input: { question: string }): Promise<SafetyCheckResult> => {
    return trace('safety.check', async () => {
      const [moderationResult, piiDetected, injectionDetected] = await Promise.all([
        checkModeration(input.question),
        Promise.resolve(detectPII(input.question)),
        Promise.resolve(detectPromptInjection(input.question)),
      ]);

      const safe = !moderationResult.flagged && !injectionDetected && !piiDetected.detected;

      if (!safe) {
        logger.debug(
          {
            flagged: moderationResult.flagged,
            injectionDetected,
            piiDetected: piiDetected.detected,
            piiTypes: piiDetected.detected ? Object.keys(piiDetected.types) : [],
          },
          'Unsafe input detected'
        );
      }

      const result: SafetyCheckResult = {
        safe,
        moderationResult,
        injectionDetected,
        piiDetected,
      };

      if (piiDetected.detected) {
        result.sanitizedQuestion = redactPII(input.question, piiDetected);
      }

      return result;
    });
  }
);
