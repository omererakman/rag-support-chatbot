# RAG Support Chatbot

A production-ready Retrieval-Augmented Generation (RAG) support chatbot built with LangChain, TypeScript, and modern best practices. This system enables intelligent question-answering over your support documentation with comprehensive error handling, observability, security, and performance optimizations.

## 🚀 Features

### Core Capabilities
- **Modern LangChain Architecture** - Built with LangChain, type-safe chains
- **Multiple Retrieval Strategies** - Similarity search, MMR (Maximum Marginal Relevance), and Contextual Compression
- **Flexible Vector Stores** - ChromaDB or memory store with disk persistence
- **Type-Safe** - Full TypeScript with Zod schema validation throughout
- **Structured Responses** - Rich JSON responses with source citations, metadata, safety information, and confidence scores
- **Answer Confidence Scoring** - Multi-factor confidence scoring to assess answer reliability

### Production-Ready Features
- **Resilience** - Automatic retry with exponential backoff, circuit breakers, and timeout handling
- **Error Handling** - Custom error types with proper error propagation and recovery
- **Performance** - Caching infrastructure (for future use when transitioning from single-run scripts to persistent applications), connection pooling, and batch optimizations
- **Observability** - Structured logging (JSON/text), metrics collection, distributed tracing, and LangChain callbacks
- **Security** - Input sanitization, PII detection/redaction, content moderation, and prompt injection detection

### Safety & Security
- **Content Moderation** - OpenAI moderation API integration
- **PII Detection** - Automatic detection and redaction of personally identifiable information
- **Prompt Injection Protection** - Pattern-based detection of injection attempts
- **Input Sanitization** - Removes dangerous characters and patterns

## 📋 Prerequisites

- **Node.js** 22+
- **npm**
- **Windows users** - Git Bash is recommended for Windows users to run bash commands seamlessly
- **OpenAI API Key** - Required for LLM and embeddings
- **Vector Store** - Choose one:
  - **ChromaDB** (suggested) - See setup instructions below
  - **Memory** (alternative) - No additional setup required, uses in-memory store with disk persistence

### ChromaDB Setup

ChromaDB is the recommended vector store. You can set it up using Docker Compose or Docker directly:

**Using Docker Compose (recommended):**
```bash
# Start ChromaDB using Docker Compose
docker-compose up -d

# Or start in foreground to see logs
docker-compose up

# Stop ChromaDB
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```

The `docker-compose.yml` file includes:
- Persistent data storage
- Health checks for monitoring
- Automatic restart on failure
- Port mapping (8000:8000)

**Alternative: Using Docker directly**
```bash
docker run -p 8000:8000 chromadb/chroma
```

