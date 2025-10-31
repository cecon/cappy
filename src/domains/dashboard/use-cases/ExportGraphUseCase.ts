/**
 * @fileoverview Use case for exporting graph data to various formats
 * @module domains/dashboard/use-cases/ExportGraphUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData } from '../types';

/**
 * Export format types
 */
export type ExportFormat =
  | 'json'       // JSON format
  | 'graphml'    // GraphML XML format
  | 'cytoscape'  // Cytoscape.js format
  | 'gexf'       // GEXF format
  | 'dot'        // Graphviz DOT format
  | 'csv';       // CSV format (nodes and edges in separate files)

/**
 * Options for exporting graph data
 */
export interface ExportGraphOptions {
  /**
   * Format to export to
   * @default 'json'
   */
  format?: ExportFormat;
  
  /**
   * Whether to include metadata
   * @default true
   */
  includeMetadata?: boolean;
  
  /**
   * Whether to include visual properties
   * @default true
   */
  includeVisual?: boolean;
  
  /**
   * Whether to include calculated metrics
   * @default true
   */
  includeMetrics?: boolean;
  
  /**
   * Whether to pretty-print output (for text formats)
   * @default true
   */
  prettyPrint?: boolean;
  
  /**
   * Indentation spaces (for pretty-print)
   * @default 2
   */
  indent?: number;
}

/**
 * Result of exporting graph data
 */
export interface ExportGraphResult {
  /**
   * Exported data as string
   */
  data: string;
  
  /**
   * Additional files (e.g., for CSV export)
   */
  additionalFiles?: Record<string, string>;
  
  /**
   * Metadata about the export
   */
  metadata: {
    /**
     * Format used
     */
    format: ExportFormat;
    
    /**
     * Number of nodes exported
     */
    nodeCount: number;
    
    /**
     * Number of edges exported
     */
    edgeCount: number;
    
    /**
     * Size of exported data in bytes
     */
    sizeBytes: number;
    
    /**
     * Time taken to export (in milliseconds)
     */
    exportTimeMs: number;
    
    /**
     * MIME type of exported data
     */
    mimeType: string;
    
    /**
     * Suggested file extension
     */
    fileExtension: string;
  };
}

/**
 * Use case for exporting graph data to various formats
 * 
 * This use case supports exporting to multiple industry-standard formats:
 * - JSON: Native format, preserves all data
 * - GraphML: XML-based format for graph exchange
 * - Cytoscape.js: Format for Cytoscape visualization
 * - GEXF: Format for Gephi visualization
 * - DOT: Graphviz format for graph visualization
 * - CSV: Tabular format for spreadsheet applications
 * 
 * @example
 * ```typescript
 * const useCase = new ExportGraphUseCase();
 * 
 * // Export to JSON
 * const json = await useCase.execute(graphData);
 * 
 * // Export to GraphML
 * const graphml = await useCase.execute(graphData, {
 *   format: 'graphml'
 * });
 * 
 * // Export to CSV (returns multiple files)
 * const csv = await useCase.execute(graphData, {
 *   format: 'csv'
 * });
 * // csv.data contains nodes.csv
 * // csv.additionalFiles['edges.csv'] contains edges data
 * ```
 */
export class ExportGraphUseCase {
  /**
   * Executes the use case to export graph data
   * 
   * @param data - Graph data to export
   * @param options - Export options
   * @returns Promise resolving to export result
   * @throws {Error} When export fails or validation fails
   */
  async execute(
    data: GraphData,
    options: ExportGraphOptions = {}
  ): Promise<ExportGraphResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(data, options);
      
      // Set defaults
      const format = options.format ?? 'json';
      const includeMetadata = options.includeMetadata ?? true;
      const includeVisual = options.includeVisual ?? true;
      const includeMetrics = options.includeMetrics ?? true;
      const prettyPrint = options.prettyPrint ?? true;
      const indent = options.indent ?? 2;
      
