/**
 * @fileoverview Tool for saving work plans to JSON and Markdown
 * @module codeact/tools/save-plan-tool
 */

import path from 'path'
import * as vscode from 'vscode'
import type { WorkPlan } from '../types/work-plan'

/**
 * Convert ISO duration to minutes for display
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Generate Markdown representation of the plan
 */
function generateMarkdown(plan: WorkPlan): string {
  const sections: string[] = []
  
  // Header
  sections.push(`# Work Plan: ${plan.goal.title}`)
  sections.push('')
  sections.push(`**ID:** \`${plan.id}\`  `)
  sections.push(`**Status:** ${plan.status}  `)
  sections.push(`**Version:** ${plan.version}  `)
  sections.push(`**Created:** ${new Date(plan.createdAt).toLocaleString()}  `)
  sections.push(`**Updated:** ${new Date(plan.updatedAt).toLocaleString()}  `)
  sections.push('')
  
  // Goal
  sections.push('## Goal')
  sections.push('')
  sections.push(plan.goal.description)
  sections.push('')
  sections.push('**User Request:**')
  sections.push(`> ${plan.goal.userRequest}`)
  sections.push('')
  
  if (plan.goal.clarifications && plan.goal.clarifications.length > 0) {
    sections.push('### Clarifications')
    sections.push('')
    plan.goal.clarifications.forEach((c) => {
      sections.push(`- **Q:** ${c.question}`)
      sections.push(`  **A:** ${c.answer} _(${c.source})_`)
    })
    sections.push('')
  }
  
  // Requirements
  sections.push('## Requirements')
  sections.push('')
  
  if (plan.requirements.functional.length > 0) {
    sections.push('### Functional')
    plan.requirements.functional.forEach((r) => sections.push(`- ${r}`))
    sections.push('')
  }
  
  if (plan.requirements.technical.length > 0) {
    sections.push('### Technical')
    plan.requirements.technical.forEach((r) => sections.push(`- ${r}`))
    sections.push('')
  }
  
  if (plan.requirements.constraints.length > 0) {
    sections.push('### Constraints')
    plan.requirements.constraints.forEach((r) => sections.push(`- ${r}`))
    sections.push('')
  }
  
  // Context
  sections.push('## Context')
  sections.push('')
  sections.push(`**Architecture:** ${plan.context.architecture}`)
  sections.push('')
  
  if (plan.context.patterns.length > 0) {
    sections.push('**Patterns:**')
    plan.context.patterns.forEach((p) => sections.push(`- ${p}`))
    sections.push('')
  }
  
  if (plan.context.dependencies.length > 0) {
    sections.push('**Dependencies:**')
    plan.context.dependencies.forEach((d) => sections.push(`- \`${d}\``))
    sections.push('')
  }
  
  if (plan.context.relevantFiles.length > 0) {
    sections.push('**Relevant Files:**')
    plan.context.relevantFiles.forEach((f) => {
      if (f.startLine && f.endLine) {
        sections.push(`- \`${f.path}\` (L${f.startLine}-${f.endLine})${f.description ? ` - ${f.description}` : ''}`)
      } else {
        sections.push(`- \`${f.path}\`${f.description ? ` - ${f.description}` : ''}`)
      }
    })
    sections.push('')
  }
  
  // Steps
  sections.push('## Implementation Steps')
  sections.push('')
  
  plan.steps.forEach((step, idx) => {
    const statusEmoji = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌',
      skipped: '⏭️'
    }[step.status] || '❓'
    
    sections.push(`### ${idx + 1}. ${statusEmoji} ${step.title}`)
    sections.push('')
    sections.push(step.description)
    sections.push('')
    
    sections.push(`**Action:** ${step.action.type}`)
    sections.push(`\`\`\``)
    sections.push(step.action.details)
    sections.push(`\`\`\``)
    sections.push('')
    
    if (step.context?.reasoning) {
      sections.push('**Reasoning:**')
      sections.push(step.context.reasoning)
      sections.push('')
    }
    
    if (step.relevantFiles.length > 0) {
      sections.push('**Files:**')
      step.relevantFiles.forEach((f) => {
        if (f.startLine && f.endLine) {
          sections.push(`- \`${f.path}\` (L${f.startLine}-${f.endLine})`)
        } else {
          sections.push(`- \`${f.path}\``)
        }
      })
      sections.push('')
    }
    
    if (step.validation) {
      sections.push('**Validation:**')
      if (step.validation.command) {
        sections.push(`- Command: \`${step.validation.command}\``)
      }
      if (step.validation.expectedResult) {
        sections.push(`- Expected: ${step.validation.expectedResult}`)
      }
      sections.push('')
    }
    
    if (step.execution) {
      sections.push('**Execution:**')
      if (step.execution.duration) {
        sections.push(`- Duration: ${formatDuration(step.execution.duration)}`)
      }
      if (step.execution.llmCalls) {
        sections.push(`- LLM Calls: ${step.execution.llmCalls}`)
      }
      if (step.execution.error) {
        sections.push(`- Error: ${step.execution.error}`)
      }
      sections.push('')
    }
  })
  
  // Post-Execution Hooks
  if (plan.postExecutionHooks.length > 0) {
    sections.push('## Post-Execution Hooks')
    sections.push('')
    
    const enabledHooks = plan.postExecutionHooks
      .filter((h) => h.enabled)
      .sort((a, b) => a.order - b.order)
    
    enabledHooks.forEach((hook) => {
      sections.push(`### ${hook.order}. ${hook.name}`)
      sections.push('')
      sections.push(hook.description)
      sections.push('')
      sections.push(`**Action:** ${hook.action.type}`)
      if (hook.action.command) {
        sections.push(`**Command:** \`${hook.action.command}\``)
      }
      sections.push('')
    })
  }
  
  // Testing
  sections.push('## Testing Strategy')
  sections.push('')
  sections.push(plan.testing.strategy)
  sections.push('')
  
  if (plan.testing.testCases.length > 0) {
    sections.push('### Test Cases')
    sections.push('')
    plan.testing.testCases.forEach((tc) => {
      sections.push(`- **${tc.type.toUpperCase()}:** ${tc.description}`)
      if (tc.command) {
        sections.push(`  \`${tc.command}\``)
      }
    })
    sections.push('')
  }
  
  // Success Criteria
  sections.push('## Success Criteria')
  sections.push('')
  plan.successCriteria.forEach((sc) => {
    const check = sc.verified ? '✅' : '⬜'
    sections.push(`${check} ${sc.description}`)
  })
  sections.push('')
  
  // Metrics
  if (plan.metrics) {
    sections.push('## Metrics')
    sections.push('')
    sections.push(`- **Total Steps:** ${plan.metrics.totalSteps}`)
    sections.push(`- **Completed:** ${plan.metrics.completedSteps}`)
    sections.push(`- **Failed:** ${plan.metrics.failedSteps}`)
    if (plan.metrics.totalDuration) {
      sections.push(`- **Duration:** ${formatDuration(plan.metrics.totalDuration)}`)
    }
    if (plan.metrics.llmCallsTotal) {
      sections.push(`- **LLM Calls:** ${plan.metrics.llmCallsTotal}`)
    }
    sections.push('')
  }
  
  return sections.join('\n')
}

/**
 * Save plan to file system
 */
async function savePlan(
  plan: WorkPlan,
  format: 'json' | 'markdown' | 'both',
  outputDir?: string
): Promise<string[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) {
    throw new Error('No workspace folder open')
  }
  
  const workspaceRoot = workspaceFolders[0].uri.fsPath
  const baseDir = outputDir
    ? path.join(workspaceRoot, outputDir)
    : path.join(workspaceRoot, '.cappy', 'tasks')
  
  // Create directory if needed
  const dirUri = vscode.Uri.file(baseDir)
  try {
    await vscode.workspace.fs.createDirectory(dirUri)
  } catch {
    // Directory exists
  }
  
  const savedFiles: string[] = []
  
  // Generate timestamp and slug from plan ID
  const timestamp = new Date(plan.createdAt).toISOString().replace(/[:.]/g, '-').split('T')[0]
  const slug = plan.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  
  const baseFileName = `${timestamp}_${slug}`
  
  // Save JSON
  if (format === 'json' || format === 'both') {
    const jsonPath = path.join(baseDir, `${baseFileName}.json`)
    const jsonUri = vscode.Uri.file(jsonPath)
    const jsonContent = JSON.stringify(plan, null, 2)
    
    await vscode.workspace.fs.writeFile(
      jsonUri,
      Buffer.from(jsonContent, 'utf-8')
    )
    
    savedFiles.push(jsonPath)
  }
  
  // Save Markdown
  if (format === 'markdown' || format === 'both') {
    const mdPath = path.join(baseDir, `${baseFileName}.md`)
    const mdUri = vscode.Uri.file(mdPath)
    const mdContent = generateMarkdown(plan)
    
    await vscode.workspace.fs.writeFile(
      mdUri,
      Buffer.from(mdContent, 'utf-8')
    )
    
    savedFiles.push(mdPath)
  }
  
  return savedFiles
}

/**
 * SavePlan tool - saves work plan to JSON and/or Markdown
 */
export const SavePlanTool = {
  name: 'save_plan',
  description: 'Save a work plan to JSON and/or Markdown format. Use this after creating a comprehensive plan to persist it for execution and review.',
  
  async execute(args: {
    plan: WorkPlan
    format?: 'json' | 'markdown' | 'both'
    outputDir?: string
  }): Promise<string> {
    const { plan, format = 'both', outputDir } = args
    
    try {
      const savedFiles = await savePlan(plan, format, outputDir)
      
      return `Plan saved successfully:\n${savedFiles.map((f) => `- ${f}`).join('\n')}\n\nPlan ID: ${plan.id}\nStatus: ${plan.status}\nSteps: ${plan.steps.length}\nHooks: ${plan.postExecutionHooks.filter((h) => h.enabled).length}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Failed to save plan: ${message}`
    }
  }
}
