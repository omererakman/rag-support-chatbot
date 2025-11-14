import { RunnableSequence, RunnablePassthrough, RunnableLambda } from '@langchain/core/runnables';
import { Document } from '@langchain/core/documents';
import { safetyCheckChain } from '../safety/index.js';
import { createRetriever } from '../retrievers/index.js';
import { createLLM } from '../llm/index.js';
import { ragPrompt } from '../prompts/rag.js';
import { VectorStore } from '@langchain/core/vectorstores';
import { RAGResponse, SafetyCheckResult } from '../types/schemas.js';
import { logger } from '../logger.js';
import { SafetyCheckError } from '../utils/errors.js';
import { trace } from '../monitoring/tracing.js';
import { MetricsCollector } from '../monitoring/metrics.js';
import { getConfig } from '../config/index.js';
import { getCache, createCacheKey, hashData, safeCacheGet, safeCacheSet } from '../cache/index.js';
import {
  calculateConfidence,
  extractSimilarityScores,
  ConfidenceFactors,
} from '../utils/confidence.js';
import { BaseMessage } from '@langchain/core/messages';

interface LLMResponseMetadata {
  response_metadata?: {
    usage?: TokenUsage;
    token_usage?: TokenUsage;
    usage_metadata?: TokenUsage;
  };
  usage?: TokenUsage;
  llmOutput?: {
    tokenUsage?: TokenUsage;
  };
}

interface TokenUsage {
  promptTokens?: number;
  prompt_tokens?: number;
  completionTokens?: number;
  completion_tokens?: number;
  totalTokens?: number;
  total_tokens?: number;
}

export function createRAGChain(vectorStore: VectorStore) {
  const retriever = createRetriever(vectorStore);
  const llm = createLLM();
  const config = getConfig();
  const metrics = MetricsCollector.getInstance();
  const chain = ragPrompt.pipe(llm);

  return RunnableSequence.from([
    RunnablePassthrough.assign({
      _queryStartTime: () => Date.now(),
    }),
    RunnablePassthrough.assign({
      safety: async (input: { question: string }) => {
        const safetyStartTime = Date.now();
        let safetyResult;

        if (!config.safetyEnabled) {
          safetyResult = {
            safe: true,
            moderationResult: { flagged: false, categories: {}, category_scores: {} },
            injectionDetected: false,
            piiDetected: { detected: false, types: {} },
          };
        } else {
          safetyResult = await trace('safety.check', async () => {
            return await safetyCheckChain.invoke({ question: input.question });
          });
        }

        return {
          ...safetyResult,
          timingMs: Date.now() - safetyStartTime,
        };
      },
    }),
    RunnableLambda.from(
      (input: { question: string; safety: SafetyCheckResult & { timingMs: number } }) => {
        if (!input.safety.safe) {
          logger.debug(
            {
              question: input.question.substring(0, 100),
              safety: {
                flagged: input.safety.moderationResult.flagged,
                injectionDetected: input.safety.injectionDetected,
                piiDetected: input.safety.piiDetected.detected,
              },
            },
            'Unsafe input detected'
          );
          metrics.recordError('safety.unsafe', new Error('Unsafe input'));
          throw new SafetyCheckError('Unsafe input detected', undefined, {
            safety: input.safety,
          });
        }
        return input;
      }
    ),
    RunnablePassthrough.assign({
      documents: async (input: {
        question: string;
        safety: SafetyCheckResult & { timingMs: number };
      }) => {
        const retrievalStartTime = Date.now();
        const sanitizedQuestion = input.safety?.sanitizedQuestion || input.question;

        const cache = getCache();
        const config = getConfig();
        let cacheHit = false;

        if (config.cacheRetrieval && cache) {
          const queryHash = hashData(sanitizedQuestion);
          const retrieverConfig = `${config.retrieverType}:${config.topK}`;
          const cacheKey = createCacheKey('retrieval', retrieverConfig, queryHash);
          const cached = await safeCacheGet<
            Array<{ pageContent: string; metadata: Record<string, unknown> }>
          >(cache, cacheKey);

          if (cached) {
            cacheHit = true;
            const docs = cached.map(
              (item) => new Document({ pageContent: item.pageContent, metadata: item.metadata })
            );
            const searchTimeMs = Date.now() - retrievalStartTime;
            logger.debug(
              { documentCount: docs.length, searchTimeMs, cacheHit },
              'Documents retrieved from cache'
            );
            return { docs, searchTimeMs, cacheHit };
          }
        }

        const docs = await trace('retrieval', async () => {
          return await retriever.invoke(sanitizedQuestion);
        });
        const searchTimeMs = Date.now() - retrievalStartTime;
        logger.debug({ documentCount: docs.length, searchTimeMs, cacheHit }, 'Documents retrieved');
        return { docs, searchTimeMs, cacheHit };
      },
    }),
    RunnablePassthrough.assign({
      answer: async (input: {
        question: string;
        documents: { docs: Document[]; searchTimeMs: number; cacheHit?: boolean };
      }) => {
        const llmStartTime = Date.now();

        return trace('llm.generate', async () => {
          if (input.documents.docs.length === 0) {
            logger.debug('No documents retrieved');
            return {
              answer: "I couldn't find relevant information to answer your question.",
              tokenUsage: undefined,
              timingMs: Date.now() - llmStartTime,
              cacheHit: false,
            };
          }

          const config = getConfig();
          const cache = config.cacheLLM ? getCache() : null;

          const context = input.documents.docs
            .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
            .join('\n\n');

          if (config.cacheLLM && cache) {
            const cacheInput = { question: input.question, context };
            const cacheHash = hashData(cacheInput);
            const cacheKey = createCacheKey('llm', 'response', cacheHash);

            const cached = await safeCacheGet<string>(cache, cacheKey);
            if (cached) {
              logger.debug(
                { cacheKey, question: input.question.substring(0, 50) },
                'LLM response retrieved from cache'
              );
              return {
                answer: cached,
                tokenUsage: undefined,
                timingMs: Date.now() - llmStartTime,
                cacheHit: true,
              };
            }

            const response = await chain.invoke({
              question: input.question,
              context,
            });

            const answer = response.content as string;
            await safeCacheSet(cache, cacheKey, answer, config.cacheTtl);
            logger.debug({ cacheKey }, 'LLM response cached');

            const responseMetadata = (response as BaseMessage & LLMResponseMetadata)
              .response_metadata;
            let tokenUsage: TokenUsage | undefined = responseMetadata?.usage;

            if (!tokenUsage && responseMetadata) {
              tokenUsage = responseMetadata.token_usage || responseMetadata.usage_metadata;
            }

            if (!tokenUsage) {
              const responseWithMetadata = response as BaseMessage & LLMResponseMetadata;
              tokenUsage = responseWithMetadata.usage || responseWithMetadata.llmOutput?.tokenUsage;
            }

            return {
              answer,
              tokenUsage: tokenUsage
                ? {
                    promptTokens: tokenUsage.promptTokens ?? tokenUsage.prompt_tokens ?? 0,
                    completionTokens:
                      tokenUsage.completionTokens ?? tokenUsage.completion_tokens ?? 0,
                    totalTokens: tokenUsage.totalTokens ?? tokenUsage.total_tokens ?? 0,
                  }
                : undefined,
              timingMs: Date.now() - llmStartTime,
              cacheHit: false,
            };
          }

          const response = await chain.invoke({
            question: input.question,
            context,
          });

          const responseMetadata = (response as BaseMessage & LLMResponseMetadata)
            .response_metadata;
          let tokenUsage: TokenUsage | undefined = responseMetadata?.usage;

          if (!tokenUsage && responseMetadata) {
            tokenUsage = responseMetadata.token_usage || responseMetadata.usage_metadata;
          }

          if (!tokenUsage) {
            const responseWithMetadata = response as BaseMessage & LLMResponseMetadata;
            tokenUsage = responseWithMetadata.usage || responseWithMetadata.llmOutput?.tokenUsage;
          }

          return {
            answer: response.content as string,
            tokenUsage: tokenUsage
              ? {
                  promptTokens: tokenUsage.promptTokens ?? tokenUsage.prompt_tokens ?? 0,
                  completionTokens:
                    tokenUsage.completionTokens ?? tokenUsage.completion_tokens ?? 0,
                  totalTokens: tokenUsage.totalTokens ?? tokenUsage.total_tokens ?? 0,
                }
              : undefined,
            timingMs: Date.now() - llmStartTime,
            cacheHit: false,
          };
        });
      },
    }),
    RunnableLambda.from(
      (input: {
        question: string;
        _queryStartTime: number;
        safety: SafetyCheckResult & { timingMs: number };
        documents: { docs: Document[]; searchTimeMs: number; cacheHit?: boolean };
        answer: {
          answer: string;
          tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
          timingMs: number;
          cacheHit?: boolean;
        };
      }): RAGResponse => {
        const queryStartTime = input._queryStartTime || Date.now();
        const totalTimeMs = Date.now() - queryStartTime;
        const searchTimeMs = input.documents.searchTimeMs || 0;
        const safetyTimeMs = input.safety.timingMs || 0;
        const llmTimeMs = input.answer.timingMs || 0;

        metrics.recordOperation('rag.query.complete', {
          searchTimeMs,
          safetyTimeMs,
          llmTimeMs,
          totalTimeMs,
        });

        let confidence:
          | {
              score: number;
              level: 'high' | 'medium' | 'low' | 'very_low';
              factors?: {
                retrieval: number;
                relevance: number;
                coverage: number;
                answerQuality: number;
              };
              explanation?: string;
            }
          | undefined;

        if (config.confidenceEnabled) {
          try {
            const similarityScores = extractSimilarityScores(input.documents.docs);
            const answerText =
              typeof input.answer === 'string' ? input.answer : input.answer.answer || '';

            const confidenceFactors: ConfidenceFactors = {
              similarityScores,
              documentCount: input.documents.docs.length,
              topK: config.topK,
              answerText,
              retrievalMethod: config.retrieverType,
            };

            const confidenceResult = calculateConfidence(confidenceFactors);

            confidence = {
              score: confidenceResult.overall,
              level: confidenceResult.level,
            };

            if (config.confidenceIncludeFactors) {
              confidence.factors = confidenceResult.factors;
            }

            if (confidenceResult.explanation) {
              confidence.explanation = confidenceResult.explanation;
            }

            logger.debug(
              {
                confidence: confidence.score,
                level: confidence.level,
                factors: confidence.factors,
              },
              'Confidence score calculated'
            );
          } catch (error) {
            logger.warn({ error }, 'Failed to calculate confidence score');
          }
        }

        return {
          user_question: input.question,
          system_answer:
            typeof input.answer === 'string' ? input.answer : input.answer.answer || '',
          chunks_related: input.documents.docs.map((doc: Document, index: number) => {
            const startCharRaw = doc.metadata.startChar ?? doc.metadata.startCharStr;
            const endCharRaw = doc.metadata.endChar ?? doc.metadata.endCharStr;
            const { sourceId, source, ...metadataWithoutSource } = doc.metadata;

            let startChar =
              typeof startCharRaw === 'number'
                ? startCharRaw
                : typeof startCharRaw === 'string'
                  ? parseInt(startCharRaw, 10) || 0
                  : 0;
            let endChar =
              typeof endCharRaw === 'number'
                ? endCharRaw
                : typeof endCharRaw === 'string'
                  ? parseInt(endCharRaw, 10) || 0
                  : 0;

            // Ensure non-zero values: if missing or zero, calculate based on content length
            if (startChar === 0 && endChar === 0) {
              // If both are missing/zero, set startChar to 1 and endChar to content length
              startChar = 1;
              endChar = Math.max(1, doc.pageContent.length);
            } else if (startChar === 0) {
              // If only startChar is missing/zero, set it to 1
              startChar = 1;
            } else if (endChar === 0) {
              // If only endChar is missing/zero, set it to startChar + content length
              endChar = Math.max(startChar + 1, startChar + doc.pageContent.length);
            }

            // Ensure endChar is greater than startChar
            if (endChar <= startChar) {
              endChar = startChar + Math.max(1, doc.pageContent.length);
            }

            const finalSourceId = sourceId || source || 'unknown';
            return {
              id: doc.metadata.id || `chunk-${index}`,
              text: doc.pageContent,
              index,
              startChar,
              endChar,
              sourceId: finalSourceId,
              metadata: metadataWithoutSource,
            };
          }),
          metadata: {
            searchMethod: config.retrieverType,
            topK: input.documents.docs.length,
            model: config.llmModel,
            searchTimeMs: searchTimeMs,
            tokenUsage: input.answer.tokenUsage,
            timings: {
              safetyCheckMs: safetyTimeMs > 0 ? safetyTimeMs : undefined,
              retrievalMs: searchTimeMs,
              llmGenerationMs: llmTimeMs > 0 ? llmTimeMs : undefined,
              totalMs: totalTimeMs,
            },
            cache: {
              retrievalHit: input.documents.cacheHit || false,
              llmHit: input.answer.cacheHit || false,
            },
            confidence,
          },
          safety: {
            safe: input.safety.safe,
            moderationFlagged: input.safety.moderationResult.flagged,
            injectionDetected: input.safety.injectionDetected,
            piiDetected: input.safety.piiDetected.detected,
            flaggedCategories: Object.entries(input.safety.moderationResult.categories)
              .filter(([_, flagged]) => flagged)
              .map(([category]) => category),
          },
        };
      }
    ),
  ]);
}
