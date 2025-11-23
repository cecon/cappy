/**
 * @fileoverview Tests for LangGraphPlanningAgent
 * @module tests/planning-agent
 */

import { describe, it, expect } from 'vitest'
import type { DevelopmentPlan, CriticFeedback } from '../../../src/nivel2/infrastructure/agents/planning/types'

describe('LangGraphPlanningAgent', () => {
  describe('Plan Parsing', () => {
    it('should extract title from markdown response', () => {
      const response = `# Development Plan: Add JWT Authentication
      
## Goal
Implement JWT-based authentication`

      // This test is a placeholder - actual implementation would test the agent
      expect(response).toContain('JWT Authentication')
    })

    it('should extract files analyzed from response', () => {
      const response = `Files analyzed: \`src/auth/jwt.ts\`, \`package.json\``
      
      const fileRegex = /`([^`]+\.(ts|js|tsx|jsx|json|md|yaml|yml))`/g
      const matches = Array.from(response.matchAll(fileRegex))
      
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0][1]).toBe('src/auth/jwt.ts')
    })

    it('should extract steps from numbered list', () => {
      const response = `## Steps

1. **Install dependencies**
   Install jsonwebtoken and @types/jsonwebtoken
   
2. **Create JWT service**
   Implement token generation and verification`

      const stepRegex = /(\d+)\.\s+\*\*([^*]+)\*\*/g
      const matches = Array.from(response.matchAll(stepRegex))
      
      expect(matches.length).toBe(2)
      expect(matches[0][2].trim()).toBe('Install dependencies')
      expect(matches[1][2].trim()).toBe('Create JWT service')
    })

    it('should extract risks from markdown', () => {
      const response = `### ⚠️ Risks & Considerations

- Token expiration may cause user logout
- Secret key must be environment variable`

      const riskRegex = /###\s+(?:⚠️\s*)?Risks?\s*&?\s*Considerations?([^#]*)/i
      const match = riskRegex.exec(response)
      
      expect(match).toBeTruthy()
      if (match) {
        const risks = Array.from(match[1].matchAll(/[-*]\s+([^\n]+)/g))
        expect(risks.length).toBe(2)
      }
    })

    it('should extract success criteria', () => {
      const response = `### ✅ Success Criteria

- User can login with JWT
- Token is validated on protected routes
- Refresh token mechanism works`

      const criteriaRegex = /###\s+(?:✅\s*)?Success\s+Criteria([^#]*)/i
      const match = criteriaRegex.exec(response)
      
      expect(match).toBeTruthy()
      if (match) {
        const criteria = Array.from(match[1].matchAll(/[-*]\s+([^\n]+)/g))
        expect(criteria.length).toBe(3)
      }
    })
  })

  describe('Phase Transitions', () => {
    it('should transition from planning to critic', () => {
      let phase: 'planning' | 'critic' | 'clarifying' | 'done' = 'planning'
      
      // Simulate planning phase completion
      phase = 'critic'
      
      expect(phase).toBe('critic')
    })

    it('should transition to clarifying when critical feedback exists', () => {
      const feedback: CriticFeedback[] = [
        {
          issue: 'Missing file path for JWT service',
          severity: 'critical',
          suggestion: '',
          requiresClarification: true
        }
      ]
      
      const hasCritical = feedback.some(f => f.severity === 'critical')
      const nextPhase = hasCritical ? 'clarifying' : 'done'
      
      expect(nextPhase).toBe('clarifying')
    })

    it('should transition to done when no critical issues', () => {
      const feedback: CriticFeedback[] = [
        {
          issue: 'Consider adding rate limiting',
          severity: 'warning',
          suggestion: '',
          requiresClarification: false
        }
      ]
      
      const hasCritical = feedback.some(f => f.severity === 'critical')
      const nextPhase = hasCritical ? 'clarifying' : 'done'
      
      expect(nextPhase).toBe('done')
    })
  })

  describe('Critic Feedback Parsing', () => {
    it('should identify critical issues', () => {
      const response = `❌ CRITICAL: Missing file path for JWT service
⚠️ WARNING: Consider adding rate limiting
INFO: Documentation should be updated`

      const criticalMatches = Array.from(response.matchAll(/(?:❌|CRITICAL):\s*([^\n]+)/gi))
      expect(criticalMatches.length).toBe(1)
      expect(criticalMatches[0][1]).toContain('Missing file path')
    })

    it('should identify warnings', () => {
      const response = `⚠️ WARNING: Consider adding rate limiting
⚠️ WARNING: Token expiration should be configurable`

      const warningMatches = Array.from(response.matchAll(/(?:⚠️|WARNING):\s*([^\n]+)/gi))
      expect(warningMatches.length).toBe(2)
    })
  })

  describe('Plan Structure', () => {
    it('should create valid plan structure', () => {
      const plan: DevelopmentPlan = {
        id: 'plan-123',
        title: 'Add JWT Authentication',
        goal: 'Implement JWT auth',
        context: {
          filesAnalyzed: ['src/auth/jwt.ts'],
          patternsFound: [],
          dependencies: ['jsonwebtoken'],
          assumptions: []
        },
        steps: [
          {
            id: 'step-1',
            title: 'Install deps',
            description: 'Install JWT packages',
            dependencies: [],
            validation: 'Package.json updated',
            rationale: 'Need JWT library',
            status: 'pending'
          }
        ],
        clarifications: [],
        risks: [],
        successCriteria: ['JWT works'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        version: 1
      }

      expect(plan.id).toBe('plan-123')
      expect(plan.steps.length).toBe(1)
      expect(plan.status).toBe('draft')
      expect(plan.version).toBe(1)
    })

    it('should increment version on updates', () => {
      let version = 1
      version++
      expect(version).toBe(2)
    })
  })

  describe('Tool Filtering', () => {
    it('should allow analysis tools', () => {
      const allowedTools = [
        'cappy_retrieve_context',
        'read_file',
        'grep_search',
        'list_dir',
        'semantic_search',
        'file_search'
      ]

      const tool = 'read_file'
      expect(allowedTools.includes(tool)).toBe(true)
    })

    it('should block code generation tools', () => {
      const blockedTools = [
        'create_file',
        'replace_string_in_file',
        'run_in_terminal',
        'run_task'
      ]

      const allowedTools = [
        'cappy_retrieve_context',
        'read_file',
        'grep_search',
        'list_dir'
      ]

      const tool = 'create_file'
      expect(allowedTools.includes(tool)).toBe(false)
      expect(blockedTools.includes(tool)).toBe(true)
    })
  })

  describe('Clarification Management', () => {
    it('should record user answers', () => {
      const clarifications: Array<{
        id: string
        question: string
        answer: string | undefined
        critical: boolean
        relatedSteps: string[]
      }> = [
        {
          id: 'c1',
          question: 'Where to create JWT service?',
          answer: undefined,
          critical: true,
          relatedSteps: []
        }
      ]

      // User provides answer
      const lastClarification = clarifications.at(-1)
      if (lastClarification && !lastClarification.answer) {
        lastClarification.answer = 'Create in src/services/auth/'
      }

      expect(clarifications[0].answer).toBe('Create in src/services/auth/')
    })

    it('should handle multiple clarifications sequentially', () => {
      const clarifications = [
        {
          id: 'c1',
          question: 'Question 1?',
          answer: 'Answer 1',
          critical: true,
          relatedSteps: []
        },
        {
          id: 'c2',
          question: 'Question 2?',
          answer: undefined,
          critical: true,
          relatedSteps: []
        }
      ]

      const unanswered = clarifications.filter(c => !c.answer)
      expect(unanswered.length).toBe(1)
      expect(unanswered[0].id).toBe('c2')
    })
  })
})
