import { NextResponse } from 'next/server';
import { deleteDocument } from '@/lib/kb/vector-db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/kb - List all documents in knowledge base
 * TODO: Implement actual document listing from Pinecone metadata
 */
export async function GET() {
  try {
    // For now, return empty array
    // In production, query Pinecone for unique filenames and metadata
    logger.info('KB_LIST', 'Listing knowledge base documents');
    
    return NextResponse.json({
      documents: []
    });
  } catch (error) {
    logger.error('KB_LIST_ERROR', 'Failed to list documents', error);
    return NextResponse.json({ 
      error: 'Failed to list documents' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/kb - Delete a document from knowledge base
 */
export async function DELETE(req: Request) {
  try {
    const { filename } = await req.json();
    
    if (!filename) {
      return NextResponse.json({ 
        error: 'Filename is required' 
      }, { status: 400 });
    }
    
    logger.info('KB_DELETE', `Deleting document: ${filename}`);
    
    await deleteDocument(filename);
    
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
