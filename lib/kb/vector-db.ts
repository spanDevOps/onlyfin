import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../logger';

// Initialize Qdrant client
let qdrantClient: QdrantClient | null = null;

function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'onlyfinance-kb';

export interface KBChunk {
  id: string;
  content: string;
  metadata: {
    filename: string;
    fileType: string;
    uploadDate: string;
    chunkIndex: number;
    validationScore: number;
    sessionId: string; // User session ID for isolation
  };
}

export interface KBSearchResult {
  content: string;
  source: string;
  score: number;
  validationScore: number;
}

/**
 * Ensure collection exists with correct configuration
 */
async function ensureCollection() {
  const startTime = Date.now();
  const client = getQdrantClient();
  
  logger.debug('VECTOR_DB_ENSURE_COLLECTION_START', 'Checking collection existence', {
    collectionName: COLLECTION_NAME
  });
  
  try {
    const collection = await client.getCollection(COLLECTION_NAME);
    logger.debug('VECTOR_DB_COLLECTION_EXISTS', `Collection exists with ${collection.points_count || 0} points`, {
      pointsCount: collection.points_count || 0,
      checkTime: Date.now() - startTime
    });
  } catch (error: any) {
    logger.info('VECTOR_DB_CREATE_COLLECTION', 'Collection does not exist, creating', {
      collectionName: COLLECTION_NAME,
      vectorSize: 1536,
      distance: 'Cosine'
    });
    
    const createStart = Date.now();
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536, // text-embedding-3-small dimensions
        distance: 'Cosine',
      },
    });
    
    logger.info('VECTOR_DB_COLLECTION_CREATED', `Collection created in ${Date.now() - createStart}ms`, {
      collectionName: COLLECTION_NAME,
      createTime: Date.now() - createStart,
      totalTime: Date.now() - startTime
    });
  }
}

/**
 * Store document chunks in Qdrant
 */
export async function storeChunks(chunks: KBChunk[], embeddings: number[][], sessionId: string) {
  const startTime = Date.now();
  
  logger.info('VECTOR_DB_STORE_START', 'Storing chunks in Qdrant', {
    chunkCount: chunks.length,
    embeddingCount: embeddings.length,
    filename: chunks[0]?.metadata.filename,
    sessionId
  });
  
  const client = getQdrantClient();
  await ensureCollection();
  
  const points = chunks.map((chunk, i) => ({
    id: Date.now() + i, // Use integer ID (required by Qdrant)
    vector: embeddings[i],
    payload: {
      content: chunk.content,
      filename: chunk.metadata.filename,
      fileType: chunk.metadata.fileType,
      uploadDate: chunk.metadata.uploadDate,
      chunkIndex: chunk.metadata.chunkIndex,
      validationScore: chunk.metadata.validationScore,
      sessionId: sessionId, // Store session ID for filtering
      originalId: chunk.id,
    },
  }));
  
  logger.debug('VECTOR_DB_STORE_POINTS', 'Prepared points for upsert', {
    pointCount: points.length,
    avgValidationScore: (chunks.reduce((sum, c) => sum + c.metadata.validationScore, 0) / chunks.length).toFixed(2)
  });
  
  const upsertStart = Date.now();
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });
  
  logger.info('VECTOR_DB_STORE_COMPLETE', `Stored ${chunks.length} chunks in ${Date.now() - startTime}ms`, {
    totalTime: Date.now() - startTime,
    upsertTime: Date.now() - upsertStart,
    chunkCount: chunks.length,
    filename: chunks[0]?.metadata.filename
  });
}

/**
 * Search knowledge base for relevant chunks (filtered by session)
 */
