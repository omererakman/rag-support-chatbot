#!/usr/bin/env node

import { createVectorStore } from './vector-stores/index.js';
import { createRAGChain } from './chains/rag-chain.js';
import { validateConfig } from './config/validation.js';
import { logger } from './logger.js';
import { generateCorrelationId } from './logger.js';
import { RAGError } from './utils/errors.js';
import { trace } from './monitoring/tracing.js';
import { validateStringInput } from './utils/validation.js';

async function query(question: string) {
  const correlationId = generateCorrelationId();

  let validatedQuestion: string;
  try {
    validatedQuestion = validateStringInput(question);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid input';
    logger.error({ correlationId, error: errorMessage }, 'Invalid input');
    throw new RAGError(
      errorMessage,
      'VALIDATION_ERROR',
      400,
      error instanceof Error ? error : undefined
    );
  }

  logger.debug(
    { correlationId, question: validatedQuestion.substring(0, 100) },
    'Processing query'
  );

  try {
    await validateConfig();

    logger.debug('Loading vector store...');
    const vectorStore = await createVectorStore();

    logger.debug('Creating RAG chain...');
    const ragChain = createRAGChain(vectorStore);

    logger.debug('Processing query...');
    const response = await trace('rag.query', async () => {
      return await ragChain.invoke({ question: validatedQuestion });
    });

    console.log(JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    if (error instanceof RAGError) {
      logger.error({ correlationId, error: error.message, code: error.code }, 'RAG error occurred');
    } else {
      logger.error({ correlationId, error }, 'Unexpected error occurred');
    }
    throw error;
  }
}

const question = process.argv[2];
if (!question) {
  console.error("Usage: npm run dev:query -- 'Your question here'");
  process.exit(1);
}

query(question)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Query failed:', error.message);
    process.exit(1);
  });
