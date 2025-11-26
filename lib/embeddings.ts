/**
 * Embedding generation utilities
 * Supports multiple embedding APIs (Hugging Face free API, OpenAI, etc.)
 */

interface EmbeddingResponse {
  embedding: number[];
}

/**
 * Generate embedding for a text using available API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const embeddingEnvKey = process.env.EMBEDDING_API_KEY;
  const provider = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();

  console.log(`[EMBEDDING] Provider: ${provider}, Has API Key: ${!!embeddingEnvKey}, Has OpenAI Key: ${!!openAiKey}`);

  if (provider === 'openai') {
    const key = openAiKey || embeddingEnvKey;
    if (!key) {
      throw new Error('OPENAI_API_KEY or EMBEDDING_API_KEY must be set to use OpenAI embeddings.');
    }
    return generateEmbeddingOpenAI(text, key);
  }

  if (provider === 'huggingface') {
    return generateEmbeddingHuggingFace(text, embeddingEnvKey);
  }

  return generateEmbeddingLocal(text);
}

/**
 * Generate embedding using Hugging Face Inference API (free tier)
 */
async function generateEmbeddingHuggingFace(
  text: string,
  apiKey?: string
): Promise<number[]> {
  // Use BAAI/bge-small-en-v1.5 - works reliably with router API
  // sentence-transformers/all-MiniLM-L6-v2 has pipeline routing issues on router API
  const model = 'BAAI/bge-small-en-v1.5';
  
  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY must be set to use Hugging Face embeddings');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Use the router models endpoint (not pipeline endpoint - that's 404)
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  
  // Truncate text to reasonable length (Hugging Face has limits)
  const truncatedText = text.slice(0, 512);

  let lastError: Error | null = null;
  const maxRetries = 3;
  
  console.log(`[HF Embedding] Starting embedding generation for text (${truncatedText.length} chars), model: ${model}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[HF Embedding] Attempt ${attempt}/${maxRetries} - Calling ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: truncatedText,
          options: {
            wait_for_model: true,
          },
        }),
      });

      console.log(`[HF Embedding] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HF Embedding] Error response body:`, errorText.slice(0, 500));
        
        let errorMessage = `Hugging Face API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
          console.error(`[HF Embedding] Parsed error:`, errorJson);
        } catch {
          // If not JSON, use the text as-is
          if (errorText) {
            errorMessage = `${errorMessage} - ${errorText.slice(0, 200)}`;
          }
        }
        
        // Handle rate limiting (429) or model loading (503) with retry
        if (response.status === 429 || response.status === 503) {
          const waitTime = attempt * 2000; // 2s, 4s, 6s
          console.warn(`[HF Embedding] Rate limit/model loading (${response.status}), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        }
        
        throw new Error(errorMessage);
      }

      const embedding = await response.json();
      console.log(`[HF Embedding] Success! Response type:`, Array.isArray(embedding) ? 'array' : typeof embedding, 'Length:', Array.isArray(embedding) ? embedding.length : 'N/A');
      
      // Handle different response formats
      if (Array.isArray(embedding)) {
        // If it's an array of arrays (batch response), take first
        if (Array.isArray(embedding[0])) {
          return embedding[0] as number[];
        }
        // If it's a single array, return it
        if (typeof embedding[0] === 'number') {
          return embedding as number[];
        }
      }
      
      // Sometimes HF returns an object with the embedding
      if (embedding && Array.isArray(embedding.embedding)) {
        return embedding.embedding as number[];
      }
      
      throw new Error(`Unexpected Hugging Face response format: ${JSON.stringify(embedding).slice(0, 100)}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors (auth, bad request)
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.includes('400')
      )) {
        throw lastError;
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // 1s, 2s, 3s
        console.warn(`[HF Embedding] Attempt ${attempt} failed:`, lastError.message, `Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`[HF Embedding] All ${maxRetries} attempts failed. Last error:`, lastError);
      }
    }
  }
  
  // All retries failed
  console.error(`[HF Embedding] FAILED after ${maxRetries} attempts. Error:`, lastError?.message || lastError);
  throw lastError || new Error('Failed to generate embedding with Hugging Face');
}

/**
 * Generate embedding using OpenAI API
 */
async function generateEmbeddingOpenAI(
  text: string,
  apiKey: string
): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // Cost-effective option
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding with OpenAI:', error);
    throw error;
  }
}

let localPipelinePromise: Promise<any> | null = null;

async function generateEmbeddingLocal(text: string): Promise<number[]> {
  const extractor = await getLocalPipeline();
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

async function getLocalPipeline() {
  if (!localPipelinePromise) {
    localPipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      });
    })();
  }
  return localPipelinePromise;
}

/**
 * Generate embeddings for multiple texts in batch
 * Optimized for speed with parallel processing and rate limiting
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 10,
  delayMs: number = 100
): Promise<number[][]> {
  const results: number[][] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text).catch(err => {
        console.error('Error generating embedding:', err);
        return []; // Return empty array on error
      }))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches to respect rate limits (except for last batch)
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

