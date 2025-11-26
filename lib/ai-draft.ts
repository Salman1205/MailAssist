/**
 * AI draft generation using Groq API
 * Generates email drafts based on user's past email style and tone
 */

import { findSimilarEmails } from './similarity';
import { generateEmbedding } from './embeddings';
import { createEmailContext } from './similarity';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date?: string;
}

interface StoredEmail extends Email {
  embedding: number[];
}

/**
 * Generate a draft reply for an incoming email
 */
export async function generateDraftReply(
  incomingEmail: Email,
  pastEmails: StoredEmail[],
  groqApiKey: string
): Promise<string> {
  // Generate embedding for the incoming email
  const queryContext = createEmailContext(incomingEmail.subject, incomingEmail.body);
  const queryEmbedding = await generateEmbedding(queryContext);

  // Find similar past emails to match tone and style
  const similarEmails = findSimilarEmails(
    queryEmbedding,
    pastEmails.map((email) => ({
      emailId: email.id,
      embedding: email.embedding,
      email,
    })),
    5 // Top 5 most similar emails
  );

  // Build context from similar emails
  const styleExamples = similarEmails
    .map(
      (item) => `Subject: ${item.email.subject}\nBody: ${item.email.body}`
    )
    .join('\n\n---\n\n');

  // Create prompt for Groq
  const prompt = createDraftPrompt(incomingEmail, styleExamples);

  // Call Groq API
  const draft = await callGroqAPI(prompt, groqApiKey);

  return draft;
}

/**
 * Create prompt for draft generation
 */
function createDraftPrompt(incomingEmail: Email, styleExamples: string): string {
  return `You are an AI assistant helping to draft email replies. Your task is to generate a professional, contextually appropriate email draft that matches the user's writing style.

INCOMING EMAIL TO REPLY TO:
Subject: ${incomingEmail.subject}
From: ${incomingEmail.from}
Body:
${incomingEmail.body}

USER'S PAST EMAIL STYLE EXAMPLES (use these to match tone and style):
${styleExamples || 'No past examples available. Use a professional, friendly tone.'}

INSTRUCTIONS:
1. Analyze the incoming email and understand what it's asking or discussing.
2. Match the tone and style of the user's past emails shown above.
3. Generate a draft reply that:
   - Addresses the key points in the incoming email
   - Matches the user's writing style and tone
   - Is professional and appropriate
   - Asks clarifying questions if the incoming email is unclear or needs more information
   - Is concise but complete
4. Output ONLY the draft email body text (no subject line, no metadata, just the reply text).
5. Do not include placeholders like [Your Name] - write as if the user is writing directly.
6. If the incoming email requires action or has questions, address them directly.

Generate the draft reply now:`;
}

/**
 * Call Groq API to generate draft
 */
async function callGroqAPI(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Use the latest Groq Llama model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates email drafts matching the user\'s writing style.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const draft = data.choices[0]?.message?.content?.trim();

    if (!draft) {
      throw new Error('No draft generated from Groq API');
    }

    return draft;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    throw error;
  }
}


