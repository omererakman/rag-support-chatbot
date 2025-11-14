#!/usr/bin/env node

import { loadDocumentsFromDirectory } from './loaders/directory-loader.js';
import { createTextSplitter } from './splitters/index.js';
import { createVectorStore } from './vector-stores/index.js';
import { getConfig } from './config/index.js';
import { validateConfig } from './config/validation.js';
import { logger } from './logger.js';
import { ConfigurationError } from './utils/errors.js';

async function buildIndex() {
  try {
    logger.info('🚀 Starting index building process...');

    await validateConfig();

    const config = getConfig();
    const dataPath = process.argv[2] || './data';

    logger.info({ path: dataPath }, 'Loading documents...');
    const documents = await loadDocumentsFromDirectory(dataPath);

    if (documents.length === 0) {
      throw new ConfigurationError(`No documents found in ${dataPath}`);
    }

    logger.info('Splitting documents...');
    const splitter = createTextSplitter();
    const splitDocs = await splitter.splitDocuments(documents);

    if (splitDocs.length < config.minChunks) {
      throw new ConfigurationError(
        `Insufficient chunks: ${splitDocs.length} < ${config.minChunks}. ` +
          `Consider reducing chunkSize or adding more documents.`
      );
    }

    logger.info('Creating vector store...');
    await createVectorStore(splitDocs);

    logger.info(
      {
        chunks: splitDocs.length,
        vectorStoreType: config.vectorStoreType,
        documents: documents.length,
      },
      '✅ Index built successfully!'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to build index');
    process.exit(1);
  }
}

buildIndex();
