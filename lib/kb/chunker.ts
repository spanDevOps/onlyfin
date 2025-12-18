export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
  preserveSentences: boolean;
}

/**
 * Intelligently chunk text while preserving sentence boundaries
 */
export async function chunkText(
  text: string, 
  options: ChunkOptions = {
    maxTokens: 500,
    overlap: 50,
    preserveSentences: true
  }
): Promise<string[]> {
  // Dynamic import to avoid webpack issues
  const tiktoken = await import('tiktoken');
  const encoder = tiktoken.encoding_for_model('gpt-4');
  
  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = encoder.encode(sentence).length;
    
    if (currentTokens + sentenceTokens > options.maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Add overlap
      if (options.overlap > 0) {
        const overlapSentences = currentChunk
          .split(/[.!?]+/)
          .slice(-2)
          .join('. ') + '.';
        currentChunk = overlapSentences + ' ' + sentence;
        currentTokens = encoder.encode(currentChunk).length;
      } else {
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      }
    } else {
      currentChunk += ' ' + sentence;
      currentTokens += sentenceTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  encoder.free();
  return chunks;
}
