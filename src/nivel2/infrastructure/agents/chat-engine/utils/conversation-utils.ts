import type { GreetingInfo } from '../types'
import { GREETING_RESPONSE } from '../prompts/system-prompts-v2'

/**
 * Detect simple greetings and return appropriate response
 */
export function detectGreeting(message: string): GreetingInfo {
  const messageText = message.trim().toLowerCase()
  
  console.log(`[GreetingDetector] Analyzing message: "${messageText}" (length: ${messageText.length})`)
  
  // Common greetings in multiple languages
  const greetings = ['oi', 'ola', 'olá', 'hello', 'hi', 'hey', 'hola', 'bom dia', 'boa tarde', 'boa noite']
  
  // Check if message is exactly a greeting (with optional punctuation)
  const cleanMessage = messageText.replace(/[.!?]+$/, '')
  const isGreeting = greetings.includes(cleanMessage)
  
  // Also check for very short messages that are likely greetings  
  const isShortGreeting = messageText.length <= 5 && /^(oi|ola|olá|hi|hey|hola)$/i.test(messageText)
  
  if (isGreeting || isShortGreeting) {
    console.log(`[GreetingDetector] ✅ Greeting detected: "${messageText}" (exact=${isGreeting}, short=${isShortGreeting})`)
    return {
      isGreeting: true,
      response: GREETING_RESPONSE
    }
  }
  
  console.log(`[GreetingDetector] ❌ Not a greeting: "${messageText}"`)
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