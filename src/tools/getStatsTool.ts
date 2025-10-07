import * as vscode from "vscode";
import { getCappyRAGLanceDatabase } from "../store/cappyragLanceDb";

/**
 * MCP Tool for getting CappyRAG knowledge base statistics
 */
export class GetStatsTool {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get statistics about the CappyRAG knowledge base
   * @returns Statistics including document, entity, relationship, and chunk counts
   */
  async getStats(): Promise<StatsResult> {
    try {
      // Get workspace path
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const db = getCappyRAGLanceDatabase(workspaceFolder.uri.fsPath);

      // Get all data
      const documents = await db.getDocuments();
      const entities = await db.getEntities();
      const relationships = await db.getRelationships();
      const chunks = await db.getChunks();

      // Calculate additional statistics
      const totalContent = documents.reduce((sum, doc) => sum + doc.content.length, 0);
      const avgDocumentSize = documents.length > 0 ? totalContent / documents.length : 0;

      const documentsByStatus = {
        processing: documents.filter(d => d.status === 'processing').length,
        completed: documents.filter(d => d.status === 'completed').length,
        failed: documents.filter(d => d.status === 'failed').length,
      };

      const entityTypes = entities.reduce((acc, entity) => {
        acc[entity.type] = (acc[entity.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const relationshipTypes = relationships.reduce((acc, rel) => {
        acc[rel.type] = (acc[rel.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Most connected entities (by document count)
      const topEntities = entities
        .sort((a, b) => b.documentIds.length - a.documentIds.length)
        .slice(0, 10)
        .map(e => ({
          name: e.name,
          type: e.type,
          documentCount: e.documentIds.length,
        }));

      return {
        success: true,
        statistics: {
          documents: {
            total: documents.length,
            byStatus: documentsByStatus,
            totalContentSize: totalContent,
            averageSize: Math.round(avgDocumentSize),
          },
          entities: {
            total: entities.length,
            byType: entityTypes,
            topConnected: topEntities,
          },
          relationships: {
            total: relationships.length,
            byType: relationshipTypes,
          },
          chunks: {
            total: chunks.length,
            averagePerDocument: documents.length > 0 
              ? Math.round(chunks.length / documents.length) 
              : 0,
          },
          storage: {
            databasePath: db['dbPath'],
            lastUpdated: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        statistics: {
          documents: { total: 0, byStatus: { processing: 0, completed: 0, failed: 0 }, totalContentSize: 0, averageSize: 0 },
          entities: { total: 0, byType: {}, topConnected: [] },
          relationships: { total: 0, byType: {} },
          chunks: { total: 0, averagePerDocument: 0 },
          storage: { databasePath: '', lastUpdated: new Date().toISOString() },
        },
      };
    }
  }
}

/**
 * Statistics result interface
 */
export interface StatsResult {
  success: boolean;
  statistics: {
    documents: {
      total: number;
      byStatus: {
        processing: number;
        completed: number;
        failed: number;
      };
      totalContentSize: number;
      averageSize: number;
    };
    entities: {
      total: number;
      byType: Record<string, number>;
      topConnected: Array<{
        name: string;
        type: string;
        documentCount: number;
      }>;
    };
    relationships: {
      total: number;
      byType: Record<string, number>;
    };
    chunks: {
      total: number;
      averagePerDocument: number;
    };
    storage: {
      databasePath: string;
      lastUpdated: string;
    };
  };
  error?: string;
}
