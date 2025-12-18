import { QdrantClient } from '@qdrant/js-client-rest';

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
  const client = getQdrantClient();
  
  try {
    await client.getCollection(COLLECTION_NAME);
  } catch (error) {
    // Collection doesn't exist, create it
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536, // text-embedding-3-small dimensions
        distance: 'Cosine',
      },
    });
  }
}

/**
 * Store document chunks in Qdrant
 */
export async function storeChunks(chunks: KBChunk[], embeddings: number[][]) {
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
      originalId: chunk.id,
    },
  }));
  
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });
}

/**
 * Search knowledge base for relevant chunks
 */
export async function searchKB(
  queryEmbedding: number[], 
  topK: number = 5
): Promise<KBSearchResult[]> {
  try {
    const client = getQdrantClient();
    await ensureCollection();
    
    // Check if collection has any points
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    if (!collectionInfo.points_count || collectionInfo.points_count === 0) {
      // No documents in KB yet, return empty results
      console.log('KB is empty, returning no results');
      return [];
    }
    
    const results = await client.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
    });
    
    // Filter results by validation score in-memory (since Qdrant index doesn't exist yet)
    const filteredResults = results.filter(result => {
      const validationScore = (result.payload?.validationScore as number) || 0;
      return validationScore >= 0.7;
    });
    
    return filteredResults.map(result => ({
      content: (result.payload?.content as string) || '',
      source: (result.payload?.filename as string) || 'Unknown',
      score: result.score || 0,
      validationScore: (result.payload?.validationScore as number) || 0,
    }));
  } catch (error) {
    console.error('KB search error:', error);
    // Return empty results on error instead of crashing
    return [];
  }
}

/**
 * Delete all chunks from a document
 */
export async function deleteDocument(filename: string) {
  const client = getQdrantClient();
  await ensureCollection();
  
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
      ],
    },
  });
}
