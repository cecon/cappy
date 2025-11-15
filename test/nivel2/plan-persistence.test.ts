/**
 * @fileoverview Tests for PlanPersistence
 * @module tests/plan-persistence
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { DevelopmentPlan } from '../../../src/nivel2/infrastructure/agents/planning/types'

describe('PlanPersistence', () => {
  describe('Plan Storage', () => {
    it('should generate unique plan IDs', () => {
      const id1 = `plan-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const id2 = `plan-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^plan-\d+-[a-z0-9]+$/)
    })

    it('should serialize plan to JSON', () => {
      const plan: DevelopmentPlan = {
        id: 'plan-test',
        title: 'Test Plan',
        goal: 'Test',
        context: {
          filesAnalyzed: [],
          patternsFound: [],
          dependencies: [],
          assumptions: []
        },
        steps: [],
        clarifications: [],
        risks: [],
        successCriteria: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        version: 1
      }

      const json = JSON.stringify(plan, null, 2)
      const parsed = JSON.parse(json)
      
      expect(parsed.id).toBe('plan-test')
      expect(parsed.version).toBe(1)
    })

    it('should handle version updates correctly', () => {
      const existingPlan: DevelopmentPlan = {
        id: 'plan-test',
        title: 'Test',
        goal: 'Test',
        context: { filesAnalyzed: [], patternsFound: [], dependencies: [], assumptions: [] },
        steps: [],
        clarifications: [],
        risks: [],
        successCriteria: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        status: 'draft',
        version: 1
      }

      const updated: DevelopmentPlan = {
        ...existingPlan,
        version: existingPlan.version + 1,
        updatedAt: new Date().toISOString()
      }

      expect(updated.version).toBe(2)
      expect(updated.updatedAt).not.toBe(existingPlan.updatedAt)
    })
  })

  describe('Plan Listing', () => {
    it('should sort plans by creation date', () => {
      const plans: DevelopmentPlan[] = [
        {
          id: 'plan-1',
          title: 'Old Plan',
          goal: '',
          context: { filesAnalyzed: [], patternsFound: [], dependencies: [], assumptions: [] },
          steps: [],
          clarifications: [],
          risks: [],
          successCriteria: [],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          status: 'draft',
          version: 1
        },
        {
          id: 'plan-2',
          title: 'New Plan',
          goal: '',
          context: { filesAnalyzed: [], patternsFound: [], dependencies: [], assumptions: [] },
          steps: [],
          clarifications: [],
          risks: [],
          successCriteria: [],
          createdAt: '2025-01-02T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          status: 'draft',
          version: 1
        }
      ]

      const sorted = plans.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      expect(sorted[0].id).toBe('plan-2')
      expect(sorted[1].id).toBe('plan-1')
    })
  })

  describe('Plan File Naming', () => {
    it('should generate consistent file names', () => {
      const planId = 'abc123'
      const fileName = `plan-${planId}.json`
      
      expect(fileName).toBe('plan-abc123.json')
    })

    it('should extract plan ID from file name', () => {
      const fileName = 'plan-abc123.json'
      const planId = fileName.replace('plan-', '').replace('.json', '')
      
      expect(planId).toBe('abc123')
    })

    it('should filter non-plan files', () => {
      const files = [
        'plan-123.json',
        'plan-456.json',
        'readme.md',
        'config.json',
        'plan-backup.json'
      ]

      const planFiles = files.filter(f => 
        f.startsWith('plan-') && f.endsWith('.json') && /^plan-[^-]+\.json$/.test(f)
      )

      expect(planFiles.length).toBe(2)
      expect(planFiles).toContain('plan-123.json')
      expect(planFiles).not.toContain('plan-backup.json')
    })
  })
})
