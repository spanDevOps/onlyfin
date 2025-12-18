export interface Citation {
  id: string;
  source: string;
  content: string;
  validationScore: number;
  uploadDate: string;
  chunkId: string;
}

/**
 * Format citation for display
 */
export function formatCitation(
  citation: Citation, 
  style: 'inline' | 'footnote' = 'inline'
): string {
  if (style === 'inline') {
    return `[Source: ${citation.source}, validation: ${(citation.validationScore * 100).toFixed(0)}%]`;
  }
  return `¹ ${citation.source} (uploaded ${citation.uploadDate})`;
}

/**
 * Build KB context string with citations for LLM
 */
export function buildKBContext(results: Array<{
  content: string;
  source: string;
  validationScore: number;
}>): string {
  if (results.length === 0) {
    return 'No relevant knowledge base documents found.';
  }
  
  return results.map((result, i) => 
    `[KB Source ${i+1}] ${result.source} (validation: ${(result.validationScore * 100).toFixed(0)}%):\n${result.content}`
  ).join('\n\n');
}
