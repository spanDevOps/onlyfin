import { openai } from '@ai-sdk/openai';
import { logger } from '../logger';

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  
  logger.debug('EMBEDDING_SINGLE_START', 'Generating single embedding', {
    textLength: text.length,
    textPreview: text.substring(0, 100)
  });
  
  try {
    const response = await openai.embedding('text-embedding-3-small').doEmbed({
      values: [text]
    });
    
    logger.info('EMBEDDING_SINGLE_COMPLETE', `Generated embedding in ${Date.now() - startTime}ms`, {
      textLength: text.length,
      embeddingDim: response.embeddings[0].length,
      time: Date.now() - startTime
    });
    
    return response.embeddings[0];
  } catch (error: any) {
    logger.error('EMBEDDING_SINGLE_ERROR', 'Failed to generate embedding', {
      error: error.message,
      stack: error.stack,
      textLength: text.length
    });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const startTime = Date.now();
  
  logger.info('EMBEDDING_BATCH_START', 'Generating batch embeddings', {
    batchSize: texts.length,
    totalChars: texts.reduce((sum, t) => sum + t.length, 0),
    avgLength: Math.round(texts.reduce((sum, t) => sum + t.length, 0) / texts.length)
  });
  
  try {
    const response = await openai.embedding('text-embedding-3-small').doEmbed({
      values: texts
    });
    
    logger.info('EMBEDDING_BATCH_COMPLETE', `Generated ${texts.length} embeddings in ${Date.now() - startTime}ms`, {
      batchSize: texts.length,
      embeddingDim: response.embeddings[0].length,
      time: Date.now() - startTime,
      avgTimePerEmbedding: Math.round((Date.now() - startTime) / texts.length)
    });
    
    return response.embeddings;
  } catch (error: any) {
    logger.error('EMBEDDING_BATCH_ERROR', 'Failed to generate batch embeddings', {
      error: error.message,
      stack: error.stack,
      batchSize: texts.length
    });
    throw error;
  }
}
