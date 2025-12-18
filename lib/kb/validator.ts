import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  reasoning: string;
}

/**
 * Validate a text chunk for factual accuracy
 */
export async function validateChunk(chunk: string): Promise<ValidationResult> {
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      temperature: 0,
      messages: [{
        role: 'system',
        content: `You are a financial fact-checker. Evaluate if the given text contains factually accurate information.

Check for:
1. Factual accuracy (are claims correct?)
2. Logical consistency (do statements contradict?)
3. Completeness (is critical context missing?)
4. Currency (is information outdated?)

Examples:
- "A mortgage is a loan for buying property" → VALID (correct definition)
- "Mortgages are always 50 years" → INVALID (incorrect typical term)
- "Investing has no risk" → INVALID (misleading, missing context)

Respond ONLY with JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of problems"],
  "reasoning": "detailed explanation"
}`
      }, {
        role: 'user',
        content: `Evaluate this financial content:\n\n${chunk}`
      }]
    });
    
    // Remove markdown code blocks if present
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const result = JSON.parse(cleanText);
    return result;
  } catch (error) {
    console.error('Validation error:', error);
    // Default to low confidence if validation fails
    return {
      isValid: false,
      confidence: 0.5,
      issues: ['Validation failed'],
      reasoning: 'Could not validate content'
    };
  }
}
