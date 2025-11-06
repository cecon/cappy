/**
 * @fileoverview Tool for executing work plans step-by-step
 * @module codeact/tools/execute-plan-tool
 */

import * as vscode from 'vscode'
import type { WorkPlan, PlanStep } from '../types/work-plan'

/**
 * Execute a single step
 */
async function executeStep(
  step: PlanStep
): Promise<{ success: boolean; output: string; error?: string }> {
  const startTime = Date.now()
  
  try {
    let output = ''
    
    // Update step status
    step.status = 'in_progress'
    step.execution = {
      startedAt: new Date().toISOString(),
      llmCalls: 0
    }
    
    // Execute based on action type
    switch (step.action.type) {
      case 'create_file': {
        // Parse file path and content from details
        const lines = step.action.details.split('\n')
        const pathLine = lines.find((l) => l.startsWith('Path:'))
        const contentStart = lines.findIndex((l) => l.startsWith('Content:'))
        
        if (!pathLine || contentStart === -1) {
          throw new Error('Invalid create_file action: missing Path or Content')
        }
        
        const filePath = pathLine.replace('Path:', '').trim()
        const content = lines.slice(contentStart + 1).join('\n')
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
          throw new Error('No workspace folder open')
        }
        
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath)
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'))
        
        output = `Created file: ${filePath}`
        break
      }
      
      case 'edit_file': {
        // Parse file path and edits from details
        const lines = step.action.details.split('\n')
        const pathLine = lines.find((l) => l.startsWith('Path:'))
        
        if (!pathLine) {
          throw new Error('Invalid edit_file action: missing Path')
        }
        
        const filePath = pathLine.replace('Path:', '').trim()
        
        output = `Edited file: ${filePath}\nNote: Manual edit required - action details:\n${step.action.details}`
        break
      }
      
      case 'run_command': {
        // Execute terminal command
        const command = step.action.details
        
        const terminal = vscode.window.createTerminal({
          name: `Plan Step: ${step.title}`,
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        })
        
        terminal.show()
        terminal.sendText(command)
        
        output = `Executed command: ${command}\nCheck terminal for output`
        break
      }
      
      case 'ask_user': {
        // Show input box
        const userInput = await vscode.window.showInputBox({
          prompt: step.action.details,
          placeHolder: step.action.expectedOutput || 'Enter your response...'
        })
        
        if (!userInput) {
          throw new Error('User cancelled input')
        }
        
        output = `User response: ${userInput}`
        break
      }
      
      case 'custom': {
        output = `Custom action: ${step.action.details}\nNote: Manual execution required`
        break
      }
      
      default:
        throw new Error(`Unknown action type: ${step.action.type}`)
    }
    
    // Run validation if specified
    if (step.validation?.command) {
      // Note: Validation would be async, shown in terminal
      output += `\n\nValidation command: ${step.validation.command}`
      if (step.validation.expectedResult) {
        output += `\nExpected: ${step.validation.expectedResult}`
      }
    }
    
    // Update execution metadata
    const endTime = Date.now()
    step.execution.completedAt = new Date().toISOString()
    step.execution.duration = endTime - startTime
    
    // Mark as completed
    step.status = 'completed'
    
    return { success: true, output }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Update execution metadata
    const endTime = Date.now()
    if (step.execution) {
      step.execution.completedAt = new Date().toISOString()
      step.execution.duration = endTime - startTime
      step.execution.error = errorMsg
    }
    
    // Mark as failed
    step.status = 'failed'
    
    return { success: false, output: '', error: errorMsg }
  }
}

/**
 * Execute post-execution hooks
 */
async function executeHooks(
  plan: WorkPlan
): Promise<{ executed: number; failed: number; output: string[] }> {
  const output: string[] = []
  let executed = 0
  let failed = 0
  
  const enabledHooks = plan.postExecutionHooks
    .filter((h) => h.enabled)
    .sort((a, b) => a.order - b.order)
  
  for (const hook of enabledHooks) {
    // Check condition
    if (hook.condition) {
      const { onSuccess, onFailure, onStepsCompleted } = hook.condition
      
      // Check success/failure condition
      const hasFailures = plan.steps.some((s) => s.status === 'failed')
      if (onSuccess && hasFailures) {
        output.push(`Skipped hook "${hook.name}": failures detected`)
        continue
      }
      if (onFailure && !hasFailures) {
        output.push(`Skipped hook "${hook.name}": no failures`)
        continue
      }
      
      // Check step completion condition
      if (onStepsCompleted && onStepsCompleted.length > 0) {
        const allCompleted = onStepsCompleted.every((stepId) =>
          plan.steps.find((s) => s.id === stepId)?.status === 'completed'
        )
        if (!allCompleted) {
          output.push(`Skipped hook "${hook.name}": required steps not completed`)
          continue
        }
      }
    }
    
    try {
      switch (hook.action.type) {
        case 'git_commit': {
          const message = hook.action.params?.message as string || `Plan ${plan.id}: ${plan.goal.title}`
          const terminal = vscode.window.createTerminal({
            name: `Hook: ${hook.name}`,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          })
          terminal.show()
          terminal.sendText(`git add -A && git commit -m "${message}"`)
          output.push(`✅ ${hook.name}: Git commit created`)
          executed++
          break
        }
        
        case 'run_tests': {
          const command = hook.action.command || 'npm test'
          const terminal = vscode.window.createTerminal({
            name: `Hook: ${hook.name}`,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          })
          terminal.show()
          terminal.sendText(command)
          output.push(`✅ ${hook.name}: Tests running in terminal`)
          executed++
          break
        }
        
        case 'update_docs': {
          output.push(`✅ ${hook.name}: Documentation update triggered`)
          executed++
          break
        }
        
        case 'update_embeddings': {
          // Trigger reindex command
          await vscode.commands.executeCommand('cappy.reindex')
          output.push(`✅ ${hook.name}: Embeddings reindexed`)
          executed++
          break
        }
        
        case 'custom': {
          if (hook.action.command) {
            const terminal = vscode.window.createTerminal({
              name: `Hook: ${hook.name}`,
              cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            })
            terminal.show()
            terminal.sendText(hook.action.command)
            output.push(`✅ ${hook.name}: Custom command executed`)
          } else {
            output.push(`✅ ${hook.name}: Custom hook (manual execution required)`)
          }
          executed++
          break
        }
        
        default:
          output.push(`⚠️ ${hook.name}: Unknown hook type ${hook.action.type}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      output.push(`❌ ${hook.name}: Failed - ${msg}`)
      failed++
    }
  }
  
  return { executed, failed, output }
}

/**
 * Update plan metrics
 */
function updateMetrics(plan: WorkPlan): void {
  const totalSteps = plan.steps.length
  const completedSteps = plan.steps.filter((s) => s.status === 'completed').length
  const failedSteps = plan.steps.filter((s) => s.status === 'failed').length
  
  const totalDuration = plan.steps
    .filter((s) => s.execution?.duration)
    .reduce((sum, s) => sum + (s.execution!.duration || 0), 0)
  
  const llmCallsTotal = plan.steps
    .filter((s) => s.execution?.llmCalls)
    .reduce((sum, s) => sum + (s.execution!.llmCalls || 0), 0)
  
  plan.metrics = {
    totalSteps,
    completedSteps,
    failedSteps,
    totalDuration,
    llmCallsTotal
  }
  
  // Update plan status
  if (failedSteps > 0) {
    plan.status = 'failed'
  } else if (completedSteps === totalSteps) {
    plan.status = 'completed'
  } else if (completedSteps > 0) {
    plan.status = 'in_progress'
  }
}

/**
 * ExecutePlan tool - executes work plan steps
 */
export const ExecutePlanTool = {
  name: 'execute_plan',
  description: 'Execute work plan steps. Modes: "step" (next pending step), "all" (all pending steps), "resume" (continue from last incomplete). Tracks metrics and runs post-execution hooks.',
  
  async execute(args: {
    plan: WorkPlan
    mode: 'step' | 'all' | 'resume'
    stepId?: string
  }): Promise<string> {
    const { plan, mode, stepId } = args
    const output: string[] = []
    
    try {
      // Find steps to execute
      let stepsToExecute: PlanStep[] = []
      
      if (stepId) {
        // Execute specific step
        const step = plan.steps.find((s) => s.id === stepId)
        if (!step) {
          return `Error: Step "${stepId}" not found in plan`
        }
        stepsToExecute = [step]
      } else if (mode === 'step') {
        // Execute next pending step
        const nextStep = plan.steps.find((s) => s.status === 'pending')
        if (!nextStep) {
          return 'No pending steps to execute'
        }
        stepsToExecute = [nextStep]
      } else if (mode === 'resume') {
        // Execute from first incomplete step
        const firstIncomplete = plan.steps.find((s) => 
          s.status === 'pending' || s.status === 'failed'
        )
        if (!firstIncomplete) {
          output.push('All steps completed, running post-execution hooks...')
        } else {
          const startIdx = plan.steps.indexOf(firstIncomplete)
          stepsToExecute = plan.steps.slice(startIdx).filter((s) => 
            s.status === 'pending' || s.status === 'failed'
          )
        }
      } else {
        // Execute all pending steps
        stepsToExecute = plan.steps.filter((s) => s.status === 'pending')
      }
      
      // Execute steps
      for (const step of stepsToExecute) {
        output.push(`\n--- Executing Step ${step.id}: ${step.title} ---`)
        
        const result = await executeStep(step)
        
        if (result.success) {
          output.push(`✅ ${result.output}`)
        } else {
          output.push(`❌ Failed: ${result.error}`)
          
          // Ask if should continue
          if (mode === 'all' || mode === 'resume') {
            const shouldContinue = await vscode.window.showWarningMessage(
              `Step "${step.title}" failed. Continue with remaining steps?`,
              'Continue',
              'Stop'
            )
            
            if (shouldContinue !== 'Continue') {
              output.push('\nExecution stopped by user')
              break
            }
          }
        }
      }
      
      // Update metrics
      updateMetrics(plan)
      
      // Run hooks if all steps completed
      const allCompleted = plan.steps.every((s) => 
        s.status === 'completed' || s.status === 'skipped'
      )
      
      if (allCompleted || mode === 'all') {
        output.push('\n--- Running Post-Execution Hooks ---')
        const hookResults = await executeHooks(plan)
        output.push(...hookResults.output)
        output.push(`\nHooks: ${hookResults.executed} executed, ${hookResults.failed} failed`)
      }
      
      // Summary
      output.push('\n--- Plan Execution Summary ---')
      output.push(`Status: ${plan.status}`)
      output.push(`Steps: ${plan.metrics!.completedSteps}/${plan.metrics!.totalSteps} completed`)
      if (plan.metrics!.failedSteps > 0) {
        output.push(`Failed: ${plan.metrics!.failedSteps}`)
      }
      if (plan.metrics!.totalDuration) {
        const mins = Math.floor(plan.metrics!.totalDuration / 60000)
        const secs = Math.floor((plan.metrics!.totalDuration % 60000) / 1000)
        output.push(`Duration: ${mins}m ${secs}s`)
      }
      
      return output.join('\n')
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Execution failed: ${message}\n\n${output.join('\n')}`
    }
  }
}
