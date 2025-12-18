import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface TopicCheckResult {
  isFinance: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Check if a message is finance-related using LLM classifier
 */
export async function isFinanceRelated(message: string): Promise<TopicCheckResult> {
  try {
    const { text } = await generateText({
      model: openai('gpt-4.1-nano'),
      temperature: 0,
      messages: [{
        role: 'system',
        content: `You are a topic classifier for a finance chatbot. Your job is to determine if a message should be ALLOWED or BLOCKED.

IMPORTANT: Set "isFinance" to TRUE for BOTH finance topics AND general greetings/small talk.

ALLOW (isFinance: true) - Set to TRUE for:
1. Finance topics: banking, investments, mortgages, loans, budgeting, taxes, insurance, 
   retirement planning, stocks, bonds, cryptocurrency, financial planning, accounting, economics, 
   personal finance, corporate finance, credit cards, savings, debt management, financial markets
2. Greetings: "Hi", "Hello", "Hey", "Good morning", "How are you?", "Thanks", "Thank you", "Bye"
3. General inquiries: "What can you do?", "What are you?", "Who are you?", "Help", "What's your name?"

BLOCK (isFinance: false) - Set to FALSE only for:
- Off-topic questions: weather, sports, cooking, entertainment, politics, health, science, technology (non-finance)
- Requests for non-finance content: jokes, stories, poems, games

Examples with CORRECT responses:
- "Hi" → {"isFinance": true, "confidence": 1.0, "reasoning": "General greeting - allowed"}
- "Hello, how are you?" → {"isFinance": true, "confidence": 1.0, "reasoning": "Greeting - allowed"}
- "What can you help me with?" → {"isFinance": true, "confidence": 1.0, "reasoning": "General inquiry - allowed"}
- "How to save money" → {"isFinance": true, "confidence": 1.0, "reasoning": "Finance topic - budgeting"}
- "What's the weather?" → {"isFinance": false, "confidence": 1.0, "reasoning": "Off-topic - weather"}
- "Tell me a joke" → {"isFinance": false, "confidence": 0.9, "reasoning": "Off-topic - entertainment"}
- "Explain inflation" → {"isFinance": true, "confidence": 1.0, "reasoning": "Finance topic - economics"}

Respond ONLY with JSON:
{
  "isFinance": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`
      }, {
        role: 'user',
        content: message
      }]
    });
    
    const result = JSON.parse(text);
    return result;
  } catch (error) {
    console.error('Topic guard error:', error);
    // Default to allowing the message if classification fails
    return {
      isFinance: true,
      confidence: 0.5,
      reasoning: 'Classification failed, defaulting to allow'
    };
  }
}
