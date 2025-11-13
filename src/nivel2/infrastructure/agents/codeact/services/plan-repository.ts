/**
 * @fileoverview Plan repository for SQLite persistence
 * @module codeact/services/plan-repository
 */

import sqlite3 from 'sqlite3'
import type { Plan, PlanTask, PlanVersion } from '../core/plan'
import type { PlanRow, TaskRow, VersionRow } from '../types/database'

export class PlanRepository {
  private db: sqlite3.Database
  
  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath)
    this.initSchema()
  }
  
  /**
   * Initialize database schema
   */
  private async initSchema(): Promise<void> {
    const run = (sql: string, params: unknown[] = []) => new Promise<void>((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    await run(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        context_used TEXT,
        created_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1
      )
    `)
    
    await run(`
      CREATE TABLE IF NOT EXISTS plan_tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        description TEXT NOT NULL,
        files_to_modify TEXT,
        dependencies TEXT,
        estimated_complexity TEXT,
        technical_notes TEXT,
        position INTEGER,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      )
    `)
    
    await run(`
      CREATE TABLE IF NOT EXISTS plan_versions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        change_reason TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      )
    `)
    
    await run(`CREATE INDEX IF NOT EXISTS idx_plans_session ON plans(session_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan ON plan_tasks(plan_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id)`)
  }
  
  /**
   * Save a plan to database
   */
  async save(plan: Plan): Promise<void> {
    const run = (sql: string, params: unknown[] = []) => new Promise<void>((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    // Serialize = transaction
    await new Promise<void>((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          // Insert/update plan
          await run(
            `INSERT OR REPLACE INTO plans (id, session_id, goal, context_used, created_at, version)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              plan.id,
              plan.sessionId,
              plan.goal,
              JSON.stringify(plan.contextUsed),
              plan.createdAt,
              plan.version
            ]
          )
          
          // Delete old tasks
          await run('DELETE FROM plan_tasks WHERE plan_id = ?', [plan.id])
          
          // Insert tasks
          for (const task of plan.tasks) {
            await run(
              `INSERT INTO plan_tasks (
                id, plan_id, description, files_to_modify,
                dependencies, estimated_complexity, technical_notes, position
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                task.id,
                plan.id,
                task.description,
                JSON.stringify(task.filesToModify),
                JSON.stringify(task.dependencies),
                task.estimatedComplexity,
                task.technicalNotes || null,
                task.position
              ]
            )
          }
          
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }
  
  /**
   * Find plan by ID
   */
  async findById(id: string): Promise<Plan | null> {
    const get = <T>(sql: string, params: unknown[] = []) => new Promise<T | undefined>((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row as T | undefined)
      })
    })
    
    const all = <T>(sql: string, params: unknown[] = []) => new Promise<T[]>((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows as T[])
      })
    })
    
    const planRow = await get<PlanRow>('SELECT * FROM plans WHERE id = ?', [id])
    
    if (!planRow) return null
    
    const taskRows = await all<TaskRow>(
      'SELECT * FROM plan_tasks WHERE plan_id = ? ORDER BY position',
      [id]
    )
    
    return this.rowToPlan(planRow, taskRows)
  }
  
  /**
   * Find plans by session ID
   */
  async findBySession(sessionId: string): Promise<Plan[]> {
    const all = <T>(sql: string, params: unknown[] = []) => new Promise<T[]>((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows as T[])
      })
    })
    
    const planRows = await all<PlanRow>(
      'SELECT * FROM plans WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    )
    
    const plans: Plan[] = []
    
    for (const planRow of planRows) {
      const taskRows = await all<TaskRow>(
        'SELECT * FROM plan_tasks WHERE plan_id = ? ORDER BY position',
        [planRow.id]
      )
      
      plans.push(this.rowToPlan(planRow, taskRows))
    }
    
    return plans
  }
  
  /**
   * Save a plan version snapshot
   */
  async saveVersion(planId: string, snapshot: Plan, reason: string): Promise<void> {
    const run = (sql: string, params: unknown[] = []) => new Promise<void>((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    const versionId = `version-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    await run(
      `INSERT INTO plan_versions (id, plan_id, snapshot, change_reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        versionId,
        planId,
        JSON.stringify(snapshot),
        reason,
        Date.now()
      ]
    )
  }
  
  /**
   * Get all versions of a plan
   */
  async getVersions(planId: string): Promise<PlanVersion[]> {
    const all = <T>(sql: string, params: unknown[] = []) => new Promise<T[]>((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows as T[])
      })
    })
    
    const rows = await all<VersionRow>(
      'SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY created_at DESC',
      [planId]
    )
    
    return rows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      snapshot: JSON.parse(row.snapshot),
      changeReason: row.change_reason,
      createdAt: row.created_at
    }))
  }
  
  /**
   * Delete a plan and all related data
   */
  async delete(planId: string): Promise<void> {
    const run = (sql: string, params: unknown[] = []) => new Promise<void>((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    await run('DELETE FROM plans WHERE id = ?', [planId])
  }
  
  /**
   * Get recent plans (last N)
   */
  async getRecent(limit: number = 10): Promise<Plan[]> {
    const all = <T>(sql: string, params: unknown[] = []) => new Promise<T[]>((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows as T[])
      })
    })
    
    const planRows = await all<PlanRow>(
      'SELECT * FROM plans ORDER BY created_at DESC LIMIT ?',
      [limit]
    )
    
    const plans: Plan[] = []
    
    for (const planRow of planRows) {
      const taskRows = await all<TaskRow>(
        'SELECT * FROM plan_tasks WHERE plan_id = ? ORDER BY position',
        [planRow.id]
      )
      
      plans.push(this.rowToPlan(planRow, taskRows))
    }
    
    return plans
  }
  
  /**
   * Close database connection
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  
  /**
   * Convert database rows to Plan object
   */
  private rowToPlan(planRow: PlanRow, taskRows: TaskRow[]): Plan {
    const tasks: PlanTask[] = taskRows.map(row => ({
      id: row.id,
      description: row.description,
      filesToModify: JSON.parse(row.files_to_modify || '[]') as string[],
      dependencies: JSON.parse(row.dependencies || '[]') as string[],
      estimatedComplexity: row.estimated_complexity as 'low' | 'medium' | 'high',
      technicalNotes: row.technical_notes ?? undefined,
      position: row.position
    }))
    
    return {
      id: planRow.id,
      sessionId: planRow.session_id,
      goal: planRow.goal,
      contextUsed: JSON.parse(planRow.context_used || '[]') as string[],
      tasks,
      createdAt: planRow.created_at,
      version: planRow.version
    }
  }
}