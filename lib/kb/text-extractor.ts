/**
 * Extract text from various document formats
 */
export async function extractText(
  buffer: Buffer, 
  fileType: string
): Promise<string> {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      // Dynamic import to avoid webpack issues
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(buffer);
      return pdfData.text;
      
    case 'docx':
      // Dynamic import
      const mammoth = await import('mammoth');
      const docxResult = await mammoth.default.extractRawText({ buffer });
      return docxResult.value;
      
    case 'txt':
    case 'md':
      return buffer.toString('utf-8');
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
