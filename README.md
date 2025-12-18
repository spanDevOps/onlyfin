# OnlyFin - AI Financial Assistant

A finance-focused AI chatbot with polished UI/UX, document upload, and knowledge base search.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## ✨ Features

- **Finance-focused conversations** with GPT-4.1-nano
- **Document upload** (PDF, DOCX, TXT, MD) to knowledge base
- **Semantic search** using Qdrant vector database
- **Smart typing animation** (45 CPS) with no flash
- **Citation system** with validation scores
- **Modern UI** with purple gradient theme and Lottie animations

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **AI**: OpenAI GPT-4.1-nano, Vercel AI SDK
- **Vector DB**: Qdrant Cloud (N. Virginia)
- **Document Processing**: pdf-parse, mammoth, tiktoken
- **Animations**: Lottie, custom CSS animations

## 📦 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-nano

# Qdrant (optional - for document upload)
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
QDRANT_COLLECTION=onlyfinance-kb
```

### 3. Run Development Server

```bash
npm run dev
```

## 🎨 UI Features

- **Typing animation**: 45 characters per second with smart delays
- **Thinking/typing indicators**: Fast pulse animation with neon purple icons
- **K-Base sidebar**: Collapsible document manager with drag-and-drop upload
- **Toast notifications**: Purple success messages with fade animation
- **Preset cards**: 8 finance questions in 3-2-3 layout
- **Revenue animation**: Bottom-right Lottie animation (180x180px)

## 📁 Project Structure

```
app/
├── api/
│   ├── chat/route.ts       # Main chat endpoint with KB search
│   ├── upload/route.ts     # Document upload & processing
│   └── kb/route.ts         # KB management (list/delete)
├── page.tsx                # Main chat UI
└── globals.css             # Animations & styles

components/
├── FileUpload.tsx          # Upload button component
└── KBManager.tsx           # Document list component

lib/
├── kb/
│   ├── vector-db.ts        # Qdrant integration
│   ├── text-extractor.ts   # PDF/DOCX/TXT/MD parsing
│   ├── chunker.ts          # Text chunking (500 tokens)
│   ├── validator.ts        # Fact validation
│   └── embeddings.ts       # OpenAI embeddings
├── guards/
│   └── topic-guard.ts      # Finance-only filter
├── citations.ts            # Citation formatting
└── logger.ts               # Structured logging
```

## 🔧 Configuration

### Model Selection

Edit `.env.local`:

```env
OPENAI_MODEL=gpt-4.1-nano  # Fast, reliable, cost-effective
```

### Typing Animation

Edit `app/page.tsx`:

```typescript
const CPS = 45; // Characters per second
```

### Validation Threshold

Edit `lib/kb/vector-db.ts`:

```typescript
filter: {
  validationScore: { $gte: 0.7 } // 70% confidence minimum
}
```

## 📚 Documentation

- **Setup**: See above
- **Architecture**: Modern RAG system with Qdrant + OpenAI
- **Deployment**: Vercel (one-click deploy)

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `QDRANT_URL` (optional)
   - `QDRANT_API_KEY` (optional)
   - `QDRANT_COLLECTION` (optional)
4. Deploy!

## 🎯 Key Features Explained

### Typing Animation
- **No flash**: Uses refs instead of state to prevent React re-renders
- **Smart buffering**: Waits for 10 characters before starting
- **Smooth streaming**: 45 CPS with requestAnimationFrame
- **HMR-safe**: Refs prevent animation restart on hot reload

### Knowledge Base
- **Semantic search**: Vector embeddings for intelligent matching
- **Validation**: LLM-based fact checking with confidence scores
- **Citations**: Every response includes source with validation score
- **In-memory filtering**: Filters by validationScore >= 0.7 after query

### UI/UX
- **Purple theme**: Gradient backgrounds and neon purple accents
- **Fast animations**: 0.8s pulse for thinking/typing indicators
- **Auto-sidebar**: Opens after 1s, stays 3.5s, then closes
- **Toast notifications**: Centered at top with 5s fade animation

## 🐛 Troubleshooting

### Typing animation flashes
- Fixed: Using refs instead of state
- Refs: `animationStartedFor`, `finalTextById`

### Infinite loop error
- Fixed: Converted state to refs in useLayoutEffect

### Qdrant search error
- Fixed: Moved validationScore filter from query to in-memory

### Slow animation
- Fixed: Custom fast-pulse animation (0.8s cycle)

## 📝 License

MIT

## 👤 Author

Built with ❤️ using Next.js, OpenAI, and Qdrant