      // Export based on format
      let result: { data: string; additionalFiles?: Record<string, string> };
      
      switch (format) {
        case 'json':
          result = this.exportToJson(
            data,
            { includeMetadata, includeVisual, includeMetrics, prettyPrint, indent }
          );
          break;
        
        case 'graphml':
          result = this.exportToGraphML(
            data,
            { includeMetadata, includeVisual, includeMetrics, prettyPrint, indent }
          );
          break;
        
        case 'cytoscape':
          result = this.exportToCytoscape(
            data,
            { includeMetadata, includeVisual, includeMetrics, prettyPrint, indent }
          );
          break;
        
        case 'gexf':
          result = this.exportToGEXF(
            data,
            { includeMetadata, includeVisual, includeMetrics, prettyPrint, indent }
          );
          break;
        
        case 'dot':
          result = this.exportToDOT(data);
          break;
        
        case 'csv':
          result = this.exportToCSV(data);
          break;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      const exportTimeMs = Date.now() - startTime;
      const sizeBytes = new TextEncoder().encode(result.data).length;
      
      return {
        ...result,
        metadata: {
          format,
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
          sizeBytes,
          exportTimeMs,
          mimeType: this.getMimeType(format),
          fileExtension: this.getFileExtension(format)
        }
      };
    } catch (error) {
      const exportTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to export graph after ${exportTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Exports graph to JSON format
   */
  private exportToJson(
    data: GraphData,
    options: {
      includeMetadata: boolean;
      includeVisual: boolean;
      includeMetrics: boolean;
      prettyPrint: boolean;
      indent: number;
    }
  ): { data: string } {
    const nodes = data.nodes.map(node => {
      const exported: Record<string, unknown> = {
        id: node.id,
        label: node.label,
        type: node.type,
        confidence: node.confidence,
        created: node.created,
        updated: node.updated
      };
      
      if (options.includeVisual) {
        exported.position = node.position;
        exported.visual = node.visual;
        exported.state = node.state;
      }
      
      if (options.includeMetrics) {
        exported.connections = node.connections;
        exported.metrics = node.metrics;
      }
      
      if (options.includeMetadata) {
        exported.metadata = node.metadata;
      }
      
      return exported;
    });
    
    const edges = data.edges.map(edge => {
      const exported: Record<string, unknown> = {
        id: edge.id,
        label: edge.label,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        bidirectional: edge.bidirectional,
        confidence: edge.confidence,
        created: edge.created,
        updated: edge.updated
      };
      
      if (options.includeVisual) {
        exported.visual = edge.visual;
        exported.state = edge.state;
      }
      
      if (options.includeMetadata) {
        exported.metadata = edge.metadata;
      }
      
      return exported;
    });
    
    const output = {
      nodes,
      edges,
      statistics: data.statistics,
      lastUpdated: data.lastUpdated
    };
    
    return {
      data: options.prettyPrint 
        ? JSON.stringify(output, null, options.indent)
        : JSON.stringify(output)
    };
  }

  /**
   * Exports graph to GraphML format
   */
  private exportToGraphML(
    data: GraphData,
    options: {
      includeMetadata: boolean;
      includeVisual: boolean;
      includeMetrics: boolean;
      prettyPrint: boolean;
      indent: number;
    }
  ): { data: string } {
    const indent = options.prettyPrint ? ' '.repeat(options.indent) : '';
    const nl = options.prettyPrint ? '\n' : '';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>${nl}`;
    xml += `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"${nl}`;
    xml += `${indent}xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${nl}`;
    xml += `${indent}xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns${nl}`;
    xml += `${indent}http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">${nl}`;
    
    // Define keys for attributes
    xml += `${indent}<key id="label" for="all" attr.name="label" attr.type="string"/>${nl}`;
    xml += `${indent}<key id="type" for="all" attr.name="type" attr.type="string"/>${nl}`;
    xml += `${indent}<key id="confidence" for="all" attr.name="confidence" attr.type="double"/>${nl}`;
    xml += `${indent}<key id="weight" for="edge" attr.name="weight" attr.type="double"/>${nl}`;
    
    xml += `${indent}<graph id="G" edgedefault="directed">${nl}`;
    
    // Nodes
    for (const node of data.nodes) {
      xml += `${indent}${indent}<node id="${this.escapeXml(node.id)}">${nl}`;
      xml += `${indent}${indent}${indent}<data key="label">${this.escapeXml(node.label)}</data>${nl}`;
      xml += `${indent}${indent}${indent}<data key="type">${this.escapeXml(node.type)}</data>${nl}`;
      xml += `${indent}${indent}${indent}<data key="confidence">${node.confidence}</data>${nl}`;
      xml += `${indent}${indent}</node>${nl}`;
    }
    
    // Edges
    for (const edge of data.edges) {
      xml += `${indent}${indent}<edge id="${this.escapeXml(edge.id)}" `;
      xml += `source="${this.escapeXml(edge.source)}" `;
      xml += `target="${this.escapeXml(edge.target)}">${nl}`;
      xml += `${indent}${indent}${indent}<data key="label">${this.escapeXml(edge.label)}</data>${nl}`;
      xml += `${indent}${indent}${indent}<data key="type">${this.escapeXml(edge.type)}</data>${nl}`;
      xml += `${indent}${indent}${indent}<data key="weight">${edge.weight}</data>${nl}`;
      xml += `${indent}${indent}${indent}<data key="confidence">${edge.confidence}</data>${nl}`;
      xml += `${indent}${indent}</edge>${nl}`;
    }
    
    xml += `${indent}</graph>${nl}`;
    xml += `</graphml>`;
    
    return { data: xml };
  }

  /**
   * Exports graph to Cytoscape.js format
   */
  private exportToCytoscape(
    data: GraphData,
    options: {
      includeMetadata: boolean;
      includeVisual: boolean;
      includeMetrics: boolean;
      prettyPrint: boolean;
      indent: number;
    }
  ): { data: string } {
    const elements = [
      ...data.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          ...(options.includeMetrics && { metrics: node.metrics }),
          ...(options.includeMetadata && { metadata: node.metadata })
        },
        ...(options.includeVisual && node.position && {
          position: { x: node.position.x, y: node.position.y }
        })
      })),
      ...data.edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
          weight: edge.weight,
          ...(options.includeMetadata && { metadata: edge.metadata })
        }
      }))
    ];
    
    return {
      data: options.prettyPrint
        ? JSON.stringify({ elements }, null, options.indent)
        : JSON.stringify({ elements })
    };
  }

  /**
   * Exports graph to GEXF format
   */
  private exportToGEXF(
    data: GraphData,
    options: {
      includeMetadata: boolean;
      includeVisual: boolean;
      includeMetrics: boolean;
      prettyPrint: boolean;
      indent: number;
    }
  ): { data: string } {
    const indent = options.prettyPrint ? ' '.repeat(options.indent) : '';
    const nl = options.prettyPrint ? '\n' : '';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>${nl}`;
    xml += `<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">${nl}`;
    xml += `${indent}<graph mode="static" defaultedgetype="directed">${nl}`;
    
    // Nodes
    xml += `${indent}${indent}<nodes>${nl}`;
    for (const node of data.nodes) {
      xml += `${indent}${indent}${indent}<node id="${this.escapeXml(node.id)}" `;
      xml += `label="${this.escapeXml(node.label)}"/>${nl}`;
    }
    xml += `${indent}${indent}</nodes>${nl}`;
    
    // Edges
    xml += `${indent}${indent}<edges>${nl}`;
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      xml += `${indent}${indent}${indent}<edge id="${i}" `;
      xml += `source="${this.escapeXml(edge.source)}" `;
      xml += `target="${this.escapeXml(edge.target)}" `;
      xml += `weight="${edge.weight}"/>${nl}`;
    }
    xml += `${indent}${indent}</edges>${nl}`;
    
    xml += `${indent}</graph>${nl}`;
    xml += `</gexf>`;
    
    return { data: xml };
  }

  /**
   * Exports graph to Graphviz DOT format
   */
  private exportToDOT(
    data: GraphData
  ): { data: string } {
    let dot = 'digraph G {\n';
    dot += '  node [shape=box];\n';
    
    // Nodes
    for (const node of data.nodes) {
      dot += `  "${this.escapeDot(node.id)}" [label="${this.escapeDot(node.label)}"];\n`;
    }
    
    // Edges
    for (const edge of data.edges) {
      dot += `  "${this.escapeDot(edge.source)}" -> "${this.escapeDot(edge.target)}"`;
      dot += ` [label="${this.escapeDot(edge.label)}", weight=${edge.weight}];\n`;
    }
    
    dot += '}';
    
    return { data: dot };
  }

  /**
   * Exports graph to CSV format (nodes and edges as separate files)
   */
  private exportToCSV(
    data: GraphData
  ): { data: string; additionalFiles: Record<string, string> } {
    // Nodes CSV
    let nodesCSV = 'id,label,type,confidence,created,updated\n';
    for (const node of data.nodes) {
      nodesCSV += `"${this.escapeCSV(node.id)}",`;
      nodesCSV += `"${this.escapeCSV(node.label)}",`;
      nodesCSV += `"${this.escapeCSV(node.type)}",`;
      nodesCSV += `${node.confidence},`;
      nodesCSV += `"${node.created}",`;
      nodesCSV += `"${node.updated}"\n`;
    }
    
    // Edges CSV
    let edgesCSV = 'id,source,target,label,type,weight,confidence\n';
    for (const edge of data.edges) {
      edgesCSV += `"${this.escapeCSV(edge.id)}",`;
      edgesCSV += `"${this.escapeCSV(edge.source)}",`;
      edgesCSV += `"${this.escapeCSV(edge.target)}",`;
      edgesCSV += `"${this.escapeCSV(edge.label)}",`;
      edgesCSV += `"${this.escapeCSV(edge.type)}",`;
      edgesCSV += `${edge.weight},`;
      edgesCSV += `${edge.confidence}\n`;
    }
    
    return {
      data: nodesCSV,
      additionalFiles: {
        'edges.csv': edgesCSV
      }
    };
  }

  /**
   * Escapes XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escapes DOT special characters
   */
  private escapeDot(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  /**
   * Escapes CSV special characters
   */
  private escapeCSV(str: string): string {
    return str.replace(/"/g, '""');
  }

  /**
   * Gets MIME type for format
   */
  private getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      json: 'application/json',
      graphml: 'application/xml',
      cytoscape: 'application/json',
      gexf: 'application/xml',
      dot: 'text/vnd.graphviz',
      csv: 'text/csv'
    };
    return mimeTypes[format];
  }

  /**
   * Gets file extension for format
   */
  private getFileExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      json: '.json',
      graphml: '.graphml',
      cytoscape: '.json',
      gexf: '.gexf',
      dot: '.dot',
      csv: '.csv'
    };
    return extensions[format];
  }

  /**
   * Validates the input parameters
   * 
   * @param data - Graph data to validate
   * @param options - Options to validate
   * @throws {Error} When validation fails
   */
  private validateInput(data: GraphData, options: ExportGraphOptions): void {
    if (!data) {
      throw new Error('Graph data is required');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Graph data must contain nodes and edges arrays');
    }
    
    // Validate that graph is not empty
    if (data.nodes.length === 0) {
      throw new Error(
        'Graph has no nodes. Please run workspace scan to index files first.'
      );
    }
    
    if (options.indent !== undefined) {
      if (!Number.isInteger(options.indent) || options.indent < 0) {
        throw new Error('Indent must be a non-negative integer');
      }
    }
  }
}
