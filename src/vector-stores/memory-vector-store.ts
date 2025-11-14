import { promises as fs } from 'fs';
import { join } from 'path';
import { Document } from '@langchain/core/documents';
import { logger } from '../logger.js';

const STORAGE_DIR = join(process.cwd(), 'storage');
const MEMORY_STORE_FILE = join(STORAGE_DIR, 'memory-vector-store.json');

interface StoredDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
}

interface StoredVectorStore {
  documents: StoredDocument[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

const CURRENT_VERSION = '1.0.0';

/**
 * Ensures the storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    logger.debug({ path: STORAGE_DIR }, 'Created storage directory');
  }
}

/**
 * Saves documents to disk for persistence
 */
export async function saveMemoryVectorStore(documents: Document[]): Promise<void> {
  try {
    await ensureStorageDir();

    const storedData: StoredVectorStore = {
      documents: documents.map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      })),
      version: CURRENT_VERSION,
      createdAt: (await getStoredData())?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(MEMORY_STORE_FILE, JSON.stringify(storedData, null, 2), 'utf-8');
    logger.debug(
      { documentCount: documents.length, path: MEMORY_STORE_FILE },
      'Saved memory vector store to disk'
    );
  } catch (error) {
    logger.error({ error, path: MEMORY_STORE_FILE }, 'Failed to save memory vector store');
    throw error;
  }
}

/**
 * Loads documents from disk
 */
export async function loadMemoryVectorStore(): Promise<Document[] | null> {
  try {
    await fs.access(MEMORY_STORE_FILE);
    const fileContent = await fs.readFile(MEMORY_STORE_FILE, 'utf-8');
    const storedData: StoredVectorStore = JSON.parse(fileContent);

    if (storedData.version !== CURRENT_VERSION) {
      logger.warn(
        { storedVersion: storedData.version, currentVersion: CURRENT_VERSION },
        'Version mismatch in stored data, may need to rebuild index'
      );
    }

    const documents = storedData.documents.map(
      (doc) => new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
    );

    logger.debug(
      { documentCount: documents.length, path: MEMORY_STORE_FILE },
      'Loaded memory vector store from disk'
    );

    return documents;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      logger.debug({ path: MEMORY_STORE_FILE }, 'No stored memory vector store found');
      return null;
    }
    logger.error({ error, path: MEMORY_STORE_FILE }, 'Failed to load memory vector store');
    throw error;
  }
}

async function getStoredData(): Promise<StoredVectorStore | null> {
  try {
    await fs.access(MEMORY_STORE_FILE);
    const fileContent = await fs.readFile(MEMORY_STORE_FILE, 'utf-8');
    return JSON.parse(fileContent) as StoredVectorStore;
  } catch {
    return null;
  }
}

export async function hasStoredMemoryVectorStore(): Promise<boolean> {
  try {
    await fs.access(MEMORY_STORE_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function deleteMemoryVectorStore(): Promise<void> {
  try {
    await fs.unlink(MEMORY_STORE_FILE);
    logger.debug({ path: MEMORY_STORE_FILE }, 'Deleted stored memory vector store');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      logger.error({ error, path: MEMORY_STORE_FILE }, 'Failed to delete memory vector store');
      throw error;
    }
  }
}