export async function searchKB(
  queryEmbedding: number[], 
  topK: number = 5,
  sessionId?: string
): Promise<KBSearchResult[]> {
  const startTime = Date.now();
  
  logger.info('VECTOR_DB_SEARCH_START', 'Searching Qdrant', {
    topK,
    embeddingDim: queryEmbedding.length
  });
  
  try {
    const client = getQdrantClient();
    await ensureCollection();
    
    // Check if collection has any points
    const collectionStart = Date.now();
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    logger.debug('VECTOR_DB_COLLECTION_INFO', `Got collection info in ${Date.now() - collectionStart}ms`, {
      pointsCount: collectionInfo.points_count || 0
    });
    
    if (!collectionInfo.points_count || collectionInfo.points_count === 0) {
      logger.warn('VECTOR_DB_EMPTY', 'KB is empty, returning no results');
      return [];
    }
    
    const searchStart = Date.now();
    const searchParams: any = {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
    };
    
    // Filter by sessionId if provided
    if (sessionId) {
      searchParams.filter = {
        must: [
          {
            key: 'sessionId',
            match: { value: sessionId }
          }
        ]
      };
      logger.debug('VECTOR_DB_SEARCH_FILTER', 'Filtering by sessionId', { sessionId });
    }
    
    const results = await client.search(COLLECTION_NAME, searchParams);
    
    logger.debug('VECTOR_DB_SEARCH_RAW', `Vector search returned ${results.length} results in ${Date.now() - searchStart}ms`, {
      resultCount: results.length,
      searchTime: Date.now() - searchStart,
      topScores: results.slice(0, 3).map(r => r.score?.toFixed(3))
    });
    
    // Filter results by validation score in-memory
    const filterStart = Date.now();
    const filteredResults = results.filter(result => {
      const validationScore = (result.payload?.validationScore as number) || 0;
      return validationScore >= 0.7;
    });
    
    logger.debug('VECTOR_DB_FILTER', `Filtered ${results.length} → ${filteredResults.length} results in ${Date.now() - filterStart}ms`, {
      before: results.length,
      after: filteredResults.length,
      threshold: 0.7
    });
    
    const mapped = filteredResults.map(result => ({
      content: (result.payload?.content as string) || '',
      source: (result.payload?.filename as string) || 'Unknown',
      score: result.score || 0,
      validationScore: (result.payload?.validationScore as number) || 0,
    }));
    
    const uniqueSources = Array.from(new Set(mapped.map(r => r.source)));
    
    logger.info('VECTOR_DB_SEARCH_COMPLETE', `Search completed in ${Date.now() - startTime}ms`, {
      totalTime: Date.now() - startTime,
      resultCount: mapped.length,
      sources: uniqueSources,
      avgScore: mapped.length > 0 
        ? (mapped.reduce((sum, r) => sum + r.score, 0) / mapped.length).toFixed(3)
        : 0
    });
    
    return mapped;
  } catch (error: any) {
    logger.error('VECTOR_DB_SEARCH_ERROR', 'KB search failed', {
      error: error.message,
      stack: error.stack,
      topK
    });
    // Return empty results on error instead of crashing
    return [];
  }
}

/**
 * Ensure payload index exists for filename and sessionId fields
 */
async function ensurePayloadIndex() {
  const client = getQdrantClient();
  
  try {
    // Create payload index for filename field (keyword type for exact matches)
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'filename',
      field_schema: 'keyword',
    });
    logger.debug('VECTOR_DB_INDEX_CREATED', 'Created payload index for filename field');
  } catch (error: any) {
    // Index might already exist, which is fine
    if (!error.message?.includes('already exists')) {
      logger.debug('VECTOR_DB_INDEX_EXISTS', 'Payload index for filename already exists or creation skipped');
    }
  }
  
  try {
    // Create payload index for sessionId field (keyword type for exact matches)
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'sessionId',
      field_schema: 'keyword',
    });
    logger.debug('VECTOR_DB_INDEX_CREATED', 'Created payload index for sessionId field');
  } catch (error: any) {
    // Index might already exist, which is fine
    if (!error.message?.includes('already exists')) {
      logger.debug('VECTOR_DB_INDEX_EXISTS', 'Payload index for sessionId already exists or creation skipped');
    }
  }
}

/**
 * Delete all chunks from a document (filtered by session)
 */
