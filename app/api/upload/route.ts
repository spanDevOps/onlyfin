import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/kb/text-extractor';
import { chunkText } from '@/lib/kb/chunker';
import { validateChunk } from '@/lib/kb/validator';
import { generateEmbeddings } from '@/lib/kb/embeddings';
import { storeChunks } from '@/lib/kb/vector-db';
import { logger } from '@/lib/logger';
import { handleKBError, validateFile, retryWithBackoff, KBError, ErrorCode } from '@/lib/kb/error-handler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let filename = 'unknown';
  
  try {
    // Get sessionId from header
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    filename = file.name;
    
    logger.info('UPLOAD_START', `Processing file: ${filename}`, {
      filename,
      size: file.size,
      type: file.type
    });
    
    // Validate file with enhanced error handling
    try {
      validateFile(file);
    } catch (error) {
      const handled = handleKBError(error, { operation: 'validation', filename });
      return NextResponse.json({ error: handled.message }, { status: 400 });
    }
    
    const fileType = file.name.split('.').pop()?.toLowerCase()!;
    
    // Extract text with retry
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await retryWithBackoff(async () => {
      try {
        return await extractText(buffer, fileType);
      } catch (error) {
        throw new KBError(
          'Text extraction failed',
          ErrorCode.EXTRACTION_FAILED,
          { filename, error: error.message },
          true
        );
      }
    });
    
    logger.info('TEXT_EXTRACTED', `Extracted ${text.length} characters`, {
      filename,
      textLength: text.length
    });
    
    // Chunk text with enhanced options
    const chunks = await retryWithBackoff(async () => {
      try {
        return await chunkText(text, {
          maxTokens: 600,
          overlap: 100,
          preserveSentences: true,
          preserveContext: true
        });
      } catch (error) {
        throw new KBError(
          'Chunking failed',
          ErrorCode.CHUNKING_FAILED,
          { filename, error: error.message },
          true
        );
      }
    });
    
    logger.info('TEXT_CHUNKED', `Created ${chunks.length} chunks`, {
      filename,
      chunkCount: chunks.length
    });
    
    // Validate chunks (in parallel for speed) with error handling
    const validationResults = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          return await validateChunk(chunk);
        } catch (error) {
          logger.warn('VALIDATION_ERROR', `Chunk validation failed, using default`, {
            filename,
            error: error.message
          });
          // Return default validation on error
          return {
            isValid: true,
            confidence: 0.7,
            issues: ['Validation failed, using default score'],
            reasoning: 'Validation service unavailable'
          };
        }
      })
    );
    
    // Filter invalid chunks (keep only valid chunks with 0.7+ confidence)
    const validChunksWithIndices = chunks
      .map((chunk, i) => ({ chunk, index: i, validation: validationResults[i] }))
      .filter(item => item.validation.isValid && item.validation.confidence >= 0.7);
    
    const validChunks = validChunksWithIndices.map(item => item.chunk);
    
    // Calculate average validation score (0 for invalid, confidence for valid)
    const validationScores = validationResults.map(v => 
      v.isValid ? v.confidence : 0
    );
    const avgValidation = validationScores.reduce((a, b) => a + b, 0) / validationScores.length;
    
    logger.info('VALIDATION_COMPLETE', `${validChunks.length}/${chunks.length} chunks passed validation`, {
      filename: file.name,
      totalChunks: chunks.length,
      validChunks: validChunks.length,
      avgValidation: avgValidation.toFixed(2)
    });
    
    // If no chunks passed validation, store the original chunks with 0 validation score
    // This allows users to see rejected documents in K-Base with "Insufficient Quality" label
    const chunksToStore = validChunks.length > 0 ? validChunksWithIndices : chunks.map((chunk, i) => ({
      chunk,
      index: i,
      validation: { confidence: 0, isValid: false, issues: validationResults[i].issues, reasoning: validationResults[i].reasoning }
    }));
    
    if (validChunks.length === 0) {
      logger.warn('NO_VALID_CHUNKS', `No chunks passed validation for ${file.name}, storing with 0 score`, {
        avgValidation: avgValidation.toFixed(2),
        issues: validationResults.flatMap(r => r.issues).slice(0, 5)
      });
    }
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(chunksToStore.map(item => item.chunk));
    
    logger.info('EMBEDDINGS_GENERATED', `Generated ${embeddings.length} embeddings`, {
      filename: file.name,
      embeddingCount: embeddings.length
    });
    
    // Store in vector DB
    const kbChunks = chunksToStore.map((item, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      content: item.chunk,
      metadata: {
        filename: file.name,
        fileType: fileType!,
        uploadDate: new Date().toISOString(),
        chunkIndex: i,
        validationScore: item.validation.confidence,
        sessionId: sessionId // Add session ID for user isolation
      }
    }));
    
    await storeChunks(kbChunks, embeddings, sessionId);
    
    logger.info('DOCUMENT_UPLOADED', `Document ${file.name} successfully processed and stored`, {
      filename: file.name,
      chunks: chunksToStore.length,
      validChunks: validChunks.length,
      avgValidation: avgValidation.toFixed(2)
    });
    
    // Collect warnings
    const warnings: string[] = [];
    
    // Warn if no chunks passed validation
    if (validChunks.length === 0) {
      warnings.push('Document failed quality validation and is marked as "Insufficient Quality". Review and correct the content.');
    }
    
    // Warn for low-confidence chunks
    const lowConfWarnings = validationResults
      .filter(r => r.isValid && r.confidence >= 0.7 && r.confidence < 0.9)
      .map(r => r.reasoning)
      .slice(0, 2);
    warnings.push(...lowConfWarnings);
    
    return NextResponse.json({
      success: true,
      filename: file.name,
      chunks: chunksToStore.length,
      validChunks: validChunks.length,
      totalChunks: chunks.length,
      avgValidation: parseFloat(avgValidation.toFixed(2)),
      warnings: warnings.length > 0 ? warnings : undefined
    });
    
  } catch (error) {
    logger.error('UPLOAD_ERROR', 'Document upload failed', error);
    return NextResponse.json({ 
      error: 'Upload failed. Please try again.' 
    }, { status: 500 });
  }
}