Then configure in `.env`:
```env
VECTOR_STORE_TYPE=chromadb
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

**Note:** If you prefer to use the memory vector store instead, set `VECTOR_STORE_TYPE=memory` in your `.env` file. The memory store persists data to disk in `storage/memory-vector-store.json` for later query usage.

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd rag-support-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your configuration:**
   ```env
   OPENAI_API_KEY=your-api-key-here
   LLM_MODEL=gpt-4o-mini
   EMBEDDING_MODEL=text-embedding-3-small
   VECTOR_STORE_TYPE=chromadb  # or 'memory'
   ```

## 🎯 Quick Start

### 1. Prepare Your Documents

Place your support documentation in the `data/` directory. Supported formats include:
- Plain text files (`.txt`)
- Markdown files (`.md`)
- Other text-based formats

Example:
```bash
data/
├── faq_document.txt
├── any other text documents...
```

### 2. Build the Vector Index

Build the vector index from your documents:

```bash
npm run dev
```

The script defaults to the `./data` directory. To use a custom path:

```bash
npm run dev -- ./path/to/your/documents
```

The script will:
- Load all documents from the specified directory (defaults to `./data`)
- Split them into chunks with configurable size and overlap
- Generate embeddings using OpenAI
- Store embeddings in your configured vector store
  - **ChromaDB**: Stores embeddings in the ChromaDB database
  - **Memory**: Stores embeddings in memory and persists to `storage/memory-vector-store.json` for later query usage

### 3. Query the System

Ask questions using the query script:

```bash
npm run dev:query -- "What is your return policy?"
```

### Example Response

The response includes metadata about the search process, timing information, token usage, cache information (for future use), safety checks, and confidence scoring:

```json
{
  "user_question": "What is your return policy?",
  "system_answer": "We offer a 30-day money-back guarantee for new subscriptions. If you're not satisfied within the first 30 days, you can contact our support team with your order number and reason for the refund request. Refunds are processed within 5-7 business days and will appear on your original payment method. After 30 days, refunds are not available, but you can cancel your subscription at any time.",
  "chunks_related": [
    {
      "id": "chunk-0",
      "text": "What is your refund policy?\nWe offer a 30-day money-back guarantee for new subscriptions. If you're not satisfied with our service within the first 30 days, contact our support team with your order number and reason for the refund request. Refunds are processed within 5-7 business days and will appear on your original payment method. After 30 days, refunds are not available, but you can cancel your subscription at any time. Cancelled subscriptions remain active until the end of the current billing period.",
      "index": 0,
      "startChar": 4183,
      "endChar": 4693,
      "sourceId": "/data/faq_document.txt",
      "metadata": {
        "loc": {
          "lines": {
            "from": 36,
            "to": 37
          }
        },
        "similarityScore": 0.9410361,
        "score": 0.9410361
      }
    },
    {
      "id": "chunk-1",
      "text": "What happens to data when I cancel my subscription?\nWhen you cancel your subscription, your account enters a grace period during which you can export all your data. After the grace period, your account is deactivated, but data is retained for 90 days in case you want to reactivate. After 90 days, data is permanently deleted according to our data retention policy. You can request immediate data deletion if needed.\n\nDOCUMENT MANAGEMENT",
      "index": 1,
      "startChar": 39012,
      "endChar": 39449,
      "sourceId": "/data/faq_document.txt",
      "metadata": {
        "loc": {
          "lines": {
            "from": 292,
            "to": 295
          }
        },
        "similarityScore": 1.3861737,
        "score": 1.3861737
      }
    },
    {
      "id": "chunk-2",
      "text": "What data backup and recovery procedures are in place?\nWe perform automated daily backups of all data, with backups retained for 90 days. Data is stored in multiple geographically distributed data centers for redundancy. In the event of data loss, we can restore data from backups. Recovery time objectives (RTO) and recovery point objectives (RPO) are documented in our SLA. Enterprise customers can request custom backup and retention policies.",
      "index": 2,
      "startChar": 38157,
      "endChar": 38603,
      "sourceId": "/data/faq_document.txt",
      "metadata": {
        "loc": {
          "lines": {
            "from": 286,
            "to": 287
          }
        },
        "similarityScore": 1.4441562,
        "score": 1.4441562
      }
    },
    {
      "id": "chunk-3",
      "text": "What happens if my payment fails?\nIf a payment fails, we'll send you an email notification and attempt to charge your card again after 3 days. You'll have a 7-day grace period to update your payment method. During this time, your account will remain active. If payment is not resolved after 7 days, your account will be suspended, and you'll lose access to all features. To reactivate, simply update your payment method and the account will be restored immediately.",
      "index": 3,
      "startChar": 5107,
      "endChar": 5572,
      "sourceId": "/data/faq_document.txt",
      "metadata": {
        "loc": {
          "lines": {
            "from": 42,
            "to": 43
          }
        },
        "similarityScore": 1.4567606,
        "score": 1.4567606
      }
    },
    {
      "id": "chunk-4",
      "text": "SUPPORT AND HELP\n\nWhat are your business hours?\nOur customer support team is available Monday through Friday, 9 AM to 6 PM Eastern Time. We also offer limited support on weekends from 10 AM to 4 PM Eastern Time. Enterprise customers have access to 24/7 priority support via phone, email, or live chat. For urgent issues outside business hours, Enterprise customers can use our emergency support line. Response times vary by plan: Starter (24-48 hours), Professional (4-8 hours), Enterprise (1-2 hours).",
      "index": 4,
      "startChar": 48398,
      "endChar": 48900,
      "sourceId": "/data/faq_document.txt",
      "metadata": {
        "loc": {
          "lines": {
            "from": 371,
            "to": 374
          }
        },
        "similarityScore": 1.4802177,
        "score": 1.4802177
      }
    }
  ],
  "metadata": {
    "searchMethod": "similarity",
    "topK": 5,
    "model": "gpt-4o-mini",
    "searchTimeMs": 478,
    "tokenUsage": {
      "promptTokens": 554,
      "completionTokens": 81,
      "totalTokens": 635
    },
    "timings": {
      "safetyCheckMs": 490,
      "retrievalMs": 478,
      "llmGenerationMs": 2556,
      "totalMs": 3525
    },
    "cache": {
      "retrievalHit": false,
      "llmHit": false
    },
    "confidence": {
      "score": 0.995872527,
      "level": "high",
      "factors": {
        "retrieval": 0.9882072199999999,
        "relevance": 1,
        "coverage": 1,
        "answerQuality": 1
      },
      "explanation": "highly relevant documents"
    }
  },
  "safety": {
    "safe": true,
    "moderationFlagged": false,
    "injectionDetected": false,
    "piiDetected": false,
    "flaggedCategories": []
  }
}
```

### Sample Queries

The `outputs/sample_queries.json` file contains example query responses demonstrating various scenarios:
- Successful queries with full responses, metadata, and confidence scores
- Error cases showing safety checks (e.g., PII detection and redaction)

## ⚙️ Configuration

All configuration is done via environment variables. See `.env.example` for all available options.

### Provider Configuration

```env
# LLM Provider (currently supports: openai)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Embedding Provider (currently supports: openai)
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here
```

### Chunking Configuration

```env
CHUNK_SIZE=800              # Characters per chunk
CHUNK_OVERLAP=100           # Overlap between chunks
MIN_CHUNKS=20               # Minimum chunks required for index building
```

### Vector Store Configuration

```env
# Options: 'chromadb' or 'memory'
VECTOR_STORE_TYPE=chromadb

