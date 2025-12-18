import { openai } from '@ai-sdk/openai';

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embedding('text-embedding-3-small').doEmbed({
    values: [text]
  });
  
  return response.embeddings[0];
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embedding('text-embedding-3-small').doEmbed({
    values: texts
  });
  
  return response.embeddings;
}
