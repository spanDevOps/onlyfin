import { logger } from '../logger';

export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
  preserveSentences: boolean;
  preserveContext: boolean; // New: Keep financial context together
}

/**
 * Intelligently chunk text while preserving sentence boundaries and financial context
 * Optimized for financial documents with special handling for:
 * - Lists (numbered/bulleted)
 * - Tables and structured data
 * - Definitions and explanations
 * - Examples and case studies
 */
export async function chunkText(
  text: string, 
  options: ChunkOptions = {
    maxTokens: 600, // Increased from 500 for better context
    overlap: 100, // Increased from 50 for better continuity
    preserveSentences: true,
    preserveContext: true
  }
): Promise<string[]> {
  const startTime = Date.now();
  
  logger.info('CHUNKING_START', 'Starting text chunking', {
    textLength: text.length,
    maxTokens: options.maxTokens,
    overlap: options.overlap,
    preserveContext: options.preserveContext
  });
  
  // Dynamic import to avoid webpack issues
  const tiktoken = await import('tiktoken');
  const encoder = tiktoken.encoding_for_model('gpt-4');
  
  // Pre-process text to identify structural elements
  const preprocessStart = Date.now();
  const preprocessed = preprocessFinancialText(text);
  logger.debug('CHUNKING_PREPROCESS', `Preprocessed text in ${Date.now() - preprocessStart}ms`, {
    originalLength: text.length,
    preprocessedLength: preprocessed.length
  });
  
  // Split by sentences while preserving structure
  const sentences = preprocessed.match(/[^.!?]+[.!?]+/g) || [preprocessed];
  
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  let inList = false;
  let listBuffer = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = encoder.encode(sentence).length;
    
    // Detect if we're in a list or structured content
    const isListItem = /^\s*[-•*\d+.]\s/.test(sentence);
    const isHeader = /^#{1,6}\s/.test(sentence) || /^[A-Z][^.!?]*:$/.test(sentence.trim());
    
    // Keep lists together
    if (isListItem) {
      if (!inList) {
        inList = true;
        listBuffer = sentence;
      } else {
        listBuffer += ' ' + sentence;
      }
      continue;
    } else if (inList) {
      // End of list, add it to current chunk
      inList = false;
      const listTokens = encoder.encode(listBuffer).length;
      
      if (currentTokens + listTokens > options.maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = listBuffer;
        currentTokens = listTokens;
      } else {
        currentChunk += ' ' + listBuffer;
        currentTokens += listTokens;
      }
      listBuffer = '';
    }
    
    // Start new chunk on headers if current chunk is substantial
    if (isHeader && currentTokens > options.maxTokens * 0.5 && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentTokens = sentenceTokens;
      continue;
    }
    
    // Normal sentence processing
    if (currentTokens + sentenceTokens > options.maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Smart overlap: include previous context
      if (options.overlap > 0) {
        const overlapSentences = currentChunk
          .split(/[.!?]+/)
          .slice(-3) // Keep last 3 sentences for context
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
  
  // Add any remaining list buffer
  if (inList && listBuffer) {
    currentChunk += ' ' + listBuffer;
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  logger.debug('CHUNKING_INITIAL', `Created ${chunks.length} initial chunks`, {
    chunkCount: chunks.length,
    avgChunkSize: chunks.length > 0 
      ? Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)
      : 0
  });
  
  // Post-process: merge very small chunks (before freeing encoder)
  const mergeStart = Date.now();
  const merged = mergeSmallChunks(chunks, options.maxTokens * 0.3, encoder);
  logger.debug('CHUNKING_MERGE', `Merged small chunks in ${Date.now() - mergeStart}ms`, {
    before: chunks.length,
    after: merged.length,
    minTokens: Math.round(options.maxTokens * 0.3)
  });
  
  // Free encoder after all processing is done
  encoder.free();
  
  logger.info('CHUNKING_COMPLETE', `Chunking completed in ${Date.now() - startTime}ms`, {
    totalTime: Date.now() - startTime,
    inputLength: text.length,
    outputChunks: merged.length,
    avgChunkLength: merged.length > 0 
      ? Math.round(merged.reduce((sum, c) => sum + c.length, 0) / merged.length)
      : 0,
    chunkSizes: merged.map(c => c.length)
  });
  
  return merged;
}

/**
 * Pre-process financial text to preserve structure
 */
function preprocessFinancialText(text: string): string {
  // Normalize line breaks
  let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Preserve table structures
  processed = processed.replace(/\|(.+)\|/g, (match) => {
    return match.replace(/\n/g, ' [NEWLINE] ');
  });
  
  // Preserve numbered lists
  processed = processed.replace(/(\d+\.)\s/g, '\n$1 ');
  
  // Preserve bullet points
  processed = processed.replace(/([•\-*])\s/g, '\n$1 ');
  
  return processed;
}

/**
 * Merge chunks that are too small
 */
function mergeSmallChunks(chunks: string[], minTokens: number, encoder: any): string[] {
  const merged: string[] = [];
  let buffer = '';
  
  for (const chunk of chunks) {
    const tokens = encoder.encode(chunk).length;
    
    if (tokens < minTokens && buffer) {
      buffer += ' ' + chunk;
    } else if (tokens < minTokens) {
      buffer = chunk;
    } else {
      if (buffer) {
        merged.push(buffer);
        buffer = '';
      }
      merged.push(chunk);
    }
  }
  
  if (buffer) {
    if (merged.length > 0) {
      merged[merged.length - 1] += ' ' + buffer;
    } else {
      merged.push(buffer);
    }
  }
  
  return merged;
}
