import { openai } from '@ai-sdk/openai';
import { mistral } from '@ai-sdk/mistral';
import { streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { isFinanceRelated } from '@/lib/guards/topic-guard';
import { searchKB } from '@/lib/kb/vector-db';
import { generateEmbedding } from '@/lib/kb/embeddings';
import { cleanupOldLogs } from '@/lib/log-cleanup';

// Using Node.js runtime for file system access (logging to files)
// Edge runtime would be faster but doesn't support fs operations
export const runtime = 'nodejs';

// Model selection based on environment variables
// Using gpt-4.1-nano for speed + reliability
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano'; // Default: fast + reliable

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
3. For OFF-TOPIC questions (weather, sports, jokes, etc.), politely redirect: "I'm specifically designed to help with finance-related topics like budgeting, investments, loans, taxes, and financial planning. Is there a financial question I can help you with?"
4. ALWAYS cite your sources using [Source: filename] format for finance answers
5. PRIORITIZE knowledge base content over your training data
6. If KB and training data conflict, mention both perspectives
7. Be helpful, accurate, and transparent about source reliability

TOOL USAGE:
- Use searchKnowledgeBase tool when user asks specific finance questions that might be in uploaded documents
- You can start responding immediately and call the tool in parallel
- Don't use the tool for simple greetings or general questions
- After getting tool results, incorporate them into your response with proper citations

GREETING RESPONSES:
- For "hi", "hello", "hey": Respond warmly, introduce yourself briefly, and ask how you can help with their finances
- Keep it natural and conversational
- Don't mention sources or use tools for simple greetings

CITATION FORMAT:
- KB source: "According to [Source: financial-guide.pdf, validation: 95%]..."
- Training data: "Based on general financial principles [Source: Training data]..."
- Uncertain: "I don't have reliable information on this. Could you upload a document?"

VALIDATION AWARENESS:
- If a KB source has low validation score (<0.7), mention: "Note: This source has moderate confidence (65%). Please verify independently."
- If no KB sources found for finance questions: "I don't have specific documents on this topic. My response is based on general financial knowledge [Source: Training data]."

CONVERSATION STYLE:
- Professional but friendly and warm
- Clear and concise
- Educational and helpful
- Transparent about limitations
- Natural with greetings
- Always cite sources for finance answers

Remember: You're a finance expert who's also friendly and approachable!`;

// Old Rivo system prompt - not used in OnlyFinance
// Keeping for reference only

export async function POST(req: Request) {
  const startTime = Date.now();
  
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

    const result = await streamText({
      model: getModel(),
      system: financeSystemPrompt,
      messages: convertToCoreMessages(messages),
      temperature: 0,
      maxSteps: 5,
      tools: {
        searchKnowledgeBase: tool({
          description: 'Search the knowledge base for relevant financial documents and information. Use this when the user asks a specific finance question that might be answered by uploaded documents. Do not use for simple greetings.',
          parameters: z.object({
            query: z.string().describe('The search query to find relevant documents. Can be the full user message or a refined version focusing on key topics.'),
            topK: z.number().optional().describe('Number of results to return (default: 5)'),
          }),
          execute: async ({ query, topK = 5 }) => {
            try {
              logger.info('TOOL_KB_SEARCH', `Searching KB with query: ${query}`);
              const queryEmbedding = await generateEmbedding(query);
              const results = await searchKB(queryEmbedding, topK);
              
              logger.info('TOOL_KB_SEARCH_RESULT', `Found ${results.length} documents`, {
                query: query.substring(0, 100),
                sources: results.map(r => r.source)
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
                message: `Found ${results.length} relevant document(s)`,
                results: results.map((result, i) => ({
                  source: result.source,
                  content: result.content,
                  score: result.score,
                  validationScore: result.validationScore,
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
