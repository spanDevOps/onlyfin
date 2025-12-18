import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/kb/text-extractor';
import { chunkText } from '@/lib/kb/chunker';
import { validateChunk } from '@/lib/kb/validator';
import { generateEmbeddings } from '@/lib/kb/embeddings';
import { storeChunks } from '@/lib/kb/vector-db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    logger.info('UPLOAD_START', `Processing file: ${file.name}`, {
      filename: file.name,
      size: file.size,
      type: file.type
    });
    
    // Validate file type
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(fileType || '')) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD files.' 
      }, { status: 400 });
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB.' 
      }, { status: 400 });
    }
    
    // Extract text
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, fileType!);
    
    logger.info('TEXT_EXTRACTED', `Extracted ${text.length} characters`, {
      filename: file.name,
      textLength: text.length
    });
    
    // Chunk text
    const chunks = await chunkText(text);
    
    logger.info('TEXT_CHUNKED', `Created ${chunks.length} chunks`, {
      filename: file.name,
      chunkCount: chunks.length
    });
    
    // Validate chunks (in parallel for speed)
    const validationResults = await Promise.all(
      chunks.map(chunk => validateChunk(chunk))
    );
    
    // Filter low-confidence chunks (keep only high-quality chunks with 0.7+ confidence)
    const validChunks = chunks.filter((_, i) => 
      validationResults[i].confidence >= 0.7
    );
    
    const avgValidation = validationResults.reduce((a, b) => a + b.confidence, 0) / validationResults.length;
    
    logger.info('VALIDATION_COMPLETE', `${validChunks.length}/${chunks.length} chunks passed validation`, {
      filename: file.name,
      totalChunks: chunks.length,
      validChunks: validChunks.length,
      avgValidation: avgValidation.toFixed(2)
    });
    
    // Upload file even if some chunks fail validation, but warn user
    if (validChunks.length === 0) {
      logger.warn('NO_VALID_CHUNKS', `No chunks passed validation for ${file.name}`, {
        avgValidation: avgValidation.toFixed(2),
        issues: validationResults.flatMap(r => r.issues).slice(0, 5)
      });
      
      return NextResponse.json({
        success: true,
        filename: file.name,
        chunks: 0,
        totalChunks: chunks.length,
        avgValidation: parseFloat(avgValidation.toFixed(2)),
        warnings: ['No chunks met quality standards (0.7+ confidence). File uploaded but not indexed in knowledge base.']
      });
    }
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(validChunks);
    
    logger.info('EMBEDDINGS_GENERATED', `Generated ${embeddings.length} embeddings`, {
      filename: file.name,
      embeddingCount: embeddings.length
    });
    
    // Store in vector DB
    const kbChunks = validChunks.map((content, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      content,
      metadata: {
        filename: file.name,
        fileType: fileType!,
        uploadDate: new Date().toISOString(),
        chunkIndex: i,
        validationScore: validationResults[chunks.indexOf(content)].confidence
      }
    }));
    
    await storeChunks(kbChunks, embeddings);
    
    logger.info('DOCUMENT_UPLOADED', `Document ${file.name} successfully processed and stored`, {
      filename: file.name,
      chunks: validChunks.length,
      avgValidation: avgValidation.toFixed(2)
    });
    
    // Collect warnings for low-confidence chunks
    const warnings = validationResults
      .filter(r => r.confidence >= 0.7 && r.confidence < 0.9)
      .map(r => r.reasoning)
      .slice(0, 3); // Show first 3 warnings
    
    return NextResponse.json({
      success: true,
      filename: file.name,
      chunks: validChunks.length,
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
