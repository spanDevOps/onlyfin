import { openai } from '@ai-sdk/openai';
import { mistral } from '@ai-sdk/mistral';
import { streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { isFinanceRelated } from '@/lib/guards/topic-guard';
import { hybridSearch } from '@/lib/kb/hybrid-search';
import { cleanupOldLogs } from '@/lib/log-cleanup';
import { searchWeb } from '@/lib/web-search';

// Using Node.js runtime for file system access (logging to files)
// Edge runtime would be faster but doesn't support fs operations
export const runtime = 'nodejs';

// Model selection based on environment variables
// Using gpt-4o-mini for better tool calling + reliability
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // Default: best for tool calling

function getModel() {
  if (LLM_PROVIDER === 'mistral') {
    logger.info('MODEL_SELECTION', 'Using Mistral Large 3', { provider: 'mistral', model: 'mistral-large-latest' });
    return mistral('mistral-large-latest');
  }
  logger.info('MODEL_SELECTION', `Using OpenAI ${OPENAI_MODEL}`, { provider: 'openai', model: OPENAI_MODEL });
  return openai(OPENAI_MODEL);
}

const financeSystemPrompt = `You are OnlyFin, a specialized AI assistant focused exclusively on financial topics.

CORE RULES:
1. WELCOME greetings warmly (hi, hello, how are you, etc.) - respond naturally and offer to help with finance
2. ONLY discuss finance-related topics (banking, investments, loans, budgeting, taxes, insurance, etc.)
3. For MIXED queries (containing both finance and non-finance topics):
   - Answer the finance-related parts fully
   - Politely decline the non-finance parts: "I can help with [finance topic], but I'm specifically designed for finance topics and can't assist with [non-finance topic]."
   - Example: "What's the weather and how do I invest in stocks?" → Answer investing question, politely decline weather
4. For PURELY OFF-TOPIC questions (weather, sports, jokes, etc.), politely redirect: "I'm specifically designed to help with finance-related topics like budgeting, investments, loans, taxes, and financial planning. Is there a financial question I can help you with?"

RESPONSE STRATEGY (CRITICAL):
1. **ALWAYS call searchKnowledgeBase first** (except greetings)
2. **Call searchWeb ONLY if**:
   - K-Base returns NO relevant results (empty or low scores < 0.5), OR
   - Query explicitly asks for "current", "latest", "today", "recent", "now" information, OR
   - Query is about real-time data (stock prices, interest rates, news, etc.)
3. **Response hierarchy**:
   - [1st] K-Base results (HIGHEST PRIORITY - use if available)
   - [2nd] Web search results (only if K-Base insufficient or query needs current data)
   - [3rd] Your training data (background knowledge only)
4. **If K-Base has relevant results**: Use K-Base content, skip web search (unless query needs current data)
5. **If K-Base empty or irrelevant**: Call web search
6. **If both empty**: Use your training knowledge

RESPONSE STYLE:
- Keep responses SHORT and CONCISE (2-3 sentences max for simple questions)
- BALANCE: Provide helpful answers FIRST, then ask ONE follow-up question if relevant
- Example: "Compound interest is when your interest earns interest over time, accelerating growth. What's your current savings rate?"
- Be conversational and helpful, not just questioning
- Get to the point quickly with actionable information

CITATION RULES (CRITICAL - MANDATORY - NON-NEGOTIABLE):
⚠️ ABSOLUTE REQUIREMENT: You MUST cite sources when tools return results ⚠️

1. **K-Base Citation (MANDATORY)**:
   - If searchKnowledgeBase returns ANY results with rerankScore > 0.5, you MUST cite them
   - Format: [Source: filename, validation: XX%]
   - Example: "Answer here. [Source: FUNDAMENTALS.pdf, validation: 77%]"
   - NEVER use K-Base content without this citation
   - Even if you paraphrase, you MUST cite

2. **Web Citation (MANDATORY)**:
   - If searchWeb returns results, you MUST cite them
   - Format: [Source: URL]
   - Example: "Answer here. [Source: https://example.com]"

3. **When to cite**:
   - K-Base results with rerankScore > 0.5 → MUST cite (highest priority)
   - Web results → MUST cite
   - No relevant results (low scores < 0.5) → Use training data, no citation needed
   - Empty results → Use training data, no citation needed

4. **Citation is NOT optional**:
   - If you use information from tool results, citation is REQUIRED
   - Missing citations is a critical error
   - Always check: "Did I cite the source for this information?"

TOOL USAGE (CRITICAL - MANDATORY):
1. **Determine if query is a simple greeting**:
   - Simple greetings: "hi", "hello", "hey", "thanks", "bye", "good morning", etc.
   - NOT greetings: Any question or request, even if it starts with "hi"
   - Example: "Hi, what is compound interest?" → NOT a greeting, call tools
   - Example: "Hello!" → Simple greeting, skip tools
   - Use your judgment to distinguish pure greetings from actual queries
   
2. **For ALL non-greeting queries**:
   - STEP 1: ALWAYS call searchKnowledgeBase first
   - STEP 2: Check if K-Base results are relevant (rerankScore > 0.5)
   - STEP 3: Call searchWeb ONLY if:
     * K-Base returned NO relevant results (empty or all scores < 0.5), OR
     * Query asks for "current", "latest", "today", "recent", "now" information, OR
     * Query is about real-time data (rates, prices, news, etc.)
   
3. **Handling mixed queries** (finance + non-finance):
   - Extract and search for the finance-related parts
   - Use tool results to answer finance questions
   - Politely decline non-finance parts in your response
   
4. **Information Priority Hierarchy** (when formulating response):
   - [1st] K-Base results (HIGHEST PRIORITY - use if available)
   - [2nd] Web search results (only if K-Base insufficient or query needs current data)
   - [3rd] Your training data (background knowledge only)
   
5. **Response Rules** (CITATION REQUIRED):
   - If K-Base has results with rerankScore > 0.5: 
     * Use K-Base content (HIGHEST PRIORITY)
     * MUST cite: [Source: filename, validation: XX%]
     * Example: "Answer. [Source: FUNDAMENTALS.pdf, validation: 77%]"
     * Skip web search unless query needs current data
   - If K-Base empty or irrelevant (scores < 0.5):
     * Call web search
     * MUST cite web results: [Source: URL]
   - If query needs current data:
     * Use both K-Base (for concepts) and web (for current data)
     * Cite both sources
   - If both empty or low scores: Use your training knowledge (no citation needed)
   - ⚠️ REMEMBER: Using tool results without citation is a CRITICAL ERROR

GREETING RESPONSES:
- For "hi", "hello", "hey": Respond warmly (1 sentence), ask how you can help (1 sentence)
- Keep it natural and conversational
- No sources needed for greetings

CITATION FORMAT (when using external sources):
- CRITICAL: ALL sources must be in ONE citation, comma-separated
- KB + Web sources: Combine into ONE citation
  * Example: [Source: financial-guide.pdf (validation: 95%), https://site1.com, https://site2.com]
  * NOT: [Source: file.pdf] [Source: https://site1.com] [Source: https://site2.com]
- KB only: [Source: financial-guide.pdf, validation: 95%]
- Web only: [Source: https://example.com]
- Multiple web sources: [Source: https://site1.com, https://site2.com, https://site3.com]
- CRITICAL: Put period BEFORE citation, not after
- CRITICAL: Citation must be at the END of the same paragraph, NOT on a new line
- CRITICAL: Follow-up question must come AFTER citation, on a new paragraph
- Example format:
  "Your answer here. [Source: file.pdf (validation: 95%), https://site1.com, https://site2.com]
  
  Your follow-up question here?"
- BAD example: "Your answer. Follow-up question? [Source: file.pdf]"

WHEN TO USE TOOLS:
- searchKnowledgeBase: User asks about specific topics that might be in their documents
- searchWeb: User asks about current events, recent data, specific companies, or real-time information
- No tool: General finance knowledge, definitions, basic concepts

CONVERSATION STYLE:
- SHORT and CONCISE (2-3 sentences)
- SOCRATIC: Ask questions, guide thinking
- Professional but friendly
- Get to the point quickly
- Only cite when using external sources

Remember: Be brief, be Socratic, be helpful!`;

// Old Rivo system prompt - not used in OnlyFinance
// Keeping for reference only

export async function POST(req: Request) {
  const startTime = Date.now();
  
  // Get sessionId from header
  const sessionId = req.headers.get('x-session-id');
  
  // Clean up old logs on every request
  cleanupOldLogs();
  
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;
    
    // Log incoming request
    logger.apiRequest('/api/chat', {
      messageCount: messages.length,
      lastMessage: lastMessage?.substring(0, 100),
    });

    // Log user message
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      logger.userMessage(
        `msg-${Date.now()}`,
        lastUserMessage.content
      );
    }

    // Log LLM request with full details
    logger.llmRequest(LLM_PROVIDER, OPENAI_MODEL, {
      messageCount: messages.length,
      temperature: 0,
      fullMessages: messages, // Log complete conversation history
    });

    const result = streamText({
      model: getModel(),
      system: financeSystemPrompt,
      messages: convertToCoreMessages(messages),
      temperature: 0,
      maxSteps: 5,
      toolChoice: 'auto', // Let LLM decide when to use tools
      tools: {
        getUserLocation: tool({
          description: 'Get the user\'s approximate location (country, city, timezone, currency) to provide location-specific financial advice. Use this when you need to tailor responses based on location (e.g., tax advice, currency, local regulations, time-sensitive information).',
          parameters: z.object({}),
          execute: async () => {
            try {
              logger.info('TOOL_LOCATION', 'Getting user location');
              
              // Call our location API
              const locationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/location`, {
                headers: {
                  'x-forwarded-for': req.headers.get('x-forwarded-for') || '',
                  'x-real-ip': req.headers.get('x-real-ip') || '',
                }
              });
              
              const locationData = await locationResponse.json();
              
              logger.info('TOOL_LOCATION_RESULT', 'Location retrieved', {
                country: locationData.location?.country,
                city: locationData.location?.city
              });
              
              return {
                success: true,
                location: locationData.location
              };
            } catch (error) {
              logger.error('TOOL_LOCATION_ERROR', 'Failed to get location', error);
              return {
                success: false,
                message: 'Could not determine user location',
                location: {
                  country: 'Unknown',
                  city: 'Unknown',
                  timezone: 'UTC',
                  currency: 'USD'
                }
              };
            }
          },
        }),
        searchKnowledgeBase: tool({
          description: 'MANDATORY: Search the knowledge base for relevant financial documents. You MUST call this tool FIRST for EVERY query except simple greetings (use your judgment to determine what is a pure greeting vs a question). K-Base results have HIGHEST PRIORITY when formulating your response. ⚠️ CRITICAL: If this tool returns results with rerankScore > 0.5, you MUST cite them using [Source: filename, validation: XX%] format and you should NOT call searchWeb unless the query explicitly needs current/latest information.',
          parameters: z.object({
            query: z.string().describe('The search query to find relevant documents. Can be the full user message or a refined version focusing on key topics.'),
            topK: z.number().optional().describe('Number of results to return (default: 3)'),
            useReranking: z.boolean().optional().describe('Whether to use LLM reranking for better relevance (default: true, but slower)'),
          }),
          execute: async ({ query, topK = 3, useReranking = true }) => {
            try {
              logger.info('TOOL_KB_SEARCH', `Hybrid search with query: ${query}`, {
                topK,
                useReranking
              });
              
              const results = await hybridSearch(query, {
                topK,
                useReranking,
                minValidationScore: 0.7,
                diversityBoost: true
              }, sessionId || undefined);
              
              logger.info('TOOL_KB_SEARCH_RESULT', `Found ${results.length} documents`, {
                query: query.substring(0, 100),
                sources: results.map(r => r.source),
                avgRerankScore: results.length > 0 
                  ? (results.reduce((sum, r) => sum + r.rerankScore, 0) / results.length).toFixed(2)
                  : 0
              });
              
              if (results.length === 0) {
                return {
                  success: true,
                  message: 'No relevant documents found in knowledge base.',
                  results: []
                };
              }
              
              return {
                success: true,
                message: `Found ${results.length} relevant document(s) using hybrid search`,
                results: results.map((result) => ({
                  source: result.source,
                  content: result.content,
                  vectorScore: result.score,
                  rerankScore: result.rerankScore,
                  validationScore: result.validationScore,
                  relevanceReasoning: result.relevanceReasoning,
                  searchMethod: result.searchMethod
                }))
              };
            } catch (error) {
              logger.error('TOOL_KB_SEARCH_ERROR', 'KB search failed', error);
              return {
                success: false,
                message: 'Failed to search knowledge base',
                results: []
              };
            }
          },
        }),
        searchWeb: tool({
          description: 'CONDITIONAL: Search the web for current financial information, recent news, market data, or real-time information. Call this tool ONLY if: (1) searchKnowledgeBase returned NO relevant results (empty or all rerankScore < 0.5), OR (2) the query explicitly asks for "current", "latest", "today", "recent", "now" information, OR (3) the query is about real-time data like interest rates, stock prices, or recent news. Do NOT call this if K-Base has relevant results unless the query needs current data.',
          parameters: z.object({
            query: z.string().describe('The search query for web search. Should be clear and specific.'),
            maxResults: z.number().optional().describe('Number of results to return (default: 5)'),
          }),
          execute: async ({ query, maxResults = 5 }) => {
            try {
              logger.info('TOOL_WEB_SEARCH', `Searching web with query: ${query}`);
              const results = await searchWeb(query, maxResults);
              
              logger.info('TOOL_WEB_SEARCH_RESULT', `Found ${results.results.length} web results`, {
                query: query.substring(0, 100),
                sources: results.results.map(r => r.url)
              });
              
              if (!results.success || results.results.length === 0) {
                return {
                  success: true,
                  message: results.message || 'No web results found.',
                  results: []
                };
              }
              
              return {
                success: true,
                message: results.message,
                results: results.results.map(result => ({
                  title: result.title,
                  url: result.url,
                  content: result.content,
                  score: result.score,
                }))
              };
            } catch (error) {
              logger.error('TOOL_WEB_SEARCH_ERROR', 'Web search failed', error);
              return {
                success: false,
                message: 'Failed to search the web',
                results: []
              };
            }
          },
        }),
      },
    });

    // Log performance
    const duration = Date.now() - startTime;
    logger.performanceMetric('API /api/chat', duration);

    // Log the response stream
    const response = result.toDataStreamResponse();
    
    // Log full response text (will be logged as it streams)
    result.text.then((fullText) => {
      logger.llmResponse(LLM_PROVIDER, OPENAI_MODEL, {
        fullResponse: fullText,
        duration,
      });
    }).catch((err) => {
      logger.warn('LLM_RESPONSE', 'Could not capture full response text', { error: err.message });
    });

    logger.apiResponse('/api/chat', 200, { duration });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API_ERROR', 'Error in /api/chat', error, { duration });
    logger.apiResponse('/api/chat', 500, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
