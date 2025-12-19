import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { logger } from '../logger';

export interface RerankResult {
  content: string;
  source: string;
  score: number;
  validationScore: number;
  rerankScore: number;
  relevanceReasoning: string;
}

export type RerankerType = 'cohere' | 'llm' | 'heuristic';

/**
 * Rerank using Cohere's specialized reranking API
 * Fastest and most accurate option for production
 */
async function cohereRerank(
  query: string,
  results: Array<{
    content: string;
    source: string;
    score: number;
    validationScore: number;
  }>,
  topK: number = 3
): Promise<RerankResult[]> {
  const startTime = Date.now();
  
  logger.info('COHERE_RERANK_START', 'Starting Cohere reranking', {
    query: query.substring(0, 100),
    inputCount: results.length,
    topK
  });
  
  try {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error('COHERE_API_KEY not configured');
    }
    
    // Prepare documents for Cohere
    const documents = results.map(r => r.content);
    
    const apiStart = Date.now();
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query,
        documents,
        top_n: topK,
        return_documents: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    logger.debug('COHERE_RERANK_RESPONSE', `Cohere responded in ${Date.now() - apiStart}ms`, {
      apiTime: Date.now() - apiStart,
      resultCount: data.results?.length || 0
    });
    
    // Map Cohere results back to our format
    const reranked: RerankResult[] = data.results.map((result: any) => {
      const original = results[result.index];
      return {
        ...original,
        rerankScore: result.relevance_score,
        relevanceReasoning: `Cohere relevance: ${(result.relevance_score * 100).toFixed(1)}%`
      };
    });
    
    logger.info('COHERE_RERANK_COMPLETE', `Cohere reranking completed in ${Date.now() - startTime}ms`, {
      totalTime: Date.now() - startTime,
      inputCount: results.length,
      outputCount: reranked.length,
      topResults: reranked.map(r => ({
        source: r.source,
        vectorScore: r.score.toFixed(3),
        rerankScore: r.rerankScore.toFixed(3)
      }))
    });
    
    return reranked;
  } catch (error: any) {
    logger.error('COHERE_RERANK_ERROR', 'Cohere reranking failed', {
      error: error.message,
      stack: error.stack,
      query: query.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Rerank using LLM (GPT-4.1-mini) with reasoning
 * Slower but provides detailed explanations
 */
async function llmRerank(
  query: string,
  results: Array<{
    content: string;
    source: string;
    score: number;
    validationScore: number;
  }>,
  topK: number = 3
): Promise<RerankResult[]> {
  if (results.length === 0) return [];
  
  const startTime = Date.now();
  logger.info('RERANK_START', 'Starting LLM reranking', {
    query: query.substring(0, 100),
    inputCount: results.length,
    topK,
    sources: results.map(r => r.source)
  });
  
  try {
    // Create prompt with all results
    const resultsText = results.map((r, i) => 
      `[${i}] Source: ${r.source}\nContent: ${r.content}\nVector Score: ${r.score.toFixed(3)}\n`
    ).join('\n---\n');
    
    logger.debug('RERANK_PROMPT', 'Generated reranking prompt', {
      promptLength: resultsText.length,
      resultCount: results.length
    });
    
    const llmStart = Date.now();
    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      temperature: 0,
      messages: [{
        role: 'system',
        content: `You are a financial content relevance evaluator. Rank search results by relevance to the user's query.

For each result, assign a relevance score (0.0-1.0) and explain why.

Consider:
1. Direct answer to query (highest priority)
2. Contextual relevance
3. Completeness of information
4. Specificity vs generality

Respond ONLY with JSON array:
[
  {
    "index": 0,
    "score": 0.95,
    "reasoning": "Directly answers the query about..."
  },
  ...
]

Order by relevance score (highest first). Include only top ${topK} most relevant results.`
      }, {
        role: 'user',
        content: `Query: "${query}"\n\nResults to rank:\n${resultsText}`
      }]
    });
    
    logger.debug('RERANK_LLM_RESPONSE', `LLM responded in ${Date.now() - llmStart}ms`, {
      responseLength: text.length,
      llmTime: Date.now() - llmStart
    });
    
    // Parse response
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parseStart = Date.now();
    const rankings = JSON.parse(cleanText);
    logger.debug('RERANK_PARSE', `Parsed rankings in ${Date.now() - parseStart}ms`, {
      rankingCount: rankings.length
    });
    
    // Map rankings back to results
    const reranked: RerankResult[] = rankings
      .slice(0, topK)
      .map((rank: any) => {
        const original = results[rank.index];
        return {
          ...original,
          rerankScore: rank.score,
          relevanceReasoning: rank.reasoning
        };
      });
    
    logger.info('RERANK_COMPLETE', `Reranking completed in ${Date.now() - startTime}ms`, {
      totalTime: Date.now() - startTime,
      inputCount: results.length,
      outputCount: reranked.length,
      topResults: reranked.map(r => ({
        source: r.source,
        vectorScore: r.score.toFixed(3),
        rerankScore: r.rerankScore.toFixed(3),
        reasoning: r.relevanceReasoning.substring(0, 50)
      }))
    });
    
    return reranked;
  } catch (error: any) {
    logger.error('LLM_RERANK_ERROR', 'LLM reranking failed', {
      error: error.message,
      stack: error.stack,
      query: query.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Main reranking function with automatic fallback
 * Tries methods in order: Cohere → LLM → Heuristic
 */
export async function rerankResults(
  query: string,
  results: Array<{
    content: string;
    source: string;
    score: number;
    validationScore: number;
  }>,
  topK: number = 3,
  preferredType?: RerankerType
): Promise<RerankResult[]> {
  if (results.length === 0) return [];
  
  const startTime = Date.now();
  const rerankerType = preferredType || (process.env.RERANKER_TYPE as RerankerType) || 'cohere';
  
  logger.info('RERANK_DISPATCH', 'Starting reranking with fallback', {
    preferredType: rerankerType,
    inputCount: results.length,
    topK
  });
  
  // Try preferred method first
  try {
    let reranked: RerankResult[];
    
    switch (rerankerType) {
      case 'cohere':
        reranked = await cohereRerank(query, results, topK);
        break;
      case 'llm':
        reranked = await llmRerank(query, results, topK);
        break;
      case 'heuristic':
        const heuristicResults = fastRerank(query, results);
        reranked = heuristicResults.slice(0, topK).map(r => ({
          ...r,
          rerankScore: r.score,
          relevanceReasoning: 'Heuristic: term coverage + validation score'
        }));
        break;
      default:
        throw new Error(`Unknown reranker type: ${rerankerType}`);
    }
    
    logger.info('RERANK_SUCCESS', `Reranking succeeded with ${rerankerType} in ${Date.now() - startTime}ms`, {
      method: rerankerType,
      totalTime: Date.now() - startTime,
      resultCount: reranked.length
    });
    
    return reranked;
  } catch (error: any) {
    logger.warn('RERANK_FALLBACK', `${rerankerType} failed, trying fallback`, {
      failedMethod: rerankerType,
      error: error.message
    });
    
    // Fallback chain: Cohere → LLM → Heuristic
    try {
      if (rerankerType !== 'llm') {
        logger.info('RERANK_FALLBACK_LLM', 'Falling back to LLM reranking');
        const reranked = await llmRerank(query, results, topK);
        logger.info('RERANK_FALLBACK_SUCCESS', `Fallback to LLM succeeded in ${Date.now() - startTime}ms`);
        return reranked;
      }
    } catch (llmError: any) {
      logger.warn('RERANK_FALLBACK_LLM_FAILED', 'LLM fallback failed', {
        error: llmError.message
      });
    }
    
    // Final fallback: heuristic
    logger.info('RERANK_FALLBACK_HEURISTIC', 'Using heuristic fallback');
    const heuristicResults = fastRerank(query, results);
    const reranked = heuristicResults.slice(0, topK).map(r => ({
      ...r,
      rerankScore: r.score,
      relevanceReasoning: 'Fallback: heuristic ranking'
    }));
    
    logger.info('RERANK_FALLBACK_COMPLETE', `Completed with heuristic in ${Date.now() - startTime}ms`, {
      totalTime: Date.now() - startTime,
      resultCount: reranked.length
    });
    
    return reranked;
  }
}

/**
 * Fast reranking using simple heuristics (no LLM call)
 * Useful for initial filtering before expensive reranking
 */
export function fastRerank(
  query: string,
  results: Array<{
    content: string;
    source: string;
    score: number;
    validationScore: number;
  }>
): typeof results {
  const startTime = Date.now();
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  logger.debug('FAST_RERANK_START', 'Starting fast reranking', {
    query: query.substring(0, 100),
    queryTerms: queryTerms.length,
    resultCount: results.length
  });
  
  const reranked = results.map(result => {
    const content = result.content.toLowerCase();
    
    // Count query term matches
    const termMatches = queryTerms.filter(term => content.includes(term)).length;
    const termCoverage = termMatches / queryTerms.length;
    
    // Boost score based on term coverage and validation
    const boostedScore = result.score * (1 + termCoverage * 0.3) * (result.validationScore * 0.2 + 0.8);
    
    return {
      ...result,
      score: boostedScore
    };
  }).sort((a, b) => b.score - a.score);
  
  logger.debug('FAST_RERANK_COMPLETE', `Fast reranking completed in ${Date.now() - startTime}ms`, {
    totalTime: Date.now() - startTime,
    avgTermCoverage: (reranked.reduce((sum, r) => {
      const content = r.content.toLowerCase();
      const matches = queryTerms.filter(term => content.includes(term)).length;
      return sum + (matches / queryTerms.length);
    }, 0) / reranked.length).toFixed(2),
    scoreChanges: reranked.slice(0, 3).map((r, i) => ({
      source: r.source,
      oldScore: results[i]?.score.toFixed(3),
      newScore: r.score.toFixed(3)
    }))
  });
  
  return reranked;
}
