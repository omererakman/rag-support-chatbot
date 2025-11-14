import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import { BaseRetriever } from '@langchain/core/retrievers';
import { Embeddings } from '@langchain/core/embeddings';

class MockEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(_texts: string[]): Promise<number[][]> {
    return _texts.map(() => [0.1, 0.2, 0.3]);
  }

  async embedQuery(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

export function createMockDocument(text: string, metadata?: Record<string, unknown>): Document {
  return new Document({
    pageContent: text,
    metadata: {
      sourceId: 'test-source',
      ...metadata,
    },
  });
}

export function createMockDocuments(count: number): Document[] {
  return Array.from({ length: count }, (_, i) =>
    createMockDocument(`Test document ${i + 1}`, { id: `doc-${i}` })
  );
}

export class MockVectorStore extends VectorStore {
  private documents: Document[] = [];
  _vectorstoreType(): string {
    return 'mock';
  }

  constructor() {
    const embeddings = new MockEmbeddings();
    super(embeddings, {});
  }

  async addDocuments(docs: Document[]): Promise<string[]> {
    this.documents.push(...docs);
    return docs.map((_, i) => `id-${i}`);
  }

  async addVectors(_vectors: number[][], documents: Document[]): Promise<string[]> {
    this.documents.push(...documents);
    return documents.map((_, i) => `id-${i}`);
  }

  async similaritySearch(_query: string, k?: number): Promise<Document[]> {
    return this.documents.slice(0, k || 5);
  }

  async similaritySearchWithScore(_query: string, k?: number): Promise<[Document, number][]> {
    return this.documents.slice(0, k || 5).map((doc, i) => [doc, 1.0 - i * 0.1]);
  }

  async similaritySearchVectorWithScore(_query: number[], k?: number): Promise<[Document, number][]> {
    return this.documents.slice(0, k || 5).map((doc, i) => [doc, 1.0 - i * 0.1]);
  }
}

export class MockRetriever extends BaseRetriever {
  private documents: Document[] = [];
  lc_namespace = ['test', 'MockRetriever'];

  constructor(documents: Document[] = []) {
    super({});
    this.documents = documents;
  }

  async _getRelevantDocuments(_query: string): Promise<Document[]> {
    return this.documents;
  }
}
