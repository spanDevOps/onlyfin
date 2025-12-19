import { logger } from '../logger';

export class KBError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'KBError';
  }
}

export enum ErrorCode {
  // Upload errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  
  // Processing errors
  CHUNKING_FAILED = 'CHUNKING_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  
  // Storage errors
  STORAGE_FAILED = 'STORAGE_FAILED',
  RETRIEVAL_FAILED = 'RETRIEVAL_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  
  // Search errors
  SEARCH_FAILED = 'SEARCH_FAILED',
  RERANK_FAILED = 'RERANK_FAILED',
  
  // Connection errors
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  
  // Data quality errors
  NO_VALID_CHUNKS = 'NO_VALID_CHUNKS',
  LOW_QUALITY_CONTENT = 'LOW_QUALITY_CONTENT',
}

export interface ErrorContext {
  operation: string;
  filename?: string;
  query?: string;
  details?: any;
}

/**
 * Handle KB errors with logging and user-friendly messages
 */
export function handleKBError(
  error: any,
  context: ErrorContext
): { message: string; code: string; recoverable: boolean } {
  // Log the error
  logger.error(`KB_ERROR_${context.operation.toUpperCase()}`, 
    `Error in ${context.operation}`, 
    {
      ...context,
      error: error.message,
      stack: error.stack
    }
  );
  
  // Handle known error types
  if (error instanceof KBError) {
    return {
      message: getUserFriendlyMessage(error.code, context),
      code: error.code,
      recoverable: error.recoverable
    };
  }
  
  // Handle common error patterns
  if (error.message?.includes('rate limit')) {
    return {
      message: 'Service is temporarily busy. Please try again in a moment.',
      code: ErrorCode.API_RATE_LIMIT,
      recoverable: true
    };
  }
  
  if (error.message?.includes('connection') || error.message?.includes('ECONNREFUSED')) {
    return {
      message: 'Unable to connect to knowledge base. Please try again.',
      code: ErrorCode.DB_CONNECTION_FAILED,
      recoverable: true
    };
  }
  
  if (error.message?.includes('timeout')) {
    return {
      message: 'Operation timed out. Please try again with a smaller file or simpler query.',
      code: ErrorCode.RETRIEVAL_FAILED,
      recoverable: true
    };
  }
  
  // Generic error
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    recoverable: true
  };
}

/**
 * Get user-friendly error messages
 */
function getUserFriendlyMessage(code: string, context: ErrorContext): string {
  const messages: Record<string, string> = {
    [ErrorCode.FILE_TOO_LARGE]: 'File is too large. Maximum size is 10MB.',
    [ErrorCode.UNSUPPORTED_FORMAT]: 'File format not supported. Please upload PDF, DOCX, TXT, or MD files.',
    [ErrorCode.EXTRACTION_FAILED]: `Unable to extract text from ${context.filename}. The file may be corrupted or password-protected.`,
    [ErrorCode.CHUNKING_FAILED]: 'Failed to process document content. Please try again.',
    [ErrorCode.VALIDATION_FAILED]: 'Unable to validate document quality. Upload will proceed without validation.',
    [ErrorCode.EMBEDDING_FAILED]: 'Failed to generate embeddings. Please try again.',
    [ErrorCode.STORAGE_FAILED]: 'Failed to store document in knowledge base. Please try again.',
    [ErrorCode.RETRIEVAL_FAILED]: 'Failed to retrieve documents. Please try again.',
    [ErrorCode.DELETE_FAILED]: `Failed to delete ${context.filename}. Please try again.`,
    [ErrorCode.SEARCH_FAILED]: 'Search failed. Please try again with a different query.',
    [ErrorCode.RERANK_FAILED]: 'Failed to rank results. Showing results by similarity instead.',
    [ErrorCode.DB_CONNECTION_FAILED]: 'Unable to connect to knowledge base. Please check your connection.',
    [ErrorCode.API_RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
    [ErrorCode.NO_VALID_CHUNKS]: `No content in ${context.filename} met quality standards. File uploaded but not indexed.`,
    [ErrorCode.LOW_QUALITY_CONTENT]: 'Document quality is low. Some content may not be indexed.',
  };
  
  return messages[code] || 'An error occurred. Please try again.';
}

/**
 * Retry wrapper with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry non-recoverable errors
      if (error instanceof KBError && !error.recoverable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      logger.info('RETRY_ATTEMPT', `Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): void {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['pdf', 'docx', 'txt', 'md'];
  
  if (file.size > maxSize) {
    throw new KBError(
      'File too large',
      ErrorCode.FILE_TOO_LARGE,
      { size: file.size, maxSize },
      false
    );
  }
  
  const fileType = file.name.split('.').pop()?.toLowerCase();
  if (!fileType || !allowedTypes.includes(fileType)) {
    throw new KBError(
      'Unsupported file format',
      ErrorCode.UNSUPPORTED_FORMAT,
      { fileType, allowedTypes },
      false
    );
  }
}
