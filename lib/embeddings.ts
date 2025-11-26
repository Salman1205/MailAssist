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
  const model = 'sentence-transformers/all-MiniLM-L6-v2'; // free, small, sentence-level encoder
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const embedding = await response.json();
    
    // Handle array of arrays (batch) or single array
    if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
      return embedding[0] as number[];
    }
    
    return embedding as number[];
  } catch (error) {
    console.error('Error generating embedding with Hugging Face:', error);
    throw error;
  }
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

