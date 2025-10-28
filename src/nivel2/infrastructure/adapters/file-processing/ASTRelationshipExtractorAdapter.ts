/**
 * @fileoverview AST relationship extractor adapter
 * @module nivel2/infrastructure/adapters/file-processing
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RelationshipExtractorPort, RelationshipExtractionResult } from '../../../../domains/file-processing/ports/RelationshipExtractorPort';
import type { GraphStorePort } from '../../../../domains/graph/ports/indexing-port';
import { ASTRelationshipExtractor } from '../../services/ast-relationship-extractor';

/**
 * Adapter for extracting AST relationships
 */
export class ASTRelationshipExtractorAdapter implements RelationshipExtractorPort {
  private readonly extractor: ASTRelationshipExtractor;
  private readonly graphStore: GraphStorePort;

  constructor(
    workspaceRoot: string,
    graphStore: GraphStorePort
  ) {
    this.graphStore = graphStore;
    this.extractor = new ASTRelationshipExtractor(workspaceRoot);
  }

  async extractRelationships(filePath: string, content: string): Promise<RelationshipExtractionResult> {
    let tempFilePath: string | null = null;
    
    try {
      // Create temporary file for AST extraction
      const os = await import('os');
      const tempDir = os.tmpdir();
      const fileName = path.basename(filePath);
      tempFilePath = path.join(tempDir, `cappy-ast-${Date.now()}-${fileName}`);
      
      console.log(`🕸️ Extracting AST relationships for ${filePath}...`);
      fs.writeFileSync(tempFilePath, content);
      
      // Use the extract method which takes chunks (we can pass empty array)
      const relationships = await this.extractor.extract(tempFilePath, []);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
      
      // Save relationships to graph store
      let nodesCount = 0;
      let relationshipsCount = 0;
      
      if (relationships.length > 0) {
        console.log(`   Found ${relationships.length} AST relationships`);
        
        // Convert to format expected by createRelationships
        const graphRels = relationships.map(rel => ({
          from: rel.from,
          to: rel.to,
          type: rel.type,
          properties: rel.properties
        }));
        
        await this.graphStore.createRelationships(graphRels);
        relationshipsCount = relationships.length;
        
        // Count unique nodes
        const uniqueNodes = new Set<string>();
        for (const rel of relationships) {
          uniqueNodes.add(rel.from);
          uniqueNodes.add(rel.to);
        }
        nodesCount = uniqueNodes.size;
        
        console.log(`   ✓ Saved ${relationshipsCount} relationships (${nodesCount} nodes)`);
      }
      
      return { nodesCount, relationshipsCount };
      
    } catch (error) {
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      console.warn(`⚠️ Failed to extract AST relationships:`, error);
      return { nodesCount: 0, relationshipsCount: 0 };
    }
  }
}
