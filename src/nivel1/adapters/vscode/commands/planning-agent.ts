/**
 * Planning Agent Commands
 * 
 * Commands to interact with the LangGraph planning agent system
 */

import * as vscode from 'vscode'
import { LangGraphPlanningAgent } from '../../../../nivel2/infrastructure/agents/langgraph/planning-agent'
import { PlanPersistence } from '../../../../nivel2/infrastructure/agents/planning/plan-persistence'

// Singleton instance
let planningAgent: LangGraphPlanningAgent | null = null

/**
 * Get or create the planning agent instance
 */
async function getPlanningAgent(): Promise<LangGraphPlanningAgent> {
  if (!planningAgent) {
    planningAgent = new LangGraphPlanningAgent()
    await planningAgent.initialize()
  }
  return planningAgent
}

/**
 * Register all planning agent commands
 */
export function registerPlanningCommands(context: vscode.ExtensionContext): void {
  // cappy.planning.newPlan - Start a new planning session
  const newPlanCmd = vscode.commands.registerCommand('cappy.planning.newPlan', async () => {
    const agent = await getPlanningAgent()
    
    const userRequest = await vscode.window.showInputBox({
      prompt: 'What would you like to plan?',
      placeHolder: 'e.g., Add JWT authentication to the API',
      ignoreFocusOut: true
    })

    if (!userRequest) {
      return
    }

    const sessionId = `session-${Date.now()}`
    
    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Creating development plan...',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Analyzing workspace...' })
      
      try {
        const response = await agent.runTurn({
          prompt: userRequest,
          sessionId,
          onToken: (chunk) => {
            // Could stream to output channel or chat
            console.log(chunk)
          }
        })

        // Show result in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: response,
          language: 'markdown'
        })
        await vscode.window.showTextDocument(doc, { preview: false })

        vscode.window.showInformationMessage('Development plan created!')
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create plan: ${error}`)
      }
    })
  })

  // cappy.planning.listPlans - Show all saved plans
  const listPlansCmd = vscode.commands.registerCommand('cappy.planning.listPlans', async () => {
    try {
      const plans = await PlanPersistence.listPlans()
      
      if (plans.length === 0) {
        vscode.window.showInformationMessage('No plans found')
        return
      }

      const items = plans.map(plan => ({
        label: plan.title,
        description: `${plan.status} • ${new Date(plan.createdAt).toLocaleDateString()}`,
        detail: plan.goal,
        plan
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a plan to view',
        matchOnDescription: true,
        matchOnDetail: true
      })

      if (selected) {
        await PlanPersistence.openPlanInEditor(selected.plan.id)
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to list plans: ${error}`)
    }
  })

  // cappy.planning.openPlan - Open a specific plan by ID
  const openPlanCmd = vscode.commands.registerCommand('cappy.planning.openPlan', async (planId?: string) => {
    try {
      if (!planId) {
        const plans = await PlanPersistence.listPlans()
        if (plans.length === 0) {
          vscode.window.showInformationMessage('No plans found')
          return
        }

        const items = plans.map(plan => ({
          label: plan.title,
          description: plan.id,
          plan
        }))

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a plan to open'
        })

        if (selected) {
          planId = selected.plan.id
        }
      }

      if (planId) {
        await PlanPersistence.openPlanInEditor(planId)
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open plan: ${error}`)
    }
  })

  // cappy.planning.deletePlan - Delete a plan
  const deletePlanCmd = vscode.commands.registerCommand('cappy.planning.deletePlan', async (planId?: string) => {
    try {
      if (!planId) {
        const plans = await PlanPersistence.listPlans()
        if (plans.length === 0) {
          vscode.window.showInformationMessage('No plans found')
          return
        }

        const items = plans.map(plan => ({
          label: plan.title,
          description: plan.id,
          plan
        }))

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a plan to delete'
        })

        if (selected) {
          planId = selected.plan.id
        }
      }

      if (planId) {
        const confirmed = await vscode.window.showWarningMessage(
          `Delete plan "${planId}"?`,
          { modal: true },
          'Delete'
        )

        if (confirmed === 'Delete') {
          await PlanPersistence.deletePlan(planId)
          vscode.window.showInformationMessage('Plan deleted')
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete plan: ${error}`)
    }
  })

  context.subscriptions.push(newPlanCmd, listPlansCmd, openPlanCmd, deletePlanCmd)
  
  console.log('  ✅ cappy.planning.newPlan')
  console.log('  ✅ cappy.planning.listPlans')
  console.log('  ✅ cappy.planning.openPlan')
  console.log('  ✅ cappy.planning.deletePlan')
}
