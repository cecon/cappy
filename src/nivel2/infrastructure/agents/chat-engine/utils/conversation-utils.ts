import type { GreetingInfo } from '../types'
import { GREETING_RESPONSE } from '../prompts/system-prompts-v2'

/**
 * Detect simple greetings and return appropriate response
 */
export function detectGreeting(message: string): GreetingInfo {
  const greetingPatterns = /^(oi|olá|hello|hi|hey|bom dia|boa tarde|boa noite)\.?!?$/i
  const messageText = message.trim()
  
  console.log(`[GreetingDetector] Analyzing message: "${messageText}" (length: ${messageText.length})`)
  
  // Also check for very short messages that are likely greetings
  const isShortGreeting = messageText.length <= 3 && /^(oi|hi)$/i.test(messageText)
  const isLongGreeting = greetingPatterns.test(messageText)
  
  if (isShortGreeting || isLongGreeting) {
    console.log(`[GreetingDetector] Simple greeting detected: "${messageText}" (short=${isShortGreeting}, long=${isLongGreeting})`)
    return {
      isGreeting: true,
      response: GREETING_RESPONSE
    }
  }
  
  console.log(`[GreetingDetector] Not a greeting: "${messageText}"`)
  return { isGreeting: false }
}

/**
 * Generate session ID for tracking conversation state
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Check if we've reached max steps
 */
export function shouldStopDueToMaxSteps(step: number, maxSteps: number): boolean {
  if (step >= maxSteps) {
    console.warn(`[Analyst] Reached maximum steps (${maxSteps}), stopping to prevent infinite loop`)
    return true
  }
  return false
}