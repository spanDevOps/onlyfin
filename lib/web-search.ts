/**
 * Web Search Integration using Tavily API
 * API key is fetched from AWS Lambda function
 */

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
}

/**
 * Fetch Tavily API key from AWS Lambda function
 */
async function getTavilyApiKey(): Promise<string> {
  try {
    const lambdaUrl = process.env.TAVILY_LAMBDA_URL;
    if (!lambdaUrl) {
      throw new Error('TAVILY_LAMBDA_URL not configured');
    }

    const response = await fetch(lambdaUrl);
    if (!response.ok) {
      throw new Error(`Lambda returned ${response.status}`);
    }

    // Lambda returns plain text API key
    const apiKey = await response.text();
    return apiKey.trim();
  } catch (error) {
    throw new Error(`Failed to fetch Tavily API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search the web using Tavily API
 */
export async function searchWeb(query: string, maxResults: number = 5): Promise<{
  success: boolean;
  message: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}> {
  try {
    // Get API key from Lambda
    const apiKey = await getTavilyApiKey();

    // Call Tavily API
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        max_results: maxResults,
        include_domains: [], // No restrictions
        exclude_domains: [], // No exclusions
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API returned ${response.status}`);
    }

    const data: TavilyResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        success: true,
        message: 'No web results found',
        results: [],
      };
    }

    return {
      success: true,
      message: `Found ${data.results.length} web result(s)`,
      results: data.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      })),
    };
  } catch (error) {
    return {
      success: false,
      message: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      results: [],
    };
  }
}
