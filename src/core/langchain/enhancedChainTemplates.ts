import { ChainDefinition } from './types';
import { CappyChainTools } from './chainTools';
import { ChainNodeFactory } from './cappyChain';

/**
 * Enhanced chain templates demonstrating internal tool usage
 * Following Python LangChain pattern with tools as methods within chains
 */
export class EnhancedChainTemplates {

    /**
     * Task creation and work chain with proper node factory usage
     */
    static createTaskWorkflowChain(): ChainDefinition {
        return {
            id: 'enhanced_task_workflow',
            name: 'Enhanced Cappy Task Workflow',
            description: 'Create a Cappy task and work on it using internal tools',
            nodes: [
                ChainNodeFactory.createChainToolNode(
                    'log_start',
                    'Log Workflow Start',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'Starting Cappy task workflow',
                            level: 'info'
                        }
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'create_task_node',
                    'Create Cappy Task',
                    {
                        toolName: 'create_task',
                        parameters: {}
                    },
                    ['log_start']
                ),
                ChainNodeFactory.createChainToolNode(
                    'work_task_node',
                    'Work on Task',
                    {
                        toolName: 'work_on_task',
                        parameters: {}
                    },
                    ['create_task_node']
                ),
                ChainNodeFactory.createChainToolNode(
                    'notify_task_done',
                    'Notify Task Complete',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'Task workflow completed successfully!',
                            type: 'info'
                        }
                    },
                    ['work_task_node']
                )
            ],
            startNode: 'log_start',
            tools: [
                CappyChainTools.logMessage,
                CappyChainTools.createTask,
                CappyChainTools.workOnTask,
                CappyChainTools.showNotification
            ]
        };
    }

    /**
     * Simple file creation chain
     */
    static createFileCreationChain(): ChainDefinition {
        return {
            id: 'enhanced_file_creation',
            name: 'Enhanced File Creation Chain',
            description: 'Create files using internal tools with logging',
            nodes: [
                ChainNodeFactory.createChainToolNode(
                    'log_file_start',
                    'Log File Creation Start',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'Starting file creation: {{file_path}}',
                            level: 'info'
                        }
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'create_file_node',
                    'Create File',
                    {
                        toolName: 'create_file',
                        parameters: {
                            filePath: '{{file_path}}',
                            content: '{{file_content}}'
                        }
                    },
                    ['log_file_start']
                ),
                ChainNodeFactory.createChainToolNode(
                    'notify_file_created',
                    'Notify File Created',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'File created successfully: {{file_path}}',
                            type: 'info'
                        }
                    },
                    ['create_file_node']
                )
            ],
            startNode: 'log_file_start',
            tools: [
                CappyChainTools.logMessage,
                CappyChainTools.createFile,
                CappyChainTools.showNotification
            ]
        };
    }

    /**
     * Command execution chain
     */
    static createCommandExecutionChain(): ChainDefinition {
        return {
            id: 'enhanced_command_execution',
            name: 'Enhanced Command Execution Chain',
            description: 'Execute VS Code commands with proper logging',
            nodes: [
                ChainNodeFactory.createChainToolNode(
                    'log_command_start',
                    'Log Command Start',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'Executing command: {{command_name}}',
                            level: 'info'
                        }
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'execute_command',
                    'Execute VS Code Command',
                    {
                        toolName: 'execute_command',
                        parameters: {
                            command: '{{command_name}}',
                            args: '{{command_args}}'
                        }
                    },
                    ['log_command_start']
                ),
                ChainNodeFactory.createChainToolNode(
                    'notify_completion',
                    'Notify Completion',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'Command execution completed: {{command_name}}',
                            type: 'info'
                        }
                    },
                    ['execute_command']
                )
            ],
            startNode: 'log_command_start',
            tools: [
                CappyChainTools.logMessage,
                CappyChainTools.executeCommand,
                CappyChainTools.showNotification
            ]
        };
    }

    /**
     * Variable management demonstration chain
     */
    static createVariableManagementChain(): ChainDefinition {
        return {
            id: 'enhanced_variable_management',
            name: 'Enhanced Variable Management Chain',
            description: 'Demonstrate variable setting and usage with internal tools',
            nodes: [
                ChainNodeFactory.createChainToolNode(
                    'set_start_time',
                    'Set Start Time Variable',
                    {
                        toolName: 'set_variable',
                        parameters: {
                            name: 'workflow_start',
                            value: '{{current_timestamp}}'
                        }
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'set_user_name',
                    'Set User Name Variable',
                    {
                        toolName: 'set_variable',
                        parameters: {
                            name: 'user_name',
                            value: '{{input_user_name}}'
                        }
                    },
                    ['set_start_time']
                ),
                ChainNodeFactory.createChainToolNode(
                    'log_variables',
                    'Log All Variables',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'Variables set - Start: {{workflow_start}}, User: {{user_name}}',
                            level: 'info'
                        }
                    },
                    ['set_user_name']
                ),
                ChainNodeFactory.createChainToolNode(
                    'notify_variables_set',
                    'Notify Variables Set',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'All variables configured for user: {{user_name}}',
                            type: 'info'
                        }
                    },
                    ['log_variables']
                )
            ],
            startNode: 'set_start_time',
            tools: [
                CappyChainTools.setVariable,
                CappyChainTools.logMessage,
                CappyChainTools.showNotification
            ]
        };
    }

    /**
     * Mixed LLM and tool chain
     */
    static createMixedLLMToolChain(): ChainDefinition {
        return {
            id: 'enhanced_mixed_llm_tool',
            name: 'Enhanced Mixed LLM and Tool Chain',
            description: 'Combine LLM reasoning with internal tool execution',
            nodes: [
                ChainNodeFactory.createLLMNode(
                    'llm_analyze',
                    'Analyze Request',
                    {
                        model: 'gpt-4',
                        prompt: 'Analyze this request and determine what actions to take: {{input}}',
                        systemMessage: 'You are an AI assistant that can analyze requests and suggest actions.',
                        tools: ['log_message', 'show_notification']
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'log_analysis',
                    'Log Analysis Result',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'LLM Analysis completed: {{llm_analyze_result}}',
                            level: 'info'
                        }
                    },
                    ['llm_analyze']
                ),
                ChainNodeFactory.createConditionNode(
                    'check_action_needed',
                    'Check if Action Needed',
                    {
                        condition: '{{action_required}} === "true"',
                        truePath: 'execute_action',
                        falsePath: 'notify_no_action'
                    },
                    ['log_analysis']
                ),
                ChainNodeFactory.createChainToolNode(
                    'execute_action',
                    'Execute Required Action',
                    {
                        toolName: 'execute_command',
                        parameters: {
                            command: '{{suggested_command}}',
                            args: '{{suggested_args}}'
                        }
                    },
                    ['check_action_needed']
                ),
                ChainNodeFactory.createChainToolNode(
                    'notify_no_action',
                    'Notify No Action Needed',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'Analysis complete - no action required',
                            type: 'info'
                        }
                    },
                    ['check_action_needed']
                )
            ],
            startNode: 'llm_analyze',
            tools: [
                CappyChainTools.logMessage,
                CappyChainTools.showNotification,
                CappyChainTools.executeCommand
            ]
        };
    }

    /**
     * Get all enhanced chain templates
     */
    static getAllEnhancedTemplates(): ChainDefinition[] {
        return [
            this.createTaskWorkflowChain(),
            this.createFileCreationChain(),
            this.createCommandExecutionChain(),
            this.createVariableManagementChain(),
            this.createMixedLLMToolChain()
        ];
    }

    /**
     * Get enhanced template by ID
     */
    static getEnhancedTemplate(id: string): ChainDefinition | undefined {
        return this.getAllEnhancedTemplates().find(template => template.id === id);
    }

    /**
     * Demonstrate tool registration pattern
     */
    static createDemoToolRegistrationChain(): ChainDefinition {
        return {
            id: 'demo_tool_registration',
            name: 'Demo Tool Registration Pattern',
            description: 'Demonstrates Python LangChain-style tool registration within chains',
            nodes: [
                ChainNodeFactory.createChainToolNode(
                    'demo_log',
                    'Demo Logging Tool',
                    {
                        toolName: 'log_message',
                        parameters: {
                            message: 'Demonstrating internal tool registration pattern',
                            level: 'info'
                        }
                    }
                ),
                ChainNodeFactory.createChainToolNode(
                    'demo_variable',
                    'Demo Variable Tool',
                    {
                        toolName: 'set_variable',
                        parameters: {
                            name: 'demo_status',
                            value: 'tools_registered_successfully'
                        }
                    },
                    ['demo_log']
                ),
                ChainNodeFactory.createChainToolNode(
                    'demo_notification',
                    'Demo Notification Tool',
                    {
                        toolName: 'show_notification',
                        parameters: {
                            message: 'Tool registration demo completed: {{demo_status}}',
                            type: 'info'
                        }
                    },
                    ['demo_variable']
                )
            ],
            startNode: 'demo_log',
            tools: [
                CappyChainTools.logMessage,
                CappyChainTools.setVariable,
                CappyChainTools.showNotification
            ]
        };
    }
}