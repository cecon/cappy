import * as vscode from 'vscode'
import type { DevelopmentPlan } from './types'

/**
 * Manages persistence of development plans as JSON files
 */
export class PlanPersistence {
  /**
   * Saves a plan to .cappy/plans/
   */
  static async savePlan(plan: DevelopmentPlan): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      throw new Error('No workspace folder found')
    }

    const plansDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'plans')
    
    try {
      await vscode.workspace.fs.createDirectory(plansDirUri)
    } catch {
      // Directory might already exist
    }

    const fileName = `plan-${plan.id}.json`
    const fileUri = vscode.Uri.joinPath(plansDirUri, fileName)
    
    const content = JSON.stringify(plan, null, 2)
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'))

    return fileUri.fsPath
  }

  /**
   * Loads a plan from file
   */
  static async loadPlan(planId: string): Promise<DevelopmentPlan | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return null
    }

    const fileName = `plan-${planId}.json`
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'plans', fileName)

    try {
      const content = await vscode.workspace.fs.readFile(fileUri)
      return JSON.parse(content.toString()) as DevelopmentPlan
    } catch {
      return null
    }
  }

  /**
   * Updates an existing plan
   */
  static async updatePlan(planId: string, updates: Partial<DevelopmentPlan>): Promise<DevelopmentPlan | null> {
    const existingPlan = await this.loadPlan(planId)
    if (!existingPlan) {
      return null
    }

    const updatedPlan: DevelopmentPlan = {
      ...existingPlan,
      ...updates,
      version: existingPlan.version + 1,
      updatedAt: new Date().toISOString()
    }

    await this.savePlan(updatedPlan)
    return updatedPlan
  }

  /**
   * Lists all plans
   */
  static async listPlans(): Promise<DevelopmentPlan[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return []
    }

    const plansDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'plans')

    try {
      const entries = await vscode.workspace.fs.readDirectory(plansDirUri)
      const planIds = entries
        .filter(([name]) => this.isPlanFileName(name))
        .map(([name]) => name.replace('plan-', '').replace('.json', ''))
      
      const plans: DevelopmentPlan[] = []
      for (const planId of planIds) {
        const plan = await this.loadPlan(planId)
        if (plan) {
          plans.push(plan)
        }
      }
      
      // Sort by created date, newest first
      return plans.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch {
      return []
    }
  }

  /**
   * Deletes a plan file
   */
  static async deletePlan(planId: string): Promise<boolean> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return false
    }

    const fileName = `plan-${planId}.json`
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'plans', fileName)

    try {
      await vscode.workspace.fs.delete(fileUri)
      return true
    } catch {
      return false
    }
  }

  /**
   * Opens a plan file in the editor
   */
  static async openPlanInEditor(planId: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return
    }

    const fileName = `plan-${planId}.json`
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'plans', fileName)

    const doc = await vscode.workspace.openTextDocument(fileUri)
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside
    })
  }

  /**
   * Determines if a file matches the plan naming convention and excludes backups
   */
  private static isPlanFileName(name: string): boolean {
    if (!name.startsWith('plan-') || !name.endsWith('.json')) {
      return false
    }

    const planId = name.slice(5, -5)
    if (!planId) {
      return false
    }

    return !planId.toLowerCase().startsWith('backup')
  }
}
