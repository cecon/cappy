/**
 * @fileoverview Example integration of HybridRetriever with Cappy
 * @module examples/hybrid-retriever-integration
 */

import { HybridRetriever } from '../services/hybrid-retriever';
import type { GraphData } from '../domains/graph/types';

/**
 * Example 1: Basic usage for context retrieval
 */
export async function basicRetrieval(graphData: GraphData) {
  const retriever = new HybridRetriever(graphData);
  
  // Simple query
  const result = await retriever.retrieve('JWT authentication');
  
  console.log(`Found ${result.contexts.length} relevant contexts`);
  console.log(`Retrieval time: ${result.metadata.retrievalTimeMs}ms\n`);
  
  // Display results
  result.contexts.forEach((ctx, idx) => {
    console.log(`${idx + 1}. [${ctx.source}] ${ctx.metadata.title}`);
    console.log(`   Score: ${ctx.score.toFixed(3)}`);
    console.log(`   ${ctx.snippet}\n`);
  });
  
  return result;
}

/**
 * Example 2: Integration with Language Model (RAG)
 */
export async function ragIntegration(graphData: GraphData, userQuery: string) {
  const retriever = new HybridRetriever(graphData);
  
  // Retrieve context for LLM
  const result = await retriever.retrieve(userQuery, {
    strategy: 'hybrid',
    maxResults: 10,
    minScore: 0.6,
    sources: ['code', 'documentation', 'prevention'],
    codeWeight: 0.4,
    docWeight: 0.3,
    preventionWeight: 0.3,
    rerank: true
  });
  
  // Format context for LLM
  const contextBlocks = result.contexts.map(ctx => {
    const header = `[${ctx.source.toUpperCase()}] ${ctx.metadata.title}`;
    const separator = '='.repeat(header.length);
    return `${header}\n${separator}\n${ctx.content}\n`;
  });
  
  const contextText = contextBlocks.join('\n---\n\n');
  
  // Construct prompt
  const prompt = `
Context:
${contextText}

User Query: ${userQuery}

Please answer the user's query using the provided context.
`;
  
  return {
    prompt,
    contexts: result.contexts,
    metadata: result.metadata
  };
}

/**
 * Example 3: Task context gathering
 */
export async function gatherTaskContext(
  graphData: GraphData,
  taskDescription: string,
  category?: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Retrieve comprehensive context for task creation
  const result = await retriever.retrieve(taskDescription, {
    strategy: 'hybrid',
    maxResults: 20,
    minScore: 0.5,
    sources: ['task', 'prevention', 'documentation', 'code'],
    taskWeight: 0.3,
    preventionWeight: 0.3,
    docWeight: 0.2,
    codeWeight: 0.2,
    category,
    rerank: true,
    includeRelated: true
  });
  
  // Group by source
  const grouped = {
    relatedTasks: result.contexts.filter(ctx => ctx.source === 'task'),
    preventionRules: result.contexts.filter(ctx => ctx.source === 'prevention'),
    documentation: result.contexts.filter(ctx => ctx.source === 'documentation'),
    codeExamples: result.contexts.filter(ctx => ctx.source === 'code')
  };
  
  return {
    taskDescription,
    category,
    context: grouped,
    metadata: result.metadata
  };
}

/**
 * Example 4: Code review context
 */
export async function getCodeReviewContext(
  graphData: GraphData,
  filePath: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Extract filename and potential keywords
  const fileName = filePath.split('/').pop() || '';
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Retrieve prevention rules and related docs
  const result = await retriever.retrieve(fileNameWithoutExt, {
    sources: ['prevention', 'documentation'],
    preventionWeight: 0.6,
    docWeight: 0.4,
    maxResults: 15,
    minScore: 0.5,
    rerank: true
  });
  
  // Format for code review
  const preventionRules = result.contexts
    .filter(ctx => ctx.source === 'prevention')
    .map(ctx => ({
      title: ctx.metadata.title || 'Untitled Rule',
      category: ctx.metadata.category || 'general',
      content: ctx.content
    }));
  
  const relevantDocs = result.contexts
    .filter(ctx => ctx.source === 'documentation')
    .map(ctx => ({
      title: ctx.metadata.title || 'Untitled Doc',
      path: ctx.filePath,
      snippet: ctx.snippet
    }));
  
  return {
    filePath,
    preventionRules,
    relevantDocs,
    reviewChecklist: preventionRules.map(rule => rule.title)
  };
}

/**
 * Example 5: Semantic code search
 */
export async function semanticCodeSearch(
  graphData: GraphData,
  searchQuery: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Search specifically in code
  const result = await retriever.retrieve(searchQuery, {
    strategy: 'semantic',
    sources: ['code'],
    codeWeight: 1.0,
    maxResults: 25,
    minScore: 0.4,
    includeRelated: true,
    rerank: true
  });
  
  // Group by file
  const byFile = result.contexts.reduce((acc, ctx) => {
    const file = ctx.filePath || 'unknown';
    if (!acc[file]) {
      acc[file] = [];
    }
    acc[file].push(ctx);
    return acc;
  }, {} as Record<string, typeof result.contexts>);
  
  return {
    query: searchQuery,
    totalMatches: result.metadata.totalFound,
    fileCount: Object.keys(byFile).length,
    byFile,
    topResults: result.contexts.slice(0, 10)
  };
}

/**
 * Example 6: Documentation search with category filtering
 */
