# Architecture Document

This document describes the architectural decisions and design rationale for the RAG Support Chatbot system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Text Chunking Strategy](#text-chunking-strategy)
3. [Vector Store Architecture](#vector-store-architecture)
4. [Embedding Strategy](#embedding-strategy)
5. [Retrieval Methods](#retrieval-methods)
6. [LLM Integration](#llm-integration)
7. [Answer Confidence Scoring](#answer-confidence-scoring)
8. [Safety & Security](#safety--security)
9. [Caching Strategy](#caching-strategy)
10. [Resilience & Reliability](#resilience--reliability)
11. [Observability](#observability)
12. [Chain Architecture (LCEL)](#chain-architecture-lcel)

---

## System Overview

The RAG Support Chatbot is built using LangChain's LCEL (LangChain Expression Language) to create a composable, type-safe pipeline for question-answering over support documentation. The system follows a modular architecture where each component can be independently configured, tested, and replaced.

### Design Principles

- **Modularity**: Each component (loaders, splitters, embeddings, retrievers, LLMs) is independently configurable
- **Type Safety**: Full TypeScript with Zod schema validation throughout
- **Resilience**: Built-in retry logic, circuit breakers, and timeout handling
- **Observability**: Comprehensive logging, metrics, and distributed tracing
- **Security**: Multi-layered safety checks and input sanitization
- **Performance**: Configurable caching at multiple levels

---

## Text Chunking Strategy

### Recursive Character Text Splitter

**Why Recursive Chunking?**

The system uses `RecursiveCharacterTextSplitter` from LangChain, which implements a hierarchical splitting strategy. This approach was chosen over simpler alternatives (like fixed-size chunking) for several critical reasons:

#### 1. **Preserves Semantic Boundaries**

Recursive chunking respects natural text boundaries by attempting to split on separators in order of preference:
- `\n\n` (paragraph breaks)
- `\n` (line breaks)
- `. ` (sentence endings)
- `! ` (exclamation endings)
- `? ` (question endings)
- ` ` (word boundaries)

This ensures that chunks maintain semantic coherence rather than arbitrarily cutting sentences or paragraphs in half.

#### 2. **Handles Variable Document Structures**

Support documentation often contains:
- FAQs with question-answer pairs
- Multi-paragraph explanations
- Lists and bullet points
- Code snippets or technical specifications

Recursive chunking adapts to these structures by finding the most appropriate split point at each level, making it more robust than fixed-size chunking.

#### 3. **Maintains Context with Overlap**

The system uses configurable chunk overlap (default: 100 characters) to ensure continuity between chunks. This is critical because:
- Questions may reference information that spans chunk boundaries
- Context from adjacent chunks helps the LLM generate more accurate answers
- Overlap prevents loss of information at split points

#### 4. **Character Position Tracking**

The implementation extends the base splitter to track character positions (`startChar`, `endChar`) in the original document. This enables:
- Precise source citation in responses
- Debugging and traceability
- Future features like highlighting relevant sections

#### Configuration

- **Chunk Size**: 800 characters (default) - balances context size with embedding model limits
- **Chunk Overlap**: 100 characters (default) - ensures continuity without excessive redundancy
- **Minimum Chunks**: 20 (default) - ensures sufficient data for meaningful retrieval

**Trade-offs Considered:**
- **Smaller chunks** (400-500 chars): Better precision but may lose context
- **Larger chunks** (1200-1500 chars): More context but may dilute relevance
- **Current choice** (800 chars): Optimal balance for support documentation

---

## Vector Store Architecture

### Dual Implementation Strategy

The system supports two vector store implementations, each optimized for different use cases:

#### 1. ChromaDB (Production)

**Why ChromaDB?**

- **Production-Ready**: Designed for production workloads with persistence, scalability, and reliability
- **Performance**: Optimized for fast similarity search with efficient indexing
- **Scalability**: Can handle large document collections and concurrent queries
- **Features**: Built-in collection management, metadata filtering, and health checks
- **Deployment**: Can run as a separate service (Docker) or embedded

**Configuration:**
- Collection-based organization for easy management
- Configurable host/port for distributed deployments
- Optional SSL and API key authentication for security
- Health checks for monitoring and reliability

#### 2. Memory Vector Store (Development)

**Why Memory Store?**

- **Zero Dependencies**: No external services required for development
- **Fast Iteration**: Instant startup, no setup overhead
- **Disk Persistence**: Automatically saves to `storage/memory-vector-store.json` for persistence across runs
- **Testing**: Ideal for unit tests and local development

**Persistence Strategy:**
- Automatically saves embeddings when building the index
- Automatically loads from disk when querying (if no documents provided)
- Allows separation of indexing and querying workflows

**Trade-offs:**
- **ChromaDB**: Better for production but requires infrastructure
- **Memory**: Simpler for development but limited by RAM

---

## Embedding Strategy

### OpenAI Embeddings

**Why OpenAI Embeddings?**

The system uses OpenAI's `text-embedding-3-small` model (configurable) for the following reasons:

#### 1. **Quality & Performance**

- **State-of-the-art**: OpenAI embeddings consistently rank highly in benchmarks
- **Semantic Understanding**: Captures semantic relationships, not just keyword matching
- **Multilingual Support**: Handles various languages effectively
- **Domain Adaptation**: Works well across different domains without fine-tuning

#### 2. **Consistency**

- Same provider as LLM ensures compatibility
- Unified API key management simplifies deployment
- Consistent rate limits and error handling

#### 3. **Cost-Effectiveness**

- `text-embedding-3-small` provides excellent quality-to-cost ratio
- Efficient token usage reduces API costs
- Configurable model allows cost optimization

#### 4. **Reliability**

- Production-grade API with high uptime
- Comprehensive error handling and retry logic
- Rate limit management built-in

**Model Choice Rationale:**
- **text-embedding-3-small**: Default choice - best balance of quality, speed, and cost
- **text-embedding-3-large**: Available for higher quality requirements (higher cost)
- **ada-002**: Legacy option (deprecated in favor of v3 models)

**Future Extensibility:**
The architecture supports adding other embedding providers (e.g., Cohere, HuggingFace) through the factory pattern without changing core logic.

---

## Retrieval Methods

The system supports three retrieval strategies, each optimized for different scenarios:

### 1. Similarity Search (Default)

**Why Similarity Search?**

- **Simplicity**: Direct cosine similarity between query and document embeddings
- **Speed**: Fastest retrieval method with minimal computation
- **Predictability**: Deterministic results for the same query
- **Baseline Performance**: Excellent for most support documentation queries

**Use Cases:**
- General FAQ queries
- Straightforward question-answer matching
- When speed is critical

**Configuration:**
- `topK`: Number of documents to retrieve (default: 5)
- `scoreThreshold`: Minimum similarity score (default: 0.5)

### 2. Maximum Marginal Relevance (MMR)

**Why MMR?**

MMR balances relevance with diversity by selecting documents that are:
- Similar to the query (relevance)
- Different from already-selected documents (diversity)

**Benefits:**
- **Reduces Redundancy**: Avoids retrieving multiple chunks with the same information
- **Broader Coverage**: Ensures different aspects of the query are covered
- **Better Context**: Provides more diverse context to the LLM

**Use Cases:**
- Complex queries requiring multiple perspectives
- When documents have high redundancy
- Multi-faceted questions

**Configuration:**
- `fetchK`: Initial candidate pool (default: `topK * 2`)
- `lambda`: Diversity vs relevance trade-off (0.5 = balanced)

**Trade-off:**
- Slightly slower than similarity search due to diversity calculation
- More computation but better result quality for complex queries

### 3. Contextual Compression

**Why Contextual Compression?**

This method uses an LLM to extract only the relevant parts of retrieved documents, reducing noise and focusing on query-specific information.

**Benefits:**
- **Precision**: Removes irrelevant content from chunks
- **Token Efficiency**: Reduces prompt size by filtering out unnecessary text
- **Quality**: Improves LLM answer quality by focusing on relevant context

**How It Works:**
1. Base retriever (similarity or MMR) fetches initial candidates
2. LLM analyzes each document and extracts only relevant portions
3. Compressed documents are passed to the final LLM

**Use Cases:**
- Long documents with mixed content
- When chunks contain significant irrelevant information
- Token-constrained scenarios

**Trade-offs:**
- **Cost**: Additional LLM calls increase API costs
- **Latency**: Slower due to compression step
- **Quality**: Can improve answer quality significantly

**Implementation:**
- Uses `LLMChainExtractor` to compress documents
- Custom prompt ensures only relevant content is extracted
- Falls back gracefully if compression fails

---

## LLM Integration

### OpenAI Chat Models

**Why OpenAI?**

- **Quality**: State-of-the-art language understanding and generation
- **Reliability**: Production-grade API with high availability
- **Features**: Rich response metadata (token usage, timing)
- **Ecosystem**: Excellent LangChain integration


**Prompt Design:**

The system uses a structured prompt template that:
- Sets clear role (support assistant)
- Provides context from retrieved documents
- Instructs the model to be concise and accurate
- Handles cases where context is insufficient

---

## Answer Confidence Scoring

### Multi-Factor Composite Score

The system implements a comprehensive confidence scoring mechanism to assess the reliability of generated answers. This helps users understand how trustworthy each response is and enables downstream systems to make informed decisions about answer quality.

**Why Confidence Scoring?**

- **Transparency**: Users can see how reliable an answer is before trusting it
- **Quality Control**: Low confidence answers can trigger human review or alternative strategies
- **User Experience**: Visual indicators (colors, badges) can guide user attention
- **Monitoring**: Track answer quality trends over time
- **Decision Making**: Automated systems can route low-confidence queries to human agents

### Scoring Methodology

The confidence score is calculated using a weighted composite of four factors:

#### 1. Retrieval Quality Score (35% weight)

**Purpose**: Measures how relevant the retrieved documents are to the query.

**Calculation**: Average similarity score of all retrieved documents
- Formula: `avgSimilarity = sum(similarityScores) / count(documents)`
- Range: 0.0 - 1.0 (cosine similarity)
- Higher scores indicate more relevant document retrieval

**Rationale**: If retrieved documents are highly similar to the query, the answer is more likely to be accurate.

#### 2. Relevance Score (30% weight)

**Purpose**: Measures the quality of the best-matching document.

**Calculation**: Maximum similarity score among retrieved documents
- Formula: `relevanceScore = max(similarityScores)`
- Range: 0.0 - 1.0
- Indicates the strength of the top match

**Rationale**: The top document's relevance is a strong indicator of answer quality. If the best match is highly relevant, the answer is likely accurate.

#### 3. Coverage Score (15% weight)

**Purpose**: Measures whether sufficient context was retrieved.

**Calculation**: Ratio of retrieved documents to expected documents
- Formula: `coverageScore = min(1.0, retrievedCount / topK)`
- Range: 0.0 - 1.0
- 1.0 means all expected documents were retrieved

**Rationale**: Incomplete context coverage may indicate missing information or retrieval issues.

#### 4. Answer Quality Score (20% weight)

**Purpose**: Analyzes answer characteristics for quality indicators.

**Calculation**: Based on answer length and uncertainty phrase detection
- **Length Factor**: Very short answers (<20 chars) or very long answers (>2000 chars) reduce score
- **Uncertainty Detection**: Detects phrases like "I couldn't find", "may", "might", "possibly", "uncertain"
- **No Information Pattern**: Detects responses indicating no relevant information found
- Range: 0.0 - 1.0

**Uncertainty Phrases Detected:**
- "I couldn't find", "I don't know", "I'm not sure"
- "I cannot", "I can't"
- "unclear", "uncertain"
- "based on limited information"
- "may not be", "might not", "possibly", "perhaps", "maybe"

**Rationale**: Answer characteristics provide signals about confidence. Uncertainty phrases and inappropriate length indicate lower confidence.

### Composite Score Calculation

```typescript
confidenceScore = (
  retrievalScore * 0.35 +      // 35% - Most important
  relevanceScore * 0.30 +      // 30% - Top match quality
  coverageScore * 0.15 +       // 15% - Context completeness
  answerQualityScore * 0.20    // 20% - Answer characteristics
)
```

### Confidence Levels

The composite score is mapped to confidence levels using configurable thresholds:

- **High** (≥0.8): Highly reliable answer based on highly relevant documents
- **Medium** (0.6-0.8): Moderately reliable answer
- **Low** (0.4-0.6): Low confidence, answer may be incomplete or uncertain
- **Very Low** (<0.4): Very low confidence, answer may be unreliable

**Default Thresholds:**
- Low: 0.4
- Medium: 0.6
- High: 0.8

### Similarity Score Extraction

**Implementation Strategy:**

1. **Similarity Search**: Uses `similaritySearchWithScore` when available from vector stores
2. **MMR Search**: Extracts scores from similarity search and maps to MMR results
3. **Compression**: Preserves scores through compression step
4. **Fallback**: Uses default score (0.5) when scores unavailable (e.g., cached responses)

**Score Storage:**
- Scores are attached to document metadata as `similarityScore` and `score` (for compatibility)
- Scores propagate through the retrieval pipeline


### Response Format

Confidence is included in response metadata:

```json
{
  "metadata": {
    "confidence": {
      "score": 0.82,
      "level": "high",
      "factors": {
        "retrieval": 0.85,
        "relevance": 0.92,
        "coverage": 1.0,
        "answerQuality": 0.75
      },
      "explanation": "highly relevant documents"
    }
  }
}
```

**Fields:**
- `score`: Overall confidence score (0-1)
- `level`: Confidence level enum (high/medium/low/very_low)
- `factors`: Breakdown of individual factor scores (optional, configurable)
- `explanation`: Human-readable explanation (always included)

### Configuration

**Environment Variables:**
- `CONFIDENCE_ENABLED`: Enable/disable confidence scoring (default: true)
- `CONFIDENCE_LOW_THRESHOLD`: Low confidence threshold (default: 0.4)
- `CONFIDENCE_MEDIUM_THRESHOLD`: Medium confidence threshold (default: 0.6)
- `CONFIDENCE_HIGH_THRESHOLD`: High confidence threshold (default: 0.8)

**Validation:**
- Thresholds must be ordered: LOW < MEDIUM < HIGH
- All thresholds must be between 0.0 and 1.0

### Performance Impact

- **Computation**: Lightweight (simple arithmetic operations)
- **Overhead**: < 5ms per query
- **No API Calls**: Pure calculation, no external dependencies
- **Scalability**: No impact on system scalability


### Future Enhancements

Potential improvements:
- **LLM-Based Confidence**: Use LLM to assess its own confidence
- **Learning from Feedback**: Adjust weights based on user feedback
- **Per-Domain Thresholds**: Different thresholds for different domains
- **Confidence Calibration**: Calibrate scores based on actual accuracy
- **Historical Context**: Consider confidence trends over time

---

## Safety & Security

The system implements a multi-layered safety approach to protect against various threats:

### 1. Content Moderation

**Why OpenAI Moderation API?**

- **Comprehensive**: Detects multiple categories of harmful content
- **Accurate**: State-of-the-art moderation models
- **Fast**: Low latency for real-time blocking
- **Maintained**: Continuously updated by OpenAI

**Categories Detected:**
- Hate speech, harassment, violence
- Sexual content
- Self-harm content
- Illegal activities

**Failure Mode:**
- **Fail-open**: If moderation API fails, allows query (logged)
- **Rationale**: Better to allow legitimate queries than block service entirely
- **Monitoring**: All failures are logged for investigation

### 2. PII Detection & Redaction

**Why Pattern-Based PII Detection?**

- **Privacy Protection**: Prevents PII from being stored or logged
- **Compliance**: Helps meet GDPR, CCPA, and other privacy regulations
- **User Trust**: Protects user data from exposure

### 3. Prompt Injection Detection

**Why Pattern-Based Detection?**

- **Speed**: Instant detection without API calls
- **Cost**: No additional costs
- **Coverage**: Detects common injection patterns

---

## Caching Strategy

### Multi-Level Caching

**Current Status**: The caching module is implemented but reserved for future use. Currently, the application runs as single-run scripts (indexing and querying), where in-memory caching provides no benefit since each script execution starts with a fresh process. Caching will become valuable when the application transitions to a persistent application (e.g., a web server or long-running service) where multiple requests can benefit from cached results across the application's lifetime, or when using a persistent cache provider (e.g., Redis, Memcached) that maintains cache state across script executions.

The system supports configurable caching at three levels to reduce costs and improve performance:

#### 1. Embedding Cache

Caches document embeddings to avoid redundant API calls. Cache key includes document content hash and model name.

#### 2. Retrieval Cache

Caches vector store query results for repeated questions. Cache key includes query hash, retriever type, and `topK` parameter. Default TTL: 1 hour.

#### 3. LLM Response Cache

Caches LLM responses for identical question-context pairs. Cache key includes question hash, context hash, and model name.

### Cache Implementation

Uses in-memory cache for speed and simplicity. Supports TTL-based expiration and periodic cleanup. Architecture allows extending to distributed caches (Redis, Memcached) via factory pattern.

---

## Resilience & Reliability

### 1. Retry Logic with Exponential Backoff

Implements exponential backoff retry for transient failures (rate limits, network issues, server errors). Default: 3 retries with 1s initial delay, max 10s delay, 2x multiplier. Only retries retryable errors (429, 502, 503, network errors), not client errors (4xx).

### 2. Circuit Breaker Pattern

Prevents cascading failures by blocking requests when services fail. States: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing recovery). Default: 5 failure threshold, 60s reset timeout.

### 3. Timeout Handling

Prevents hanging operations with configurable timeouts: Moderation API (10s), Embedding API (30s default), LLM API (60s default), Vector Store (10s default).

### 4. Error Types

Custom error types (`ConfigurationError`, `SafetyCheckError`, `VectorStoreError`, `RetrievalError`, `LLMError`) enable appropriate error handling and debugging.

---

## Observability

### 1. Structured Logging

Uses Pino for fast, structured JSON logging. Supports DEBUG, INFO, WARN, ERROR levels. Development uses human-readable format, production uses JSON for log aggregation. Includes correlation IDs and contextual metadata.

### 2. Metrics Collection

Tracks operation counts, error rates, timings (p50, p95, p99), token usage, and cache hit rates via singleton `MetricsCollector`. Can be extended to export to Prometheus, Datadog, etc.

### 3. Distributed Tracing

Tracks request flow through the system with correlation IDs and nested spans. Traces safety checks, retrieval operations, LLM generation, and end-to-end query processing.

### 4. LangChain Callbacks

Integrates with LangChain's native callback system to log LLM inputs, outputs, token usage, model parameters, and timing information.

---

## Chain Architecture (LCEL)

### LangChain Expression Language (LCEL)

Uses LCEL for composable, type-safe chains with built-in streaming support. The RAG chain is built using `RunnableSequence` with stages: input assignment, safety check, safety validation, retrieval (with caching), generation (with caching), and response formatting.

**Chain Structure Rationale:**
- Early validation: Safety checks before expensive operations
- Transparent caching integration
- Natural error propagation
- Independent stage observability

Uses `RunnablePassthrough` pattern for state accumulation, conditional logic, and side effects (logging, metrics, caching).

---

## Configuration Management

Uses Zod schema validation for runtime type safety, clear error messages, and sensible defaults. Configuration via environment variables for security (secrets not in code), flexibility across environments, and easy container/orchestrator deployment.

**Configuration Categories:**
- Provider (LLM, embeddings)
- Chunking (size, overlap, minimum chunks)
- Vector Store (type, connection)
- Retrieval (method, topK, thresholds)
- Confidence Scoring (enable/disable, thresholds, factors)
- Safety (enable/disable checks)
- Cache (enable/disable, TTL, scope)
- Logging (level, format, environment)
