import { logger } from '../logger';

/**
 * Extract text from various document formats
 */
export async function extractText(
  buffer: Buffer, 
  fileType: string
): Promise<string> {
  const startTime = Date.now();
  
  logger.info('TEXT_EXTRACT_START', 'Extracting text from document', {
    fileType,
    bufferSize: buffer.length
  });
  
  try {
    let text: string;
    
    switch (fileType.toLowerCase()) {
      case 'pdf':
        logger.debug('TEXT_EXTRACT_PDF', 'Loading PDF parser');
        const pdfParse = await import('pdf-parse-fork');
        const pdfStart = Date.now();
        const pdfData = await pdfParse.default(buffer);
        logger.debug('TEXT_EXTRACT_PDF_PARSED', `Parsed PDF in ${Date.now() - pdfStart}ms`, {
          pages: pdfData.numpages,
          parseTime: Date.now() - pdfStart
        });
        text = pdfData.text;
        break;
        
      case 'docx':
        logger.debug('TEXT_EXTRACT_DOCX', 'Loading DOCX parser');
        const mammoth = await import('mammoth');
        const docxStart = Date.now();
        const docxResult = await mammoth.default.extractRawText({ buffer });
        logger.debug('TEXT_EXTRACT_DOCX_PARSED', `Parsed DOCX in ${Date.now() - docxStart}ms`, {
          parseTime: Date.now() - docxStart
        });
        text = docxResult.value;
        break;
        
      case 'txt':
      case 'md':
        logger.debug('TEXT_EXTRACT_PLAIN', 'Reading plain text file');
        text = buffer.toString('utf-8');
        break;
        
      default:
        logger.error('TEXT_EXTRACT_UNSUPPORTED', 'Unsupported file type', {
          fileType
        });
        throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    logger.info('TEXT_EXTRACT_COMPLETE', `Extracted ${text.length} characters in ${Date.now() - startTime}ms`, {
      fileType,
      textLength: text.length,
      time: Date.now() - startTime,
      preview: text.substring(0, 100)
    });
    
    return text;
  } catch (error: any) {
    logger.error('TEXT_EXTRACT_ERROR', 'Failed to extract text', {
      error: error.message,
      stack: error.stack,
      fileType,
      bufferSize: buffer.length
    });
    throw error;
  }
}