export async function searchDocumentation(
  graphData: GraphData,
  query: string,
  category?: string
) {
  const retriever = new HybridRetriever(graphData);
  
  const result = await retriever.retrieve(query, {
    sources: ['documentation'],
    docWeight: 1.0,
    category,
    maxResults: 15,
    minScore: 0.6,
    rerank: true
  });
  
  // Format as documentation entries
  return result.contexts.map(ctx => ({
    title: ctx.metadata.title || 'Untitled',
    category: ctx.metadata.category || 'general',
    filePath: ctx.filePath,
    lastModified: ctx.metadata.lastModified,
    score: ctx.score,
    excerpt: ctx.snippet || ctx.content.substring(0, 200) + '...',
    keywords: ctx.metadata.keywords || []
  }));
}

/**
 * Example 7: Prevention rules by category
 */
export async function getPreventionRulesByCategory(
  graphData: GraphData,
  category: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Search with category emphasis
  const result = await retriever.retrieve(category, {
    sources: ['prevention'],
    preventionWeight: 1.0,
    category,
    maxResults: 50,
    minScore: 0.3,
    rerank: true
  });
  
  // Format rules
  return result.contexts.map(ctx => ({
    id: ctx.id,
    title: ctx.metadata.title || 'Untitled Rule',
    category: ctx.metadata.category || category,
    content: ctx.content,
    keywords: ctx.metadata.keywords || [],
    score: ctx.score,
    lastModified: ctx.metadata.lastModified
  }));
}

/**
 * Example 8: Multi-source context fusion
 */
export async function getComprehensiveContext(
  graphData: GraphData,
  topic: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Get comprehensive context from all sources
  const result = await retriever.retrieve(topic, {
    strategy: 'hybrid',
    sources: ['code', 'documentation', 'prevention', 'task'],
    codeWeight: 0.3,
    docWeight: 0.3,
    preventionWeight: 0.25,
    taskWeight: 0.15,
    maxResults: 30,
    minScore: 0.5,
    rerank: true,
    includeRelated: true
  });
  
  // Create comprehensive report
  const report = {
    topic,
    summary: {
      totalContexts: result.metadata.totalFound,
      returned: result.metadata.returned,
      breakdown: result.metadata.sourceBreakdown,
      retrievalTime: result.metadata.retrievalTimeMs
    },
    codeExamples: result.contexts
      .filter(ctx => ctx.source === 'code')
      .slice(0, 10),
    documentation: result.contexts
      .filter(ctx => ctx.source === 'documentation')
      .slice(0, 5),
    preventionRules: result.contexts
      .filter(ctx => ctx.source === 'prevention')
      .slice(0, 5),
    relatedTasks: result.contexts
      .filter(ctx => ctx.source === 'task')
      .slice(0, 5),
    topResults: result.contexts.slice(0, 10)
  };
  
  return report;
}

/**
 * Example 9: Adaptive retrieval based on query type
 */
export async function adaptiveRetrieval(
  graphData: GraphData,
  query: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Analyze query to determine best strategy
  const queryLower = query.toLowerCase();
  let options = {};
  
  if (queryLower.includes('how to') || queryLower.includes('guide')) {
    // Documentation-heavy
    options = {
      sources: ['documentation', 'code'],
      docWeight: 0.7,
      codeWeight: 0.3,
      maxResults: 10
    };
  } else if (queryLower.includes('error') || queryLower.includes('problem')) {
    // Prevention rules + code
    options = {
      sources: ['prevention', 'code', 'task'],
      preventionWeight: 0.5,
      codeWeight: 0.3,
      taskWeight: 0.2,
      maxResults: 15
    };
  } else if (queryLower.includes('implement') || queryLower.includes('create')) {
    // Code + tasks + prevention
    options = {
      sources: ['code', 'task', 'prevention'],
      codeWeight: 0.4,
      taskWeight: 0.3,
      preventionWeight: 0.3,
      maxResults: 20,
      includeRelated: true
    };
  } else {
    // Balanced hybrid
    options = {
      strategy: 'hybrid',
      sources: ['code', 'documentation', 'prevention', 'task'],
      maxResults: 15
    };
  }
  
  return await retriever.retrieve(query, options);
}

/**
 * Example 10: Real-time context for IDE integration
 */
export async function getIDEContext(
  graphData: GraphData,
  currentFile: string,
  cursorPosition: { line: number; column: number },
  selection?: string
) {
  const retriever = new HybridRetriever(graphData);
  
  // Use selection or filename as query
  const query = selection || currentFile.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
  
  if (!query) {
    return null;
  }
  
  // Quick, focused retrieval
  const result = await retriever.retrieve(query, {
    sources: ['code', 'prevention'],
    codeWeight: 0.6,
    preventionWeight: 0.4,
    maxResults: 8,
    minScore: 0.5,
    rerank: false  // Skip re-ranking for speed
  });
  
  return {
    file: currentFile,
    position: cursorPosition,
    query,
    suggestions: result.contexts.slice(0, 5),
    warnings: result.contexts
      .filter(ctx => ctx.source === 'prevention')
      .slice(0, 3)
  };
}

// Export all examples
export default {
  basicRetrieval,
  ragIntegration,
  gatherTaskContext,
  getCodeReviewContext,
  semanticCodeSearch,
  searchDocumentation,
  getPreventionRulesByCategory,
  getComprehensiveContext,
  adaptiveRetrieval,
  getIDEContext
};
