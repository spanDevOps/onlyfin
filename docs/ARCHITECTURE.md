# Architecture Documentation

## System Overview

AskRivo is an AI-native conversational mortgage assistant built for the UAE market. It replaces traditional mortgage calculators with natural dialogue, helping expats make informed property decisions through empathetic conversation backed by deterministic calculations.

## Core Architecture Principles

### 1. Anti-Hallucination Design
The system is architected to prevent AI hallucinations in critical calculations:
- **LLM Role**: Handles conversation, empathy, intent recognition, and decision guidance
- **Function Role**: Handles ALL arithmetic and financial calculations
- **Separation**: Zero overlap between AI reasoning and mathematical operations

### 2. Streaming-First UX
- Real-time response streaming using Vercel AI SDK
- Partial content displayed as it's generated
- Perceived latency < 1 second for first token
- Tool calls execute synchronously but don't block streaming

### 3. Type-Safe Tool Integration
- Zod schemas validate all tool parameters
- TypeScript ensures compile-time safety
- Runtime validation prevents invalid calculations
- Clear error messages for edge cases

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js Client (app/page.tsx)                         │ │
│  │  - useChat hook (Vercel AI SDK)                        │ │
│  │  - Streaming message display                           │ │
│  │  - Tool invocation indicators                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP POST /api/chat
                            │ { messages: [...] }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Route                         │
│                  (app/api/chat/route.ts)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Edge Runtime                                          │ │
│  │  - Receives message history                            │ │
│  │  - Configures OpenAI GPT-4 Turbo                       │ │
│  │  - Registers 4 tools with Zod schemas                  │ │
│  │  - Streams response back to client                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ streamText()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      OpenAI GPT-4 Turbo                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  System Prompt: "You are Rivo..."                      │ │
│  │  - Conversation management                             │ │
│  │  - Intent recognition                                  │ │
│  │  - Empathetic responses                                │ │
│  │  - Tool call decisions                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Function Calling
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mortgage Calculation Tools                  │
│                   (lib/mortgage-tools.ts)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  calculate_emi()                                       │ │
│  │  - EMI = [P × r × (1+r)^n] / [(1+r)^n - 1]           │ │
│  │  - Returns: monthly_emi, total_payment, total_interest│ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  calculate_upfront_costs()                             │ │
│  │  - 4% transfer + 2% agency + 1% misc = 7% total       │ │
│  │  - Returns: breakdown of all fees                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  calculate_max_loan()                                  │ │
│  │  - 80% LTV rule for expats                            │ │
│  │  - Returns: max_loan, required_down_payment           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  compare_rent_vs_buy()                                 │ │
│  │  - Heuristics: <3yr=rent, >5yr=buy                    │ │
│  │  - Returns: recommendation, reasoning, costs          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Message Flow
```
User types message
  → useChat hook captures input
  → POST to /api/chat with message history
  → Edge function receives request
  → streamText() called with messages + tools
  → OpenAI processes with system prompt
  → Response streams back to client
  → UI updates in real-time
```

### 2. Tool Invocation Flow
```
LLM decides tool is needed
  → Generates tool call with parameters
  → Vercel AI SDK validates with Zod schema
  → TypeScript function executes (deterministic)
  → Result returned to LLM
  → LLM incorporates result into response
  → Continues streaming to user
```

## Component Breakdown

### Frontend (app/page.tsx)
**Technology**: Next.js 14 Client Component with React hooks

**Responsibilities**:
- Render chat interface with message history
- Handle user input and form submission
- Display streaming responses in real-time
- Show tool invocation indicators
- Auto-scroll to latest message
- Quick-reply buttons for common scenarios

**Key Features**:
- `useChat()` hook from Vercel AI SDK handles all state management
- Gradient background for modern aesthetic
- Responsive design (mobile-first)
- Loading states with animated dots
- Tool call badges ("Calculated using verified tools")

### API Route (app/api/chat/route.ts)
**Technology**: Next.js Edge Runtime

**Responsibilities**:
- Receive message history from client
- Configure LLM model with system prompt (OpenAI or Mistral)
- Register tools with execute functions
- Stream responses back to client
- Handle errors gracefully

**Configuration**:
- Models: `gpt-5-mini` (default, recommended), `gpt-5.2` (quality), `gpt-4.1` (non-reasoning), or `mistral-large-latest` (backup)
- Temperature: `0` (deterministic responses)
- Runtime: `edge` (fast cold starts, global distribution)
- Provider switching: Environment variable `LLM_PROVIDER` (openai/mistral)

**System Prompt Strategy**:
- Define persona: "Rivo, an AI real estate advisor"
- Set critical rules (never do math, be empathetic)
- Provide UAE context (LTV, fees, rates)
- Define conversation flow (7-step process)
- Handle edge cases (low income, short stays)

### Calculation Tools (lib/mortgage-tools.ts)
**Technology**: Pure TypeScript functions with Zod validation

#### Tool 1: calculate_emi
**Purpose**: Calculate monthly mortgage payment

**Formula**: 
```
EMI = [P × r × (1 + r)^n] / [(1 + r)^n - 1]
Where:
  P = Principal loan amount
  r = Monthly interest rate (annual / 12 / 100)
  n = Number of monthly payments (years × 12)
```