export async function deleteDocument(filename: string, sessionId: string) {
  const startTime = Date.now();
  
  logger.info('VECTOR_DB_DELETE_START', 'Deleting document chunks', {
    filename,
    sessionId
  });
  
  const client = getQdrantClient();
  await ensureCollection();
  await ensurePayloadIndex();
  
  try {
    // Approach 1: Try filter-based deletion (most efficient)
    logger.debug('VECTOR_DB_DELETE_FILTER', 'Attempting filter-based deletion');
    const deleteStart = Date.now();
    
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          {
            key: 'filename',
            match: {
              value: filename,
            },
          },
          {
            key: 'sessionId',
            match: {
              value: sessionId,
            },
          },
        ],
      },
    });
    
    logger.info('VECTOR_DB_DELETE_COMPLETE', `Deleted document in ${Date.now() - startTime}ms`, {
      filename,
      method: 'filter',
      deleteTime: Date.now() - deleteStart,
      totalTime: Date.now() - startTime
    });
  } catch (filterError: any) {
    logger.warn('VECTOR_DB_DELETE_FILTER_FAILED', 'Filter-based deletion failed, trying ID-based approach', {
      error: filterError.message
    });
    
    try {
      // Approach 2: Fallback to scroll + delete by IDs
      const scrollStart = Date.now();
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: 'filename',
              match: {
                value: filename,
              },
            },
            {
              key: 'sessionId',
              match: {
                value: sessionId,
              },
            },
          ],
        },
        limit: 1000,
        with_payload: false,
        with_vector: false,
      });
      
      logger.debug('VECTOR_DB_DELETE_SCROLL', `Found ${scrollResult.points.length} points to delete in ${Date.now() - scrollStart}ms`, {
        filename,
        pointCount: scrollResult.points.length,
        scrollTime: Date.now() - scrollStart
      });
      
      if (scrollResult.points.length === 0) {
        logger.warn('VECTOR_DB_DELETE_NONE', 'No points found to delete', {
          filename
        });
        return;
      }
      
      // Delete by point IDs (most reliable)
      const pointIds = scrollResult.points.map(p => p.id);
      const deleteStart = Date.now();
      
      await client.delete(COLLECTION_NAME, {
        wait: true,
        points: pointIds,
      });
      
      logger.info('VECTOR_DB_DELETE_COMPLETE', `Deleted ${pointIds.length} points in ${Date.now() - startTime}ms`, {
        filename,
        method: 'id-based',
        pointCount: pointIds.length,
        deleteTime: Date.now() - deleteStart,
        totalTime: Date.now() - startTime
      });
    } catch (error: any) {
      logger.error('VECTOR_DB_DELETE_ERROR', 'All deletion methods failed', {
        error: error.message,
        stack: error.stack,
        filename
      });
      throw error;
    }
  }
}

/**
 * List all documents in the knowledge base with metadata (filtered by session)
 */
export async function listDocuments(sessionId?: string) {
  const startTime = Date.now();
  
  logger.info('VECTOR_DB_LIST_START', 'Listing all documents', { sessionId });
  
  try {
    const client = getQdrantClient();
    await ensureCollection();
    await ensurePayloadIndex(); // Ensure indexes exist before filtering
    
    // Scroll through all points to get unique documents
    const scrollStart = Date.now();
    const scrollParams: any = {
      limit: 1000,
      with_payload: true,
      with_vector: false,
    };
    
    // Filter by sessionId if provided
    if (sessionId) {
      scrollParams.filter = {
        must: [
          {
            key: 'sessionId',
            match: { value: sessionId }
          }
        ]
      };
      logger.debug('VECTOR_DB_LIST_FILTER', 'Filtering by sessionId', { sessionId });
    }
    
    const scrollResult = await client.scroll(COLLECTION_NAME, scrollParams);
    
    logger.debug('VECTOR_DB_SCROLL_COMPLETE', `Scrolled ${scrollResult.points.length} points in ${Date.now() - scrollStart}ms`, {
      pointCount: scrollResult.points.length,
      scrollTime: Date.now() - scrollStart
    });
    
    // Group by filename and aggregate metadata
    const documentsMap = new Map<string, {
      filename: string;
      fileType: string;
      uploadDate: string;
      chunkCount: number;
      avgValidationScore: number;
    }>();
    
    for (const point of scrollResult.points) {
      const filename = point.payload?.filename as string;
      const fileType = point.payload?.fileType as string;
      const uploadDate = point.payload?.uploadDate as string;
      const validationScore = (point.payload?.validationScore as number) || 0;
      
      if (!documentsMap.has(filename)) {
        documentsMap.set(filename, {
          filename,
          fileType,
          uploadDate,
          chunkCount: 1,
          avgValidationScore: validationScore,
        });
      } else {
        const doc = documentsMap.get(filename)!;
        const totalScore = doc.avgValidationScore * doc.chunkCount + validationScore;
        doc.chunkCount++;
        doc.avgValidationScore = totalScore / doc.chunkCount;
      }
    }
    
    const documents = Array.from(documentsMap.values()).sort((a, b) => 
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
    
    logger.info('VECTOR_DB_LIST_COMPLETE', `Listed ${documents.length} documents in ${Date.now() - startTime}ms`, {
      documentCount: documents.length,
      totalChunks: scrollResult.points.length,
      totalTime: Date.now() - startTime,
      documents: documents.map(d => ({ 
        filename: d.filename, 
        chunks: d.chunkCount,
        score: d.avgValidationScore.toFixed(2)
      }))
    });
    
    return documents;
  } catch (error: any) {
    logger.error('VECTOR_DB_LIST_ERROR', 'Failed to list documents', {
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}
