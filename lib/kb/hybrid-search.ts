import { generateEmbedding } from './embeddings';
import { searchKB, KBSearchResult } from './vector-db';
import { rerankResults, fastRerank, RerankResult } from './reranker';
import { logger } from '../logger';

export interface HybridSearchOptions {
  topK?: number;
  useReranking?: boolean;
  minValidationScore?: number;
  diversityBoost?: boolean;
}

export interface HybridSearchResult extends RerankResult {
  searchMethod: 'vector' | 'hybrid';
}

/**
 * Hybrid search combining vector similarity with keyword matching and reranking
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {},
  sessionId?: string
): Promise<HybridSearchResult[]> {
  const startTime = Date.now();
  const {
    topK = 5,
    useReranking = true,
    minValidationScore = 0.7,
    diversityBoost = true
  } = options;
  
  logger.info('HYBRID_SEARCH_START', 'Starting hybrid search', {
    query: query.substring(0, 100),
    topK,
    useReranking,
    minValidationScore,
    diversityBoost
  });
  
  try {
    // Step 1: Vector search
    const embeddingStart = Date.now();
    const queryEmbedding = await generateEmbedding(query);
    logger.debug('HYBRID_SEARCH_EMBEDDING', `Generated embedding in ${Date.now() - embeddingStart}ms`);
    
    const vectorSearchStart = Date.now();
    const vectorResults = await searchKB(queryEmbedding, topK * 2, sessionId); // Get more for reranking
    logger.info('HYBRID_SEARCH_VECTOR', `Vector search returned ${vectorResults.length} results in ${Date.now() - vectorSearchStart}ms`, {
      resultCount: vectorResults.length,
      avgScore: vectorResults.length > 0 
        ? (vectorResults.reduce((sum, r) => sum + r.score, 0) / vectorResults.length).toFixed(3)
        : 0,
      sources: vectorResults.map(r => r.source)
    });
    
    if (vectorResults.length === 0) {
      logger.warn('HYBRID_SEARCH_NO_RESULTS', 'No vector results found');
      return [];
    }
    
    // Step 2: Filter by validation score
    const filterStart = Date.now();
    const filteredResults = vectorResults.filter(
      r => r.validationScore >= minValidationScore
    );
    logger.debug('HYBRID_SEARCH_FILTER', `Filtered ${vectorResults.length} → ${filteredResults.length} results (threshold: ${minValidationScore}) in ${Date.now() - filterStart}ms`, {
      before: vectorResults.length,
      after: filteredResults.length,
      threshold: minValidationScore
    });
    
    if (filteredResults.length === 0) {
      logger.warn('HYBRID_SEARCH_NO_VALID', 'No results passed validation threshold', {
        threshold: minValidationScore,
        scores: vectorResults.map(r => r.validationScore)
      });
      return [];
    }
    
    // Step 3: Fast reranking (keyword boost)
    const fastRerankStart = Date.now();
    const fastReranked = fastRerank(query, filteredResults);
    logger.debug('HYBRID_SEARCH_FAST_RERANK', `Fast reranking completed in ${Date.now() - fastRerankStart}ms`, {
      scoreChanges: fastReranked.slice(0, 3).map((r, i) => ({
        source: r.source,
        oldScore: filteredResults[i]?.score.toFixed(3),
        newScore: r.score.toFixed(3)
      }))
    });
    
    // Step 4: Diversity boost (prefer different sources)
    let diverseResults = fastReranked;
    if (diversityBoost) {
      const diversityStart = Date.now();
      diverseResults = applyDiversityBoost(fastReranked);
      logger.debug('HYBRID_SEARCH_DIVERSITY', `Diversity boost applied in ${Date.now() - diversityStart}ms`, {
        uniqueSources: new Set(diverseResults.map(r => r.source)).size,
        totalResults: diverseResults.length
      });
    }
    
    // Step 5: LLM reranking (optional, more expensive)
    let finalResults: RerankResult[];
    if (useReranking && diverseResults.length > 1) {
      const llmRerankStart = Date.now();
      finalResults = await rerankResults(query, diverseResults, topK);
      logger.info('HYBRID_SEARCH_LLM_RERANK', `LLM reranking completed in ${Date.now() - llmRerankStart}ms`, {
        inputCount: diverseResults.length,
        outputCount: finalResults.length,
        topScores: finalResults.slice(0, 3).map(r => ({
          source: r.source,
          rerankScore: r.rerankScore.toFixed(3),
          reasoning: r.relevanceReasoning.substring(0, 50)
        }))
      });
    } else {
      finalResults = diverseResults.slice(0, topK).map(r => ({
        ...r,
        rerankScore: r.score,
        relevanceReasoning: 'Ranked by hybrid vector + keyword matching'
      }));
      logger.debug('HYBRID_SEARCH_NO_LLM_RERANK', 'Skipped LLM reranking', {
        reason: !useReranking ? 'disabled' : 'insufficient results',
        resultCount: diverseResults.length
      });
    }
    
    // Add search method metadata
    const results = finalResults.map(r => ({
      ...r,
      searchMethod: 'hybrid' as const
    }));
    
    logger.info('HYBRID_SEARCH_COMPLETE', `Hybrid search completed in ${Date.now() - startTime}ms`, {
      totalTime: Date.now() - startTime,
      finalResultCount: results.length,
      pipeline: {
        vector: vectorResults.length,
        filtered: filteredResults.length,
        fastReranked: fastReranked.length,
        diverse: diverseResults.length,
        final: results.length
      }
    });
    
    return results;
    
  } catch (error) {
    logger.error('HYBRID_SEARCH_ERROR', 'Hybrid search failed', {
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Apply diversity boost to prefer results from different sources
 */
function applyDiversityBoost(
  results: KBSearchResult[]
): KBSearchResult[] {
  const seenSources = new Set<string>();
  const boosted: KBSearchResult[] = [];
  
  // First pass: add one result from each unique source
  for (const result of results) {
    if (!seenSources.has(result.source)) {
      boosted.push({
        ...result,
        score: result.score * 1.2 // Boost first occurrence
      });
      seenSources.add(result.source);
    }
  }
  
  // Second pass: add remaining results with slight penalty
  for (const result of results) {
    if (seenSources.has(result.source) && !boosted.includes(result)) {
      boosted.push({
        ...result,
        score: result.score * 0.9 // Slight penalty for duplicate sources
      });
    }
  }
  
  return boosted.sort((a, b) => b.score - a.score);
}

/**
 * Simple search without reranking (faster, cheaper)
 */
export async function simpleSearch(
  query: string,
  topK: number = 5
): Promise<HybridSearchResult[]> {
  return hybridSearch(query, {
    topK,
    useReranking: false,
    diversityBoost: false
  });
}
