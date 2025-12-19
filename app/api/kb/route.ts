import { NextResponse } from 'next/server';
import { deleteDocument } from '@/lib/kb/vector-db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/kb - List all documents in knowledge base (filtered by session)
 */
export async function GET(req: Request) {
  try {
    // Get sessionId from header
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    logger.info('KB_LIST', 'Listing knowledge base documents');
    
    const { listDocuments } = await import('@/lib/kb/vector-db');
    const docs = await listDocuments(sessionId);
    
    // Transform to match frontend interface
    const documents = docs.map(doc => ({
      id: doc.filename, // Use filename as unique ID
      filename: doc.filename,
      uploadDate: doc.uploadDate,
      chunks: doc.chunkCount,
      avgValidation: doc.avgValidationScore
    }));
    
    return NextResponse.json({
      documents
    });
  } catch (error) {
    logger.error('KB_LIST_ERROR', 'Failed to list documents', error);
    return NextResponse.json({ 
      error: 'Failed to list documents' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/kb - Delete a document from knowledge base (filtered by session)
 */
export async function DELETE(req: Request) {
  try {
    // Get sessionId from header
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const { filename } = await req.json();
    
    if (!filename) {
      return NextResponse.json({ 
        error: 'Filename is required' 
      }, { status: 400 });
    }
    
    logger.info('KB_DELETE', `Deleting document: ${filename}`);
    
    await deleteDocument(filename, sessionId);
    
    logger.info('KB_DELETE_SUCCESS', `Document deleted: ${filename}`);
    
    return NextResponse.json({ 
      success: true,
      message: `Document ${filename} deleted successfully`
    });
  } catch (error) {
    logger.error('KB_DELETE_ERROR', 'Failed to delete document', error);
    return NextResponse.json({ 
      error: 'Failed to delete document' 
    }, { status: 500 });
  }
}
