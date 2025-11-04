import type { RetrievalResult, Question, Option } from '../types'

/**
 * Parse JSON response with better error handling
 */
export function parseJsonSafely<T>(text: string, fallback: T, context: string): T {
  try {
    // Remove markdown code blocks
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON from the text
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn(`[${context}] No JSON found in text:`, text.substring(0, 200))
      return fallback
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    console.log(`[${context}] Successfully parsed JSON:`, parsed)
    return parsed
    
  } catch (error) {
    console.warn(`[${context}] Failed to parse JSON:`, error)
    console.log(`[${context}] Text was:`, text.substring(0, 500))
    return fallback
  }
}

/**
 * Parse retrieval results from tool response
 */
export function parseRetrievalResult(result: string): RetrievalResult[] {
  console.log('[parseRetrievalResult] Processing result:', result.substring(0, 200))
  
  // Check if result looks like formatted text (with emojis) rather than JSON
  if (result.includes('📊') || result.includes('ℹ️') || result.includes('Found ') || result.includes('No relevant')) {
    console.log('[parseRetrievalResult] Text format detected, returning empty array')
    return []
  }
  
  return parseJsonSafely<RetrievalResult[]>(result, [], 'parseRetrievalResult')
}

/**
 * Parse intent from JSON response
 */
export function parseIntent(text: string) {
  const fallback = {
    objective: "Process user request",
    technicalTerms: [],
    category: "other" as const,
    clarityScore: 0.5,
    ambiguities: ["Unable to parse intent clearly"]
  }
  
  return parseJsonSafely(text, fallback, 'parseIntent')
}

/**
 * Parse questions from JSON response
 */
export function parseQuestions(text: string): Question[] {
  const fallback: Question[] = []
  
  const result = parseJsonSafely<{ questions: Question[] }>(
    text, 
    { questions: fallback }, 
    'parseQuestions'
  )
  
  return result.questions || fallback
}

/**
 * Parse options from JSON response
 */
export function parseOptions(text: string): Option[] {
  const fallback: Option[] = []
  
  const result = parseJsonSafely<{ options: Option[] }>(
    text,
    { options: fallback },
    'parseOptions'
  )
  
  return result.options || fallback
}