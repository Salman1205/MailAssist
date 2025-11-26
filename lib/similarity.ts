/**
 * Similarity search utilities for finding relevant past emails
 */

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find most similar emails to a query embedding
 */
export function findSimilarEmails(
  queryEmbedding: number[],
  emailEmbeddings: Array<{ emailId: string; embedding: number[]; email: any }>,
  topK: number = 5
): Array<{ emailId: string; similarity: number; email: any }> {
  const similarities = emailEmbeddings.map((item) => ({
    emailId: item.emailId,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
    email: item.email,
  }));

  // Sort by similarity (descending) and return top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((item) => item.similarity > 0.3); // Filter out very low similarity matches
}

/**
 * Combine subject and body for better context matching
 */
export function createEmailContext(subject: string, body: string): string {
  return `${subject}\n\n${body}`.trim();
}