# ChromaDB Configuration (only if using chromadb)
CHROMA_COLLECTION_NAME=support_embeddings
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false             # Enable SSL for ChromaDB connection (default: false)
CHROMA_API_KEY=              # Optional, for authenticated ChromaDB instances
```

**Note on Memory Vector Store**: When using `VECTOR_STORE_TYPE=memory`, the vector store persists data to disk in `storage/memory-vector-store.json`. This allows the index built by the indexing script to be available for queries in separate script runs. The data is automatically saved when building the index and automatically loaded when querying.

### Retrieval Configuration

```env
# Options: 'similarity', 'mmr', or 'compression'
RETRIEVER_TYPE=similarity

TOP_K=5                      # Number of documents to retrieve
SCORE_THRESHOLD=0.5          # Minimum similarity score (0-1)

# Reranking (optional)
RERANK_ENABLED=false
RERANK_TOP_N=20             # Documents to rerank
RERANK_TOP_K=5              # Final documents after reranking
```

### Safety Configuration

```env
SAFETY_ENABLED=true          # Enable/disable all safety checks
```

### Confidence Scoring Configuration

```env
CONFIDENCE_ENABLED=true                    # Enable/disable confidence scoring (default: true)
CONFIDENCE_LOW_THRESHOLD=0.4              # Threshold for low confidence (0-1)
CONFIDENCE_MEDIUM_THRESHOLD=0.6            # Threshold for medium confidence (0-1)
CONFIDENCE_HIGH_THRESHOLD=0.8              # Threshold for high confidence (0-1)
CONFIDENCE_INCLUDE_FACTORS=true            # Include factor breakdown in response (default: true)
```

**Confidence Levels:**
- **High** (≥0.8): Highly reliable answer based on relevant documents
- **Medium** (0.6-0.8): Moderately reliable answer
- **Low** (0.4-0.6): Low confidence, answer may be incomplete or uncertain
- **Very Low** (<0.4): Very low confidence, answer may be unreliable

**Confidence Factors:**
- **Retrieval** (35%): Average similarity score of retrieved documents
- **Relevance** (30%): Top document similarity score
- **Coverage** (15%): Document count relative to expected
- **Answer Quality** (20%): Answer length and uncertainty phrase detection

### Cache Configuration

**Note**: The caching module is implemented but reserved for future use. Currently, the application runs as single-run scripts (indexing and querying), where in-memory caching provides no benefit since each script execution starts fresh. Caching will become useful when the application transitions to a persistent application (e.g., a web server or long-running service) where multiple requests can benefit from cached results, or when using a persistent cache provider (e.g., Redis, Memcached) that maintains cache state across script executions.

```env
CACHE_ENABLED=false          # Enable/disable caching (default: false)
CACHE_TTL=3600               # Cache TTL in seconds (default: 3600 = 1 hour)
CACHE_EMBEDDINGS=false       # Cache embedding results (default: false)
CACHE_RETRIEVAL=false        # Cache retrieval results (default: false)
CACHE_LLM=false              # Cache LLM responses (default: false)
```

### Logging Configuration

```env
LOG_LEVEL=info               # Options: debug, info, warn, error
LOG_FORMAT=auto              # Options: json, text, auto (auto uses text in dev, json in prod)
NODE_ENV=development         # Options: development, production, test
```

## 🏗️ Architecture

> 📖 **For detailed architectural decisions and design rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

The system uses LangChain's LCEL (LangChain Expression Language) for composable chain construction:

```
┌─────────────────┐
│  User Question  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Safety Check    │ ◄── Moderation, PII Detection, Injection Detection
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Retrieval     │ ◄── Vector Store Search (Similarity/MMR/Compression)
│  (with scores)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Generation    │ ◄── LLM with Retrieved Context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Confidence     │ ◄── Multi-Factor Confidence Scoring
│   Calculation   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Structured     │
│    Response     │ ◄── Includes confidence metadata
└─────────────────┘
```

### Key Components

- **Safety Chain** - Validates input for moderation, PII, and injection attempts
- **Retrievers** - Multiple retrieval strategies with configurable parameters (extracts similarity scores)
- **Vector Stores** - Pluggable vector store implementations
- **LLM Chain** - Configurable LLM providers with prompt templates
- **Confidence Scoring** - Multi-factor confidence calculation based on retrieval quality, relevance, coverage, and answer quality
- **Monitoring** - Metrics, tracing, and logging throughout the pipeline

### Resilience Features

- **Retry Logic** - Exponential backoff for transient failures
- **Circuit Breakers** - Prevents cascading failures
- **Timeouts** - Prevents hanging operations
- **Error Types** - Custom error types for different failure scenarios

## 📁 Project Structure

```
rag-support-chatbot/
├── src/
│   ├── index.ts                    # Build index entry point
│   ├── query.ts                    # Query pipeline entry point
│   ├── logger.ts                   # Logging configuration
│   ├── config/                     # Configuration management
│   │   ├── env.ts                  # Environment variable loading
│   │   ├── validation.ts           # Config validation
│   │   └── index.ts                # Config exports
│   ├── chains/                     # LangChain chains (LCEL)
│   │   └── rag-chain.ts            # Main RAG chain
│   ├── loaders/                    # Document loaders
│   │   └── directory-loader.ts     # Directory-based loading (supports .txt and .md files)
│   ├── splitters/                  # Text splitting
│   │   └── index.ts                # Text splitter factory (RecursiveCharacterTextSplitter)
│   ├── embeddings/                 # Embedding providers
│   │   ├── providers/
│   │   │   └── openai.ts           # OpenAI embeddings
│   │   └── index.ts                # Embedding factory
│   ├── vector-stores/              # Vector store implementations
│   │   ├── chroma.ts               # ChromaDB implementation
│   │   ├── memory.ts               # In-memory implementation with disk persistence
│   │   ├── memory-vector-store.ts  # Persistence layer for memory vector store
│   │   ├── health.ts               # Health checks
│   │   └── index.ts                # Vector store factory
│   ├── retrievers/                 # Retriever implementations
│   │   ├── similarity.ts           # Similarity search
│   │   ├── mmr.ts                  # Maximum Marginal Relevance
│   │   ├── compression.ts          # Contextual Compression
│   │   └── index.ts                # Retriever factory
│   ├── safety/                     # Safety checks
│   │   ├── moderation.ts           # Content moderation
│   │   ├── pii.ts                  # PII detection/redaction
│   │   ├── injection.ts            # Prompt injection detection
│   │   └── index.ts                # Safety chain
│   ├── llm/                        # LLM providers
│   │   ├── providers/
│   │   │   └── openai.ts           # OpenAI LLM
│   │   └── index.ts                # LLM factory
│   ├── prompts/                    # Prompt templates
│   │   └── rag.ts                  # RAG prompt template
│   ├── utils/                      # Utilities
│   │   ├── errors.ts               # Custom error types
│   │   ├── retry.ts                # Retry logic
│   │   ├── timeout.ts              # Timeout handling
│   │   ├── circuit-breaker.ts      # Circuit breaker pattern
│   │   ├── token-counter.ts        # Token counting
│   │   └── validation.ts           # Validation utilities
│   ├── monitoring/                 # Observability
│   │   ├── metrics.ts              # Metrics collection
│   │   ├── tracing.ts              # Distributed tracing
│   │   └── callbacks.ts            # LangChain callbacks
│   ├── cache/                      # Caching layer
│   │   ├── memory-cache.ts         # In-memory cache implementation
│   │   ├── factory.ts              # Cache factory and configuration
│   │   ├── utils.ts                # Cache utilities (hashing, safe operations)
│   │   └── index.ts                # Cache exports
│   ├── security/                   # Security utilities
│   │   └── sanitization.ts         # Input sanitization
│   └── types/                      # TypeScript types
│       ├── schemas.ts              # Zod schemas
│       └── index.ts                # Type exports
├── data/                           # Source documents (example)
│   └── faq_document.txt
├── outputs/                        # Output files
│   └── sample_queries.json         # Example query responses
├── storage/                        # Runtime data storage (gitignored)
│   └── memory-vector-store.json    # Persisted memory vector store data (created at runtime)
├── tests/                          # Test suite
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   ├── e2e/                        # End-to-end tests
│   └── utils/                      # Test utilities
├── dist/                           # Compiled output (generated)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── eslint.config.js
```

## 🧪 Development

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Type Checking

Check types without building:

```bash
npm run typecheck
```

### Linting

Run ESLint:

```bash
npm run lint
```

### Formatting

Format code with Prettier:

```bash
npm run format
```

### Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## 🚢 Production Deployment

### Prerequisites

1. Set `NODE_ENV=production` in your environment
2. Use ChromaDB for vector storage (`VECTOR_STORE_TYPE=chromadb`)
3. Configure proper logging level (`LOG_LEVEL=info` or `warn`)
4. Ensure all required environment variables are set

### Build for Production

```bash
npm run build
```

### Running in Production

The compiled JavaScript will be in the `dist/` directory. Use a process manager like PM2 or systemd:

**With Node directly:**
```bash
node dist/src/index.js ./data
```


## 📊 Observability

### Logging

The system uses structured logging with Pino:

- **Development**: Human-readable text logs
- **Production**: JSON logs for log aggregation systems
- **Correlation IDs**: Each request gets a unique correlation ID for tracing

### Metrics

Metrics are collected for:
- Operation counts (queries, retrievals, generations)
- Error rates
- Operation timings
- Token usage (prompt, completion, total)

Metrics are logged via structured logging and can be accessed programmatically through the `MetricsCollector` singleton.

### Tracing

Distributed tracing is available for:
- Safety checks
- Retrieval operations
- LLM generation
- End-to-end query processing

## 🔒 Security Features

### Content Moderation
- Uses OpenAI's moderation API to detect harmful content
- Blocks queries containing flagged categories

### PII Detection
- Detects personally identifiable information (emails, phone numbers, SSNs, etc.)
- Automatically redacts PII from queries before processing
- Logs PII detection events

### Prompt Injection Protection
- Pattern-based detection of injection attempts
- Blocks common injection patterns

### Input Sanitization
- Removes dangerous characters and patterns
- Prevents XSS and other injection attacks

## 🐛 Error Handling

The system includes comprehensive error handling:

- **Custom Error Types** - Specific error types for different scenarios
- **Retry Logic** - Automatic retry with exponential backoff for transient failures
- **Circuit Breakers** - Prevents cascading failures when services are down
- **Timeouts** - Prevents hanging operations
- **Error Propagation** - Proper error propagation with context

## 🚀 Future Enhancements

- **Handle LLM Context Window** - Prevent and manage context window overflow
- **Distributed Caching** - Support for persistent cache providers (Redis, Memcached)
- **Web Server/API** - Transition from single-run scripts to a persistent web server or API service


## 📝 License

MIT
