# Changelog

## Sunday, 14 December 2025, 22:15 IST

### Premium UI Redesign with Full-Width Layout and Enhanced Typography

**Why**: User requested modern, premium UI with full-screen utilization, better typography, refined spacing, and polished loading animations.

**What**: Complete UI overhaul with full-width layout, Inter font, refined message styling, and premium loading animation.

**Changes**:
- **Full-Width Layout**: Removed max-width constraints, messages now use entire screen width
- **Enhanced Typography**: Added Inter font from Google Fonts with proper font-face configuration
- **Refined Message Styling**: 
  - Reduced message background height with more rounded corners (rounded-2xl)
  - Removed background from assistant messages (clean, minimal look)
  - Smaller font sizes throughout (text-sm for most content)
  - Better line spacing and padding
- **Premium Loading Animation**: 
  - Replaced simple dots with sophisticated spinner + pulsing dots + "Thinking..." text
  - Animated circular spinner with gradient border
  - Staggered pulse animation for dots
- **Improved Header**: 
  - Reduced header height and font sizes
  - Added backdrop blur effects
  - More subtle borders and shadows
- **Enhanced Input Area**: 
  - Rounded input field (rounded-2xl)
  - Backdrop blur effects
  - Better button styling
- **Better Visual Hierarchy**: 
  - Refined spacing between elements
  - More subtle color variations
  - Enhanced focus states and transitions

**Technical Details**:
- Inter font loaded via Next.js Google Fonts with CSS variables
- Updated Tailwind config to include Inter in font family
- Backdrop blur effects using Tailwind's backdrop-blur utilities
- CSS custom properties for consistent theming
- Improved responsive design with better mobile experience

---

## Sunday, 14 December 2025, 20:00 IST

### Comprehensive Debug Logging System

**Why**: Need full visibility into application behavior for debugging, monitoring, and performance analysis. Track all API requests, LLM interactions, tool calls, and errors.

**What**: Implemented comprehensive logging system with file-based logs (in development) and console logs (in production edge runtime).

**Changes**:
- Created `lib/logger.ts` with singleton Logger class
- Added log levels: DEBUG, INFO, WARN, ERROR
- Implemented specialized logging methods: apiRequest, apiResponse, llmRequest, llmResponse, toolCall, toolResult, userMessage, assistantMessage, performanceMetric
- Integrated logging throughout `/api/chat` route
- Logs all incoming requests, user messages, LLM requests/responses, tool invocations, and performance metrics
- Daily log files in `logs/` folder (format: `app-YYYY-MM-DD.log`)
- Added `logs/` to `.gitignore`
- Note: Edge runtime uses console logging; for file logging, switch to Node.js runtime

**Technical Details**:
- Structured log entries with timestamp, level, category, message, data, and error
- Non-blocking async file writes
- Automatic logs directory creation
- JSON serialization for complex data
- Performance tracking for all API calls

---

## Sunday, 14 December 2025, 19:45 IST

### Multi-Model LLM Support with Latest GPT-5 and Mistral Large 3

**Why**: Consulted Perplexity AI for latest model recommendations (Dec 2025). Need to use cutting-edge models (GPT-5-mini, GPT-5.2, Mistral Large 3) instead of outdated GPT-4 Turbo, with fallback capability for production reliability.

**What**: Upgraded to latest OpenAI GPT-5 family models and added Mistral Large 3 as backup provider with environment-variable switching.

**Changes**:
- Updated default model from `gpt-4-turbo` to `gpt-5-mini` (Perplexity recommendation: fast + reliable for function calling)
- Added support for `gpt-5.2` (best quality) and `gpt-4.1` (non-reasoning) via environment variable
- Integrated Mistral Large 3 (`mistral-large-latest`) as backup provider
- Added `getModel()` function for dynamic model selection based on `LLM_PROVIDER` env var
- Installed `@ai-sdk/mistral` package for Mistral integration
- Updated `.env.local` with model selection options and Mistral API key placeholder
- Updated `docs/SETUP.md` with latest model information and configuration guide
- Consulted Perplexity AI via letter for industry best practices on model selection

**Technical Details**:
- Environment variables: `LLM_PROVIDER` (openai/mistral), `OPENAI_MODEL` (gpt-5-mini/gpt-5.2/gpt-4.1)
- Fallback strategy: Manual provider switching via env var (automatic failover can be added later)
- All models support function calling and streaming (verified by Perplexity)

---

## Sunday, 14 December 2025, 19:10 IST

### AskRivo - Anti-Calculator (Initial Build)

**Why**: Build a conversational mortgage assistant that replaces traditional calculators with natural AI dialogue for UAE property decisions.

**What**: Complete Next.js 14 application with AI-powered conversational interface using OpenAI GPT-4 and Vercel AI SDK, featuring anti-hallucination architecture with deterministic calculation tools.

**Changes**:
- Created Next.js 14 project with App Router and TypeScript
- Implemented 4 core mortgage calculation tools in `lib/mortgage-tools.ts`:
  - `calculateEMI`: Monthly payment calculation using standard EMI formula
  - `calculateUpfrontCosts`: 7% UAE transaction fees breakdown
  - `calculateMaxLoan`: 80% LTV rule for expats
  - `compareRentVsBuy`: Decision logic with time-based heuristics
- Built API route `/api/chat` with Vercel AI SDK streaming and function calling
- Designed conversational UI with streaming responses and tool call indicators
- Configured OpenAI GPT-4 with system prompt optimized for UAE mortgage guidance
- Added Zod schemas for type-safe tool parameter validation
- Implemented edge runtime for fast cold starts
- Created comprehensive documentation (README, SETUP, DEPLOYMENT, LOOM_SCRIPT)
- Configured Tailwind CSS for responsive design
- Set up environment variables for OpenAI API key
- Prepared for one-click Vercel deployment

**Technical Highlights**:
- Anti-hallucination: All arithmetic handled by TypeScript functions, never by LLM
- Streaming: Real-time response streaming for better UX
- Type-safe: Full TypeScript with Zod validation
- Modular: Easy to swap LLM providers or add new tools
- Production-ready: Edge runtime, error handling, validation
