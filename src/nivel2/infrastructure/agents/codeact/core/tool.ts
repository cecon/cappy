/**
 * @fileoverview Tool system for agent capabilities
 * @module codeact/core/tool
 * 
 * Inspired by OpenHands tool system
 */

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: unknown
  enum?: string[]
  items?: {
    type: string
    enum?: string[]
  }
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Base interface for all tools
 */
export interface Tool {
  /** Unique tool name */
  name: string
  
  /** Human-readable description */
  description: string
  
  /** Tool parameters */
  parameters: ToolParameter[]
  
  /**
   * Execute the tool with given input
   */
  execute(input: Record<string, unknown>): Promise<ToolResult>
  
  /**
   * Convert tool to LLM-compatible schema
   * (VS Code LanguageModelToolInformation format)
   */
  toSchema(): ToolSchema
}

/**
 * Tool schema for LLM
 * Compatible with VS Code Language Model API
 */
export interface ToolSchema {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      items?: {
        type: string
        enum?: string[]
      }
    }>
    required: string[]
  }
}

/**
 * Abstract base class for tools
 */
export abstract class BaseTool implements Tool {
  abstract name: string
  abstract description: string
  abstract parameters: ToolParameter[]
  
  abstract execute(input: Record<string, unknown>): Promise<ToolResult>
  
  /**
   * Convert tool to LLM schema
   */
  toSchema(): ToolSchema {
    const properties: Record<string, { 
      type: string; 
      description: string; 
      enum?: string[];
      items?: { type: string; enum?: string[] }
    }> = {}
    const required: string[] = []
    
    for (const param of this.parameters) {
      const property: {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string; enum?: string[] }
      } = {
        type: param.type,
        description: param.description,
        ...(param.enum ? { enum: param.enum } : {})
      }
      
      // Add items for array types
      if (param.type === 'array' && param.items) {
        property.items = param.items
      }
      
      properties[param.name] = property
      
      if (param.required) {
        required.push(param.name)
      }
    }
    
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties,
        required
      }
    }
  }
  
  /**
   * Validate input against parameters
   */
  protected validateInput(input: Record<string, unknown>): { valid: boolean; error?: string } {
    // Check required parameters
    for (const param of this.parameters) {
      if (param.required && !(param.name in input)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param.name}`
        }
      }
    }
    
    // Check types (basic validation)
    for (const [key, value] of Object.entries(input)) {
      const param = this.parameters.find(p => p.name === key)
      if (!param) {
        continue // Extra parameters are allowed
      }
      
      const actualType = typeof value
      if (param.type === 'array' && !Array.isArray(value)) {
        return {
          valid: false,
          error: `Parameter ${key} must be an array`
        }
      }
      
      if (param.type !== 'array' && param.type !== 'object' && param.type !== actualType) {
        return {
          valid: false,
          error: `Parameter ${key} must be of type ${param.type}`
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Helper to create success result
   */
  protected success(result?: unknown): ToolResult {
    return { success: true, result }
  }
  
  /**
   * Helper to create error result
   */
  protected error(error: string): ToolResult {
    return { success: false, error }
  }
}
