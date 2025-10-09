import { ChainDefinition } from './types';
import { ChainNodeFactory } from './cappyChain';

export class ChainTemplates {
    
    /**
     * Chain para análise e refatoração de código
     */
    static createCodeAnalysisChain(): ChainDefinition {
        return {
            id: 'code-analysis-chain',
            name: 'Code Analysis & Refactoring',
            description: 'Analyzes code quality, suggests improvements, and creates refactoring tasks',
            startNode: 'analyze-code',
            variables: {
                filePath: '{{currentFile}}',
                language: 'typescript'
            },
            nodes: [
                ChainNodeFactory.createLLMNode(
                    'analyze-code',
                    'Analyze Code Quality',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Analyze the following {{language}} code for:
1. Code quality issues
2. Performance improvements
3. Security vulnerabilities
4. Best practices violations

Code to analyze:
{{input}}

Provide detailed analysis with specific suggestions.`,
                        systemMessage: 'You are a senior software engineer focused on code quality and best practices.'
                    }
                ),
                
                ChainNodeFactory.createConditionNode(
                    'check-issues',
                    'Check if Issues Found',
                    {
                        condition: '{{analyze-code_result}} contains "issues found"',
                        truePath: 'create-refactor-task',
                        falsePath: 'code-looks-good'
                    },
                    ['analyze-code']
                ),
                
                ChainNodeFactory.createToolNode(
                    'create-refactor-task',
                    'Create Refactoring Task',
                    {
                        toolName: 'cappy.createTaskFile',
                        parameters: {
                            title: 'Refactor {{filePath}}',
                            description: '{{analyze-code_result}}',
                            area: 'refactor',
                            priority: 'high'
                        }
                    },
                    ['check-issues']
                ),
                
                ChainNodeFactory.createLLMNode(
                    'code-looks-good',
                    'Generate Code Appreciation',
                    {
                        model: 'copilot-gpt-4',
                        prompt: 'The code analysis shows good quality. Write a brief positive summary highlighting the strengths of this code.',
                        systemMessage: 'You are encouraging and focus on positive aspects of code.'
                    },
                    ['check-issues']
                )
            ]
        };
    }

    /**
     * Chain para implementação de features completas
     */
    static createFeatureImplementationChain(): ChainDefinition {
        return {
            id: 'feature-implementation-chain',
            name: 'Feature Implementation Pipeline',
            description: 'Complete pipeline for implementing a new feature from requirements to tests',
            startNode: 'analyze-requirements',
            variables: {
                featureName: '',
                complexity: 'medium'
            },
            nodes: [
                ChainNodeFactory.createLLMNode(
                    'analyze-requirements',
                    'Analyze Feature Requirements',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Analyze these feature requirements and break them down into implementation steps:

Requirements: {{input}}

Provide:
1. Technical approach
2. Required components
3. Implementation steps
4. Potential challenges
5. Testing strategy`,
                        systemMessage: 'You are a technical architect planning feature implementation.'
                    }
                ),
                
                ChainNodeFactory.createTransformNode(
                    'extract-components',
                    'Extract Components List',
                    {
                        transformer: 'extract_json'
                    },
                    ['analyze-requirements']
                ),
                
                ChainNodeFactory.createToolNode(
                    'create-feature-task',
                    'Create Main Feature Task',
                    {
                        toolName: 'cappy.createTaskFile',
                        parameters: {
                            title: 'Implement {{featureName}}',
                            description: '{{analyze-requirements_result}}',
                            area: 'feature',
                            priority: 'high',
                            estimate: '2h'
                        }
                    },
                    ['analyze-requirements']
                ),
                
                ChainNodeFactory.createLLMNode(
                    'generate-tests',
                    'Generate Test Plan',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Based on the feature analysis, create a comprehensive test plan:

Feature Analysis: {{analyze-requirements_result}}

Include:
1. Unit tests needed
2. Integration tests
3. E2E test scenarios
4. Edge cases to test`,
                        systemMessage: 'You are a QA engineer creating comprehensive test plans.'
                    },
                    ['create-feature-task']
                ),
                
                ChainNodeFactory.createToolNode(
                    'create-test-task',
                    'Create Testing Task',
                    {
                        toolName: 'cappy.createTaskFile',
                        parameters: {
                            title: 'Test {{featureName}}',
                            description: '{{generate-tests_result}}',
                            area: 'testing',
                            priority: 'medium'
                        }
                    },
                    ['generate-tests']
                )
            ]
        };
    }

    /**
     * Chain para debug de problemas
     */
    static createDebugChain(): ChainDefinition {
        return {
            id: 'debug-chain',
            name: 'Problem Debug & Fix',
            description: 'Systematic approach to debugging and fixing issues',
            startNode: 'analyze-problem',
            variables: {
                errorType: 'runtime',
                severity: 'medium'
            },
            nodes: [
                ChainNodeFactory.createLLMNode(
                    'analyze-problem',
                    'Analyze Problem',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Analyze this problem and suggest debugging steps:

Problem Description: {{input}}

Provide:
1. Likely root causes
2. Debugging steps
3. Information needed
4. Potential solutions
5. Prevention strategies`,
                        systemMessage: 'You are a debugging expert helping to solve technical problems.'
                    }
                ),
                
                ChainNodeFactory.createToolNode(
                    'search-related-code',
                    'Search Related Code',
                    {
                        toolName: 'cappy.query',
                        parameters: {
                            query: '{{input}}',
                            limit: 5
                        }
                    },
                    ['analyze-problem']
                ),
                
                ChainNodeFactory.createLLMNode(
                    'suggest-fix',
                    'Suggest Fix',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Based on the problem analysis and related code, suggest a specific fix:

Problem Analysis: {{analyze-problem_result}}
Related Code: {{search-related-code_result}}

Provide:
1. Specific code changes needed
2. Step-by-step fix instructions
3. Testing approach
4. Rollback plan if needed`,
                        systemMessage: 'You are providing specific, actionable solutions.'
                    },
                    ['search-related-code']
                ),
                
                ChainNodeFactory.createToolNode(
                    'create-bugfix-task',
                    'Create Bugfix Task',
                    {
                        toolName: 'cappy.createTaskFile',
                        parameters: {
                            title: 'Fix: {{input}}',
                            description: '{{suggest-fix_result}}',
                            area: 'bugfix',
                            priority: '{{severity}}'
                        }
                    },
                    ['suggest-fix']
                )
            ]
        };
    }

    /**
     * Chain para documentação automática
     */
    static createDocumentationChain(): ChainDefinition {
        return {
            id: 'documentation-chain',
            name: 'Auto Documentation Generator',
            description: 'Automatically generates comprehensive documentation',
            startNode: 'analyze-codebase',
            variables: {
                outputFormat: 'markdown',
                includeExamples: true
            },
            nodes: [
                ChainNodeFactory.createToolNode(
                    'analyze-codebase',
                    'Analyze Codebase Structure',
                    {
                        toolName: 'cappy.knowstack',
                        parameters: {}
                    }
                ),
                
                ChainNodeFactory.createLLMNode(
                    'generate-api-docs',
                    'Generate API Documentation',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Based on the codebase analysis, generate comprehensive API documentation:

Codebase Analysis: {{analyze-codebase_result}}
Code to document: {{input}}

Include:
1. Function/method descriptions
2. Parameters and return values
3. Usage examples
4. Error handling
5. Dependencies`,
                        systemMessage: 'You are a technical writer creating clear, comprehensive documentation.'
                    },
                    ['analyze-codebase']
                ),
                