**Inputs**:
- `loan_amount_aed`: Principal amount (positive number)
- `annual_rate_percent`: Interest rate (0-20%)
- `tenure_years`: Loan duration (1-25 years)

**Outputs**:
- `monthly_emi`: Monthly payment amount
- `total_payment`: Total amount paid over tenure
- `total_interest`: Total interest paid
- `valid`: Boolean indicating success
- `error`: Error message if validation fails

**Validation**:
- Loan amount must be positive
- Interest rate between 0-20%
- Tenure between 1-25 years (UAE max)

#### Tool 2: calculate_upfront_costs
**Purpose**: Calculate hidden costs when buying property

**Breakdown**:
- Transfer Fee: 4% of property price
- Agency Fee: 2% of property price
- Miscellaneous: 1% of property price
- **Total: 7% of property price**

**Inputs**:
- `property_price_aed`: Property value (positive number)

**Outputs**:
- `transfer_fee`: DLD transfer fee
- `agency_fee`: Real estate agent commission
- `misc_fees`: Registration, valuation, etc.
- `total_upfront_fees`: Sum of all fees
- `valid`: Boolean indicating success

#### Tool 3: calculate_max_loan
**Purpose**: Calculate maximum borrowing capacity

**UAE Rule**: Expats can borrow up to 80% of property value (80% LTV)

**Inputs**:
- `property_price_aed`: Property value (positive number)

**Outputs**:
- `max_loan_amount`: 80% of property price
- `required_down_payment`: 20% of property price
- `ltv_percent`: 80 (constant for expats)
- `valid`: Boolean indicating success

#### Tool 4: compare_rent_vs_buy
**Purpose**: Provide buy vs rent recommendation

**Heuristics**:
- **< 3 years**: Recommend rent (upfront costs too high)
- **> 5 years**: Recommend buy (equity buildup)
- **3-5 years**: Compare total costs

**Calculation**:
```
Total Rent Cost = monthly_rent × years × 12
Total Buy Cost = down_payment + upfront_fees + (EMI × years × 12)
```

**Inputs**:
- `monthly_rent_aed`: Current/expected rent
- `property_price_aed`: Property value
- `years_staying`: Duration in UAE
- `interest_rate_percent`: Optional (defaults to 4.5%)

**Outputs**:
- `recommendation`: 'buy' | 'rent' | 'unclear'
- `total_rent_cost`: Total rent over period
- `total_buy_cost`: Total buy cost over period
- `monthly_mortgage_payment`: EMI amount
- `break_even_years`: When buying becomes cheaper
- `reasoning`: Human-readable explanation
- `valid`: Boolean indicating success

## UAE Market Constants

Defined in `UAE_CONSTANTS` object:

```typescript
{
  MAX_LTV_EXPAT: 0.80,           // 80% max loan for expats
  UPFRONT_FEES_PERCENT: 0.07,    // 7% total transaction fees
  STANDARD_INTEREST_RATE: 4.5,   // 4.5% annual rate
  MAX_TENURE_YEARS: 25,          // 25 year max loan duration
}
```

## Conversation Flow Design

### Phase 1: Opening (0-1 messages)
- Warm greeting
- Ask about their situation
- Set empathetic tone

### Phase 2: Context Gathering (2-4 messages)
- Current rent (if applicable)
- Monthly income
- How long staying in UAE
- Property price range considering

**Strategy**: Ask 1-2 questions at a time, not a survey

### Phase 3: Silent Calculation (Internal)
- Use tools to get exact numbers
- Calculate EMI, upfront costs, max loan
- Run rent vs buy comparison

### Phase 4: Truth Reveal (1-2 messages)
- Show actual costs with breakdown
- Highlight hidden fees
- Present monthly payment reality

### Phase 5: Decision Guidance (1 message)
- Clear recommendation (buy/rent)
- Reasoning based on their situation
- Acknowledge emotional factors

### Phase 6: Lead Capture (1 message)
- Offer detailed breakdown via email
- Position as unbiased advisor
- No pressure, just value

## Edge Case Handling

### Low/Zero Income
**Detection**: Income < 5,000 AED or zero
**Response**: Explain bank requirements, suggest alternatives (co-borrower, guarantor)

### Unrealistic Numbers
**Detection**: Property price vs income ratio > 100x
**Response**: Validate politely, ask for clarification

### Short Stay Duration
**Detection**: Years staying < 3
**Response**: Recommend renting, explain upfront cost impact

### Vague Inputs
**Detection**: "I want to buy a house" (no numbers)
**Response**: Ask clarifying questions naturally

### Mid-Conversation Changes
**Detection**: User changes numbers mid-flow
**Response**: Adapt gracefully, recalculate with new inputs

## Performance Optimizations

### 1. Edge Runtime
- Deployed globally on Vercel Edge Network
- Cold start < 100ms
- Low latency worldwide

### 2. Streaming Responses
- First token in < 1 second
- Perceived performance boost
- Better UX than waiting for full response

### 3. Deterministic Tools
- Pure functions (no I/O)
- Execute in < 1ms
- No external API calls

### 4. Temperature 0
- Consistent responses
- Faster generation
- More predictable behavior

## Security Considerations

### 1. API Key Protection
- Stored in environment variables
- Never exposed to client
- Vercel handles encryption

### 2. Input Validation
- Zod schemas validate all tool inputs
- Type checking at compile time
- Runtime validation prevents injection

### 3. Rate Limiting
- Vercel Edge provides DDoS protection
- OpenAI has built-in rate limits
- No sensitive data stored

### 4. Error Handling
- Graceful degradation
- No stack traces exposed to users
- Validation errors return user-friendly messages

## Testing Strategy

### Manual Test Scenarios

**Scenario 1: Happy Path**
```
User: "I make 20k a month and want to buy in Marina for 2M"
Expected: Calculate EMI, show upfront costs, provide recommendation
```

**Scenario 2: Edge Case - Low Income**
```
User: "I have zero income"
Expected: Explain bank requirements, suggest alternatives
```

**Scenario 3: Edge Case - Short Stay**
```
User: "I'm only staying 2 years"
Expected: Recommend renting, explain upfront cost impact
```

**Scenario 4: Vague Input**
```
User: "Should I buy or rent?"
Expected: Ask clarifying questions (income, rent, duration)
```

**Scenario 5: Mid-Conversation Change**
```
User: "Actually, the property is 3M, not 2M"
Expected: Recalculate with new price, update recommendation
```

### Tool Validation Tests

Each tool has built-in validation:
- Positive number checks
- Range validation (interest rate 0-20%)
- Max tenure enforcement (25 years)
- Error messages for invalid inputs

## Deployment Architecture

### Vercel Platform
```
GitHub Repository
  → Vercel Build (Next.js)
  → Edge Functions (API routes)
  → Global CDN (Static assets)
  → Environment Variables (API keys)
```

### Environment Variables
- `OPENAI_API_KEY`: Required for LLM access
- Set in Vercel dashboard
- Encrypted at rest

### Build Process
```bash
npm install          # Install dependencies
npm run build        # Next.js production build
npm run start        # Start production server
```

### Monitoring
- Vercel Analytics (page views, performance)
- OpenAI Dashboard (token usage, costs)
- Browser console (client-side errors)

## Extensibility

### Adding New Tools
1. Create function in `lib/mortgage-tools.ts`
2. Define Zod schema for validation
3. Register in `app/api/chat/route.ts`
4. Update system prompt with usage instructions

### Swapping LLM Provider
1. Change import: `@ai-sdk/openai` → `@ai-sdk/anthropic`
2. Update model string: `gpt-4-turbo` → `claude-3-opus`
3. Adjust system prompt if needed
4. Update environment variables

### Adding New Features
- **Email Integration**: Add tool for sending detailed reports
- **Property Search**: Integrate with real estate APIs
- **Document Upload**: Parse salary certificates, bank statements
- **Multi-language**: Add Arabic language support

## Code Quality Metrics

### Type Safety
- 100% TypeScript coverage
- Zod validation for runtime safety
- No `any` types used

### Modularity
- Tools separated from AI logic
- Pure functions (testable)
- Clear separation of concerns

### Maintainability
- Comprehensive inline comments
- Descriptive variable names
- Single responsibility principle

### Performance
- Edge runtime for fast cold starts
- Streaming for perceived performance
- Deterministic tools (< 1ms execution)

## Challenge Requirements Checklist

✅ **Conversational Interface**: Natural chat UI, not a calculator form
✅ **Intent Recognition**: Handles vague inputs gracefully
✅ **Data Collection**: Gathers info unobtrusively through conversation
✅ **Math Integration**: Function calling prevents hallucination
✅ **Lead Capture**: Ends with email collection offer
✅ **Streaming**: Real-time response streaming
✅ **AI-Native Workflow**: Built with Cursor and AI tools
✅ **Deployed Live**: Ready for one-click Vercel deployment
✅ **Anti-Hallucination**: All arithmetic in TypeScript functions
✅ **UAE-Specific Logic**: 80% LTV, 7% fees, 4.5% rate, 25yr max
✅ **Edge Case Handling**: Low income, short stays, vague inputs
✅ **Type Safety**: Full TypeScript with Zod validation

## Time Investment Breakdown

- **0-3h**: Project setup, Next.js scaffolding, tool implementation
- **3-7h**: API route, OpenAI integration, function calling
- **7-11h**: Frontend UI, streaming chat, useChat hook
- **11-17h**: System prompt refinement, UAE logic, conversation flow
- **17-22h**: UX polish, error handling, edge cases, tool indicators
- **22-24h**: Testing, deployment prep, documentation

## Future Enhancements

### Phase 2 Features
- Email integration for detailed reports
- Property search integration
- Mortgage pre-approval workflow
- Document upload and parsing

### Phase 3 Features
- Multi-language support (Arabic)
- Voice interface
- Mobile app (React Native)
- Mortgage comparison tool

### Phase 4 Features
- Bank integration for real-time rates
- Property valuation API
- Investment analysis tools
- Refinancing calculator