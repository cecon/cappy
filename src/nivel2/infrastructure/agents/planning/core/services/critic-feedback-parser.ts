import type { CriticFeedback } from '../../types'

export class CriticFeedbackParser {
  parse(raw: string): CriticFeedback[] {
    const structured = this.tryParseJson(raw)
    if (structured.length) {
      return structured
    }

    const fallback = this.parseFallbackPatterns(raw)
    if (fallback.length) {
      return fallback
    }

    return [
      {
        category: 'scope-gap',
        severity: 'critical',
        issue: 'The critic agent could not determine next steps. Ask the user to clarify the most uncertain part of the request.',
        suggestion: 'Request a clarification from the user to continue the planning loop.',
        requiresClarification: true
      }
    ]
  }

  private tryParseJson(raw: string): CriticFeedback[] {
    const payload = this.extractJsonPayload(raw)
    if (!payload) {
      return []
    }

    try {
      const parsed = JSON.parse(payload)
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      const feedback: CriticFeedback[] = []
      for (const entry of entries) {
        const normalized = this.normalizeEntry(entry)
        if (normalized) {
          feedback.push(normalized)
        }
      }
      return feedback
    } catch (error) {
      console.warn('[CriticFeedbackParser] Failed to parse JSON payload', error)
      return []
    }
  }

  private normalizeEntry(entry: unknown): CriticFeedback | null {
    if (!entry || typeof entry !== 'object') {
      return null
    }

    const candidate = entry as Record<string, unknown>
    const issue = typeof candidate.issue === 'string' ? candidate.issue.trim() : ''
    if (!issue) {
      return null
    }

    const severity = this.coerceSeverity(candidate.severity as string | undefined)

    return {
      category: this.coerceCategory(candidate.category as string | undefined),
      severity,
      target: typeof candidate.target === 'string' ? candidate.target : undefined,
      issue,
      suggestion: typeof candidate.suggestion === 'string' ? candidate.suggestion.trim() : '',
      requiresClarification: typeof candidate.requiresClarification === 'boolean'
        ? candidate.requiresClarification
        : severity !== 'info',
      impact: typeof candidate.impact === 'string' ? candidate.impact.trim() : undefined
    }
  }

  private parseFallbackPatterns(raw: string): CriticFeedback[] {
    const feedback: CriticFeedback[] = []
    const fallbackPatterns: Array<{ pattern: RegExp; severity: 'critical' | 'warning' | 'info' }> = [
      { pattern: /^\s*\*?\s*CRITICAL[:-]\s*(.+)$/gim, severity: 'critical' },
      { pattern: /^\s*\*?\s*WARNING[:-]\s*(.+)$/gim, severity: 'warning' },
      { pattern: /^\s*\*?\s*INFO[:-]\s*(.+)$/gim, severity: 'info' }
    ]

    for (const { pattern, severity } of fallbackPatterns) {
      for (const match of raw.matchAll(pattern)) {
        const issue = match[1]?.trim()
        if (!issue) {
          continue
        }

        feedback.push({
          category: 'scope-gap',
          severity,
          issue,
          suggestion: '',
          requiresClarification: severity !== 'info'
        })
      }
    }

    return feedback
  }

  private extractJsonPayload(raw: string): string | null {
    const blockRegex = /```json([\s\S]*?)```/i
    const blockMatch = blockRegex.exec(raw)
    if (blockMatch) {
      return blockMatch[1].trim()
    }

    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return raw.slice(firstBrace, lastBrace + 1).trim()
    }

    return null
  }

  private coerceCategory(category: string | undefined): CriticFeedback['category'] {
    const allowed: CriticFeedback['category'][] = [
      'scope-gap',
      'implicit-assumption',
      'missing-dependency',
      'inconsistency',
      'risk',
      'improvement'
    ]

    if (category && allowed.includes(category as CriticFeedback['category'])) {
      return category as CriticFeedback['category']
    }

    return 'scope-gap'
  }

  private coerceSeverity(severity: string | undefined): CriticFeedback['severity'] {
    const allowed: CriticFeedback['severity'][] = ['info', 'warning', 'critical']
    if (severity && allowed.includes(severity as CriticFeedback['severity'])) {
      return severity as CriticFeedback['severity']
    }
    return 'warning'
  }
}
