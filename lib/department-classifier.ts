/**
 * Department Classification using AI
 * Automatically classifies emails to departments based on content matching
 */

import { Department } from './departments';

export interface EmailContent {
    subject: string;
    body: string;
}

export interface ClassificationResult {
    departmentId: string | null;
    confidence: number; // 0-100
    reasoning: string;
    departmentName?: string;
}

const CONFIDENCE_THRESHOLD = 70; // Minimum confidence to auto-assign

/**
 * Classify an email to the most appropriate department using AI
 * Uses Groq API with llama model for fast classification
 */
export async function classifyEmailToDepartment(
    emailContent: EmailContent,
    departments: Department[],
    groqApiKey: string
): Promise<ClassificationResult> {
    // Handle edge cases
    if (!departments || departments.length === 0) {
        return {
            departmentId: null,
            confidence: 0,
            reasoning: 'No departments configured',
        };
    }

    if (departments.length === 1) {
        // Only one department, assign with 100% confidence
        return {
            departmentId: departments[0].id,
            confidence: 100,
            reasoning: 'Only one department available',
            departmentName: departments[0].name,
        };
    }

    // Build department descriptions for AI prompt
    const departmentList = departments
        .map((dept, idx) => `[${idx + 1}] ${dept.name}: ${dept.description}`)
        .join('\n');

    const prompt = `You are an email classifier. Analyze this email and determine which department it belongs to.

EMAIL:
Subject: ${emailContent.subject}
Body: ${emailContent.body.substring(0, 500)}${emailContent.body.length > 500 ? '...' : ''}

DEPARTMENTS:
${departmentList}

Respond with ONLY valid JSON:
{
  "departmentNumber": <1 to ${departments.length}, or 0 for Unclassified>,
  "confidence": <0-100>,
  "reasoning": "<brief reason>"
}`;

    try {
        const result = await callGroqForClassification(prompt, groqApiKey);

        // Parse AI response
        const parsed = JSON.parse(result);
        const departmentNumber = parsed.departmentNumber;
        const confidence = Math.min(100, Math.max(0, parsed.confidence || 0));
        const reasoning = parsed.reasoning || 'AI classification';

        // Map department number to ID
        if (departmentNumber === 0 || departmentNumber > departments.length || confidence < CONFIDENCE_THRESHOLD) {
            return {
                departmentId: null,
                confidence,
                reasoning: confidence < CONFIDENCE_THRESHOLD
                    ? `Low confidence (${confidence}%): ${reasoning}`
                    : reasoning,
            };
        }

        const selectedDept = departments[departmentNumber - 1];
        return {
            departmentId: selectedDept.id,
            confidence,
            reasoning,
            departmentName: selectedDept.name,
        };
    } catch (error) {
        console.error('Error classifying email to department:', error);
        return {
            departmentId: null,
            confidence: 0,
            reasoning: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Call Groq API for classification
 */
async function callGroqForClassification(prompt: string, apiKey: string): Promise<string> {
    const REQUEST_TIMEOUT = 10000; // 10 seconds for faster classification
    const model = 'llama-3.1-8b-instant'; // Smaller, faster model for classification

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an email classification assistant. You always respond with valid JSON only, no other text.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.1, // Very low temperature for consistent classification
                max_tokens: 150, // Short response expected
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = `Groq API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (parseError) {
                // Use status text if parsing fails
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('Invalid response format from Groq API');
        }

        const content = data.choices[0]?.message?.content?.trim();

        if (!content) {
            throw new Error('No content in Groq API response');
        }

        console.log('[Department Classifier] AI response:', content);
        return content;
    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error('Classification timeout: Groq API took too long to respond');
        }
        throw fetchError;
    }
}

/**
 * Get Groq API key from environment
 */
export function getGroqApiKey(): string | null {
    return process.env.GROQ_API_KEY || null;
}

/**
 * Classify email with fallback to keyword matching if AI fails
 */
export async function classifyEmailWithFallback(
    emailContent: EmailContent,
    departments: Department[],
    groqApiKey: string | null
): Promise<ClassificationResult> {
    // Try AI classification first
    if (groqApiKey) {
        try {
            const result = await classifyEmailToDepartment(emailContent, departments, groqApiKey);
            if (result.departmentId) {
                return result;
            }
            // If AI returned null, fall through to keyword matching
        } catch (error) {
            console.warn('AI classification failed, falling back to keyword matching:', error);
        }
    }

    // Fallback: Simple keyword matching
    return keywordBasedClassification(emailContent, departments);
}

/**
 * Fallback: Simple keyword-based classification
 * Matches keywords in email to department descriptions
 */
function keywordBasedClassification(
    emailContent: EmailContent,
    departments: Department[]
): ClassificationResult {
    if (departments.length === 0) {
        return { departmentId: null, confidence: 0, reasoning: 'No departments available' };
    }

    const emailText = `${emailContent.subject} ${emailContent.body}`.toLowerCase();

    // Score each department based on keyword matches
    const scored = departments.map(dept => {
        const keywords = dept.description.toLowerCase().split(/\s+/);
        let matches = 0;

        keywords.forEach(keyword => {
            if (keyword.length > 3 && emailText.includes(keyword)) {
                matches++;
            }
        });

        const confidence = Math.min(90, (matches / Math.max(1, keywords.length)) * 100);

        return {
            department: dept,
            confidence,
            matches,
        };
    });

    // Find best match
    const best = scored.sort((a, b) => b.confidence - a.confidence)[0];

    if (best.confidence >= 50) {
        return {
            departmentId: best.department.id,
            confidence: best.confidence,
            reasoning: `Keyword-based match (${best.matches} keywords matched)`,
            departmentName: best.department.name,
        };
    }

    // No good match found
    return {
        departmentId: null,
        confidence: best.confidence,
        reasoning: 'No strong keyword matches found',
    };
}
