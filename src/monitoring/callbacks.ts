import { CallbackManager } from '@langchain/core/callbacks/manager';
import { logger } from '../logger.js';
import { MetricsCollector } from './metrics.js';
import { generateCorrelationId } from '../logger.js';
import { countChatTokens, countTokens } from '../utils/token-counter.js';
import { getConfig } from '../config/index.js';

const metrics = MetricsCollector.getInstance();

export function createCallbackManager(correlationId?: string): CallbackManager {
  const traceId = correlationId || generateCorrelationId();

  interface LLMInstance {
    name?: string;
    modelName?: string;
  }

  return CallbackManager.fromHandlers({
    async handleLLMStart(llm: LLMInstance, prompts: unknown[]) {
      const llmName = llm.name || llm.modelName || 'unknown';
      logger.debug(
        {
          llm: llmName,
          promptCount: prompts.length,
          correlationId: traceId,
        },
        'LLM started'
      );
      metrics.recordOperation('llm.start', {
        model: llmName,
        promptCount: prompts.length,
      });
    },

    async handleLLMEnd(output) {
      const config = getConfig();
      const modelName = output.llmOutput?.modelName || config.llmModel || 'unknown';
      let tokenUsage = output.llmOutput?.tokenUsage;

      if (!tokenUsage || !tokenUsage.totalTokens) {
        try {
          let promptText = '';
          if (output.llmOutput?.prompts) {
            const prompts = output.llmOutput.prompts;
            if (Array.isArray(prompts) && prompts.length > 0) {
              promptText = prompts
                .map((p: unknown) => {
                  if (typeof p === 'string') return p;
                  if (typeof p === 'object' && p !== null) {
                    const msg = p as { content?: string; text?: string; message?: string };
                    return msg.content || msg.text || msg.message || '';
                  }
                  return String(p || '');
                })
                .join('');
            }
          }

          let completionText = '';
          if (output.llmOutput?.generations && Array.isArray(output.llmOutput.generations)) {
            const firstGeneration = output.llmOutput.generations[0];
            if (Array.isArray(firstGeneration) && firstGeneration.length > 0) {
              const gen = firstGeneration[0] as { text?: string; content?: string };
              completionText = gen.text || gen.content || '';
            }
          }

          if (promptText || completionText) {
            const promptTokens = promptText ? countChatTokens('', promptText, modelName) : 0;
            const completionTokens = completionText ? countTokens(completionText, modelName) : 0;

            tokenUsage = {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            };

            logger.debug(
              { estimated: true, tokenUsage, model: modelName },
              'Token usage estimated using token counter'
            );
          }
        } catch (error) {
          logger.debug({ error }, 'Failed to estimate token usage');
        }
      }

      if (tokenUsage) {
        metrics.recordTokenUsage(modelName, {
          promptTokens: tokenUsage.promptTokens || 0,
          completionTokens: tokenUsage.completionTokens || 0,
          totalTokens: tokenUsage.totalTokens || 0,
        });
      }

      logger.debug(
        {
          tokenUsage,
          correlationId: traceId,
        },
        'LLM completed'
      );
    },

    async handleLLMError(error) {
      logger.error({ error, correlationId: traceId }, 'LLM error');
      metrics.recordError('llm.error', error);
    },

    async handleRetrieverStart(_retriever: unknown, query: string) {
      logger.debug(
        {
          query: query.substring(0, 100),
          queryLength: query.length,
          correlationId: traceId,
        },
        'Retrieval started'
      );
      metrics.recordOperation('retriever.start', { queryLength: query.length });
    },

    async handleRetrieverEnd(documents) {
      logger.debug(
        {
          documentCount: documents.length,
          correlationId: traceId,
        },
        'Retrieval completed'
      );
      metrics.recordOperation('retriever.end', { documentCount: documents.length });
    },

    async handleRetrieverError(error) {
      logger.error({ error, correlationId: traceId }, 'Retriever error');
      metrics.recordError('retriever.error', error);
    },

    async handleChainStart(chain) {
      logger.debug({ chain: chain.name || 'unknown', correlationId: traceId }, 'Chain started');
      metrics.recordOperation('chain.start', { chain: chain.name });
    },

    async handleChainEnd(_output: unknown) {
      logger.debug({ correlationId: traceId }, 'Chain completed');
      metrics.recordOperation('chain.end', {});
    },

    async handleChainError(error: Error) {
      logger.error({ error, correlationId: traceId }, 'Chain error');
      metrics.recordError('chain.error', error);
    },
  });
}
