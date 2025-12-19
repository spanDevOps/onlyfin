# Architecture Documentation

## System Overview

OnlyFin is a finance-focused AI chatbot with document upload, knowledge base search, and intelligent UI animations. Built with Next.js 14, OpenAI GPT-4.1-nano, and Qdrant vector database.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js Client (app/page.tsx)                         │ │
│  │  - Chat UI with typing animation (45 CPS)              │ │
│  │  - K-Base sidebar with drag-and-drop upload            │ │
│  │  - Toast notifications                                 │ │
│  │  - Lottie animations                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP POST /api/chat
                            │ { messages: [...] }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Route Layer                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/chat - Main conversation endpoint                │ │
│  │  - Topic guard (finance-only)                          │ │
│  │  - KB search (semantic)                                │ │
│  │  - LLM response with citations                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/upload - Document processing                     │ │
│  │  - Text extraction (PDF/DOCX/TXT/MD)                   │ │
│  │  - Chunking (500 tokens, 50 overlap)                   │ │
│  │  - Validation (LLM-based, 70% threshold)               │ │
│  │  - Embedding generation                                │ │
│  │  - Vector DB storage                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/kb - Knowledge base management                   │ │
│  │  - List documents                                      │ │
│  │  - Delete documents                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OpenAI GPT-4.1-nano                                   │ │
│  │  - Chat completions                                    │ │
│  │  - Embeddings (text-embedding-3-small)                 │ │
│  │  - Validation                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Qdrant Cloud (N. Virginia)                            │ │
│  │  - Vector storage                                      │ │
│  │  - Semantic search                                     │ │
│  │  - Metadata filtering                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Chat Interface (`app/page.tsx`)

**Features**:
- Streaming responses with typing animation (45 CPS)
- No-flash animation using refs instead of state
- Smart buffering (waits for 10 characters)
- HMR-safe (refs prevent restart on hot reload)
- Thinking/typing indicators with fast pulse animation
- K-Base sidebar with auto-open/close behavior
- Toast notifications (purple, centered, 5s fade)
- 8 preset finance question cards (3-2-3 layout)
- Revenue Lottie animation (bottom-right, 180x180px)

**Key Implementation**:
```typescript
// Refs prevent re-renders and flash
const finalTextById = useRef<Record<string, string>>({});
const animationStartedFor = useRef<Set<string>>(new Set());

// 90 CPS typing speed (doubled for faster reading)
const CPS = 90;
const msPerChar = 1000 / CPS;

// Fast pulse animation for indicators
<svg className="animate-fast-pulse text-purple-400">
```

### 2. Chat API (`app/api/chat/route.ts`)

**Flow**:
1. Receive user message
2. Generate query embedding
3. Search Qdrant for relevant documents
4. Filter by validation score (>= 0.7) in-memory
5. Build context with citations
6. Stream LLM response with citations

**Key Features**:
- Uses `searchKnowledgeBase` tool for KB queries
- Integrated topic guard (no separate call)
- Citation formatting with validation scores
- Streaming with Vercel AI SDK

### 3. Upload API (`app/api/upload/route.ts`)

**Pipeline**:
1. Receive file upload
2. Extract text (PDF/DOCX/TXT/MD)
3. Chunk text (500 tokens, 50 overlap)
4. Validate chunks (LLM-based)
5. Generate embeddings
6. Store in Qdrant with metadata

**Validation**:
- Confidence threshold: 0.7 (70%)
- Checks: factual accuracy, logical consistency, completeness
- Returns validation score with each chunk

### 4. Vector Database (`lib/kb/vector-db.ts`)

**Qdrant Integration**:
- Collection: `onlyfinance-kb`
- Dimensions: 1536 (OpenAI text-embedding-3-small)
- Distance: Cosine similarity
- Metadata: filename, fileType, uploadDate, chunkIndex, validationScore

**Search Strategy**:
- Semantic search with top 5 results
- In-memory filtering by validationScore >= 0.7
- Returns content, source, score, validationScore

### 5. Document Processing

**Text Extraction** (`lib/kb/text-extractor.ts`):
- PDF: `pdf-parse`
- DOCX: `mammoth`
- TXT/MD: Native Node.js

**Chunking** (`lib/kb/chunker.ts`):
- Max tokens: 500
- Overlap: 50 tokens
- Preserves sentences
- Uses tiktoken for accurate counting

**Validation** (`lib/kb/validator.ts`):
- LLM-based fact checking
- Confidence scoring (0-1)
- Issue identification
- Reasoning explanation

## Data Flow

### Chat Flow

```
User types message
  ↓
useChat hook captures input
  ↓
POST to /api/chat
  ↓
Generate query embedding
  ↓
Search Qdrant (top 5)
  ↓
Filter by validationScore >= 0.7
  ↓
Build context with citations
  ↓
Stream LLM response
  ↓
Typing animation (45 CPS)
  ↓
Display with citations
```

### Upload Flow

```
User drops file
  ↓
POST to /api/upload
  ↓
Extract text
  ↓
Chunk text (500 tokens)
  ↓
Validate chunks (LLM)
  ↓
Generate embeddings
  ↓
Store in Qdrant
  ↓
Return validation scores
  ↓
Update KB UI
```

## Key Design Decisions

### 1. Typing Animation
**Problem**: Flash of full content before animation starts
**Solution**: Use refs instead of state to prevent React re-renders
**Result**: Smooth animation with no flash, HMR-safe

### 2. Validation Filtering
**Problem**: Qdrant error when filtering by validationScore
**Solution**: Move filter from query to in-memory after results
**Result**: No index required, flexible filtering

### 3. Topic Guard
**Problem**: Extra API call adds latency
**Solution**: Integrate into main LLM prompt
**Result**: Single API call, natural language handling

### 4. Model Selection
**Decision**: GPT-4.1-nano for all operations
**Rationale**: Fast, reliable, cost-effective, excellent quality
**Result**: < 1s first token, smooth streaming

## Performance Characteristics

- **First token**: < 1 second
- **Typing speed**: 90 CPS (fast, engaging)
- **Response style**: Short, Socratic (2-3 sentences)
- **KB search**: ~100-200ms
- **Document upload**: ~10-30s (depends on size)
- **Validation**: ~5-10s per chunk

## Security

- API keys in environment variables
- File type validation (whitelist)
- Size limits (10MB per file)
- Input sanitization
- No sensitive data in logs

## Scalability

- Qdrant free tier: 1GB (5,000-10,000 documents)
- Vercel free tier: Unlimited requests
- OpenAI: Pay-per-use
- Stateless API (horizontal scaling)

## Future Enhancements

- Multi-language support
- Voice interface
- Mobile app
- Advanced analytics
- User authentication
- Document versioning
- Collaborative KB management
