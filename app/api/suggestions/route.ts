import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { lastUserMessage, lastAssistantMessage } = await req.json();
    
    logger.info('SUGGESTIONS_API', 'Generating suggestions', {
      userMessage: lastUserMessage?.substring(0, 100),
      assistantMessage: lastAssistantMessage?.substring(0, 100),
    });

    // Generate suggestions using structured output with gpt-4.1-mini
    const { object } = await generateObject({
      model: openai('gpt-4.1-mini'),
      schema: z.object({
        suggestions: z.array(z.string().min(3).max(50)).length(3),
      }),
      prompt: `Based on this conversation, generate exactly 3 short follow-up questions (3-7 words each) that the user might ask next.

User asked: "${lastUserMessage}"
Assistant responded: "${lastAssistantMessage}"

Generate specific, actionable follow-up questions related to the topic discussed. Make them conversational and natural.

Examples of good suggestions:
- "How to calculate it?"
- "Best rates available?"
- "Compare different options?"
- "What are the risks?"
- "How long does it take?"

Return ONLY the suggestions array, nothing else.`,
      temperature: 0.7,
    });

    logger.info('SUGGESTIONS_GENERATED', `Generated ${object.suggestions.length} suggestions`, {
      suggestions: object.suggestions,
    });

    return Response.json({
      success: true,
      suggestions: object.suggestions,
    });
  } catch (error) {
    logger.error('SUGGESTIONS_ERROR', 'Failed to generate suggestions', error);
    return Response.json(
      { success: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
