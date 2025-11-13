import type { Event } from './events'
import type { MessageAction } from './actions'
import type { Plan } from './plan' // ← Vai criar isso
import { isAction } from './events'

export interface ClarificationRecord {
  id: string
  questions: string[]
  reason: string
  userResponses?: string[]
  timestamp: number
  resolved: boolean
}

export class State {
  // Core
  history: Event[] = []
  sessionId: string
  metadata: Record<string, unknown> = {}
  
  // Planning
  currentPlan: Plan | null = null
  planHistory: Plan[] = []
  
  // Clarifications
  private clarifications: ClarificationRecord[] = []
  isWaitingForUser = false
  
  constructor(sessionId: string) {
    this.sessionId = sessionId
  }
  
  // === Event Management ===
  
  addEvent(event: Event): void {
    this.history.push(event)
  }
  
  getRecentHistory(n: number): Event[] {
    return this.history.slice(-n)
  }
  
  getLastUserMessage(): MessageAction | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const event = this.history[i]
      if (isAction(event) && event.action === 'message' && event.source === 'user') {
        return event as MessageAction
      }
    }
    return null
  }
  
  // === Plan Management ===
  
  setPlan(plan: Plan): void {
    // Salva versão anterior no histórico
    if (this.currentPlan) {
      this.planHistory.push(this.currentPlan)
    }
    this.currentPlan = plan
  }
  
  getPlan(): Plan | null {
    return this.currentPlan
  }
  
  hasPlan(): boolean {
    return this.currentPlan !== null
  }
  
  // === Clarification Management ===
  
  recordClarification(questions: string[], reason: string, id: string): ClarificationRecord {
    const record: ClarificationRecord = {
      id,
      questions,
      reason,
      timestamp: Date.now(),
      resolved: false
    }
    
    this.clarifications.push(record)
    this.isWaitingForUser = true
    
    return record
  }
  
  resolveClarification(id: string, responses: string[]): boolean {
    const clarification = this.clarifications.find(c => c.id === id)
    if (clarification) {
      clarification.userResponses = responses
      clarification.resolved = true
      this.isWaitingForUser = false
      return true
    }
    return false
  }
  
  getLastUnresolvedClarification(): ClarificationRecord | null {
    for (let i = this.clarifications.length - 1; i >= 0; i--) {
      if (!this.clarifications[i].resolved) {
        return this.clarifications[i]
      }
    }
    return null
  }
  
  // === Utils ===
  
  reset(): void {
    this.history = []
    this.currentPlan = null
    this.planHistory = []
    this.clarifications = []
    this.isWaitingForUser = false
    this.metadata = {}
  }
  
  toSummary(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      hasPlan: this.hasPlan(),
      planVersion: this.currentPlan?.version,
      historyLength: this.history.length,
      isWaitingForUser: this.isWaitingForUser
    }
  }
}