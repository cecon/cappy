/**
 * Tool Setup Helper
 * 
 * Simplifies the registration of all chat tools
 */

import * as vscode from 'vscode'
import { toolRegistry } from './registry'
import { CreateFileTool, FetchWebTool } from './native'

/**
 * Register all native tools
 */
export function registerNativeTools(context: vscode.ExtensionContext): void {
  console.log('🛠️ Registering native tools...')

  // Create File Tool
  const createFileTool = new CreateFileTool()
  const createFileDisposable = toolRegistry.register(
    CreateFileTool.metadata,
    createFileTool
  )
  context.subscriptions.push(createFileDisposable)

  // Fetch Web Tool
  const fetchWebTool = new FetchWebTool()
  const fetchWebDisposable = toolRegistry.register(
    FetchWebTool.metadata,
    fetchWebTool
  )
  context.subscriptions.push(fetchWebDisposable)

  console.log(`✅ Registered ${toolRegistry.size} native tools`)
}

/**
 * Register all Cappy-specific tools
 */
export function registerCappyTools(_context: vscode.ExtensionContext): void {
  console.log('🛠️ Registering Cappy tools...')
  // Mark parameter as intentionally unused for now
  void _context
  
  // TODO: Add Cappy-specific tools here
  
  console.log('✅ Cappy tools registered')
}

/**
 * Register all external tools
 */
export function registerExternalTools(_context: vscode.ExtensionContext): void {
  console.log('🛠️ Registering external tools...')
  // Mark parameter as intentionally unused for now
  void _context
  
  // TODO: Add external integrations here
  
  console.log('✅ External tools registered')
}

/**
 * Register all chat tools
 */
export function registerAllTools(context: vscode.ExtensionContext): void {
  registerNativeTools(context)
  registerCappyTools(context)
  registerExternalTools(context)

  // Log summary
  const info = toolRegistry.exportInfo()
  console.log(`\n📊 Tool Registration Summary:`)
  console.log(`   Total Tools: ${info.tools.length}`)
  
  const byCategory = info.tools.reduce((acc, tool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`)
  })

  console.log(`\n🎉 All tools registered successfully\n`)
}

/**
 * Unregister all tools
 */
export function unregisterAllTools(): void {
  toolRegistry.dispose()
}