                ChainNodeFactory.createLLMNode(
                    'generate-user-guide',
                    'Generate User Guide',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Create a user-friendly guide based on the API documentation:

API Documentation: {{generate-api-docs_result}}

Create:
1. Getting started guide
2. Common use cases
3. Examples and tutorials
4. Troubleshooting section
5. FAQ`,
                        systemMessage: 'You write documentation that is beginner-friendly and practical.'
                    },
                    ['generate-api-docs']
                ),
                
                ChainNodeFactory.createTransformNode(
                    'format-docs',
                    'Format Documentation',
                    {
                        transformer: 'join_lines'
                    },
                    ['generate-user-guide']
                )
            ]
        };
    }

    /**
     * Chain para otimização de performance
     */
    static createPerformanceOptimizationChain(): ChainDefinition {
        return {
            id: 'performance-optimization-chain',
            name: 'Performance Optimization Pipeline',
            description: 'Analyzes and optimizes application performance',
            startNode: 'profile-performance',
            variables: {
                targetMetric: 'response_time',
                threshold: '100ms'
            },
            nodes: [
                ChainNodeFactory.createLLMNode(
                    'profile-performance',
                    'Profile Performance Issues',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Analyze this code for performance bottlenecks:

Code: {{input}}

Focus on:
1. Algorithm complexity
2. Memory usage
3. I/O operations
4. Caching opportunities
5. Concurrent processing potential`,
                        systemMessage: 'You are a performance optimization expert.'
                    }
                ),
                
                ChainNodeFactory.createLLMNode(
                    'suggest-optimizations',
                    'Suggest Optimizations',
                    {
                        model: 'copilot-gpt-4',
                        prompt: `Based on the performance analysis, suggest specific optimizations:

Performance Analysis: {{profile-performance_result}}

Provide:
1. Specific code optimizations
2. Architectural improvements
3. Caching strategies
4. Database optimizations
5. Expected performance gains`,
                        systemMessage: 'Focus on practical, measurable improvements.'
                    },
                    ['profile-performance']
                ),
                
                ChainNodeFactory.createToolNode(
                    'create-optimization-task',
                    'Create Optimization Task',
                    {
                        toolName: 'cappy.createTaskFile',
                        parameters: {
                            title: 'Optimize Performance: {{targetMetric}}',
                            description: '{{suggest-optimizations_result}}',
                            area: 'performance',
                            priority: 'medium',
                            estimate: '1h'
                        }
                    },
                    ['suggest-optimizations']
                )
            ]
        };
    }

    /**
     * Retorna todas as chains disponíveis
     */
    static getAllChains(): ChainDefinition[] {
        return [
            this.createCodeAnalysisChain(),
            this.createFeatureImplementationChain(),
            this.createDebugChain(),
            this.createDocumentationChain(),
            this.createPerformanceOptimizationChain()
        ];
    }

    /**
     * Retorna uma chain por ID
     */
    static getChainById(id: string): ChainDefinition | undefined {
        return this.getAllChains().find(chain => chain.id === id);
    }
}