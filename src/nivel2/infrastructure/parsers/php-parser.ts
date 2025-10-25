/**
 * @fileoverview PHP parser for extracting PHPDoc and code structure
 * @module adapters/secondary/parsers/php-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../shared/types/chunk';
import * as fs from 'fs';

/**
 * Complete PHP AST-like structure
 */
export interface PHPAnalysis {
  namespace?: string;
  uses: Array<{ alias: string; fullName: string; lineNumber: number }>;
  classes: PHPClass[];
  interfaces: PHPInterface[];
  traits: PHPTrait[];
  functions: PHPFunction[];
  constants: PHPConstant[];
}

export interface PHPClass {
  name: string;
  namespace?: string;
  fullName: string;
  extends?: string;
  implements: string[];
  isAbstract: boolean;
  isFinal: boolean;
  lineStart: number;
  lineEnd: number;
  phpdoc?: string;
  properties: PHPProperty[];
  methods: PHPMethod[];
  constants: PHPConstant[];
}

export interface PHPInterface {
  name: string;
  namespace?: string;
  fullName: string;
  extends: string[];
  lineStart: number;
  lineEnd: number;
  phpdoc?: string;
  methods: PHPMethod[];
}

export interface PHPTrait {
  name: string;
  namespace?: string;
  fullName: string;
  lineStart: number;
  lineEnd: number;
  phpdoc?: string;
  properties: PHPProperty[];
  methods: PHPMethod[];
}

export interface PHPMethod {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAbstract: boolean;
  isFinal: boolean;
  parameters: PHPParameter[];
  returnType?: string;
  lineStart: number;
  lineEnd: number;
  phpdoc?: string;
}

export interface PHPProperty {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
  type?: string;
  defaultValue?: string;
  lineNumber: number;
  phpdoc?: string;
}

export interface PHPFunction {
  name: string;
  parameters: PHPParameter[];
  returnType?: string;
  lineStart: number;
  lineEnd: number;
  phpdoc?: string;
}

export interface PHPParameter {
  name: string;
  type?: string;
  defaultValue?: string;
  isVariadic: boolean;
  isReference: boolean;
}

export interface PHPConstant {
  name: string;
  value?: string;
  visibility?: 'public' | 'private' | 'protected';
  lineNumber: number;
  phpdoc?: string;
}

/**
 * PHP parser using regex patterns for structure extraction
 */
export class PHPParser {
  /**
   * Analyzes a PHP file and returns complete structure
   */
  async analyze(filePath: string): Promise<PHPAnalysis> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const analysis: PHPAnalysis = {
        uses: [],
        classes: [],
        interfaces: [],
        traits: [],
        functions: [],
        constants: []
      };

      let currentNamespace: string | undefined;
      let currentPHPDoc: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect PHPDoc start
        if (trimmed.startsWith('/**')) {
          currentPHPDoc = line;
          continue;
        }

        // Accumulate PHPDoc lines
        if (currentPHPDoc !== null && !trimmed.endsWith('*/')) {
          currentPHPDoc += '\n' + line;
          continue;
        }

        // Detect PHPDoc end
        if (currentPHPDoc !== null && trimmed.endsWith('*/')) {
          currentPHPDoc += '\n' + line;
          // PHPDoc ready, will be attached to next declaration
          continue;
        }

        // Namespace declaration
        const namespaceMatch = trimmed.match(/^namespace\s+([\w\\]+);/);
        if (namespaceMatch) {
          currentNamespace = namespaceMatch[1];
          continue;
        }

        // Use statement
        const useMatch = trimmed.match(/^use\s+([\w\\]+)(?:\s+as\s+(\w+))?;/);
        if (useMatch) {
          const fullName = useMatch[1];
          const alias = useMatch[2] || fullName.split('\\').pop() || fullName;
          analysis.uses.push({ alias, fullName, lineNumber: i + 1 });
          continue;
        }

        // Class declaration
        const classMatch = trimmed.match(/^(abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+([\w\\]+))?(?:\s+implements\s+([\w\\,\s]+))?/);
        if (classMatch) {
          const classObj = this.parseClass(lines, i, currentNamespace, currentPHPDoc);
          analysis.classes.push(classObj);
          currentPHPDoc = null;
          i = classObj.lineEnd - 1;
          continue;
        }

        // Interface declaration
        const interfaceMatch = trimmed.match(/^interface\s+(\w+)(?:\s+extends\s+([\w\\,\s]+))?/);
        if (interfaceMatch) {
          const interfaceObj = this.parseInterface(lines, i, currentNamespace, currentPHPDoc);
          analysis.interfaces.push(interfaceObj);
          currentPHPDoc = null;
          i = interfaceObj.lineEnd - 1;
          continue;
        }

        // Trait declaration
        const traitMatch = trimmed.match(/^trait\s+(\w+)/);
        if (traitMatch) {
          const traitObj = this.parseTrait(lines, i, currentNamespace, currentPHPDoc);
          analysis.traits.push(traitObj);
          currentPHPDoc = null;
          i = traitObj.lineEnd - 1;
          continue;
        }

        // Global function declaration
        const functionMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
        if (functionMatch) {
          const funcObj = this.parseFunction(lines, i, currentPHPDoc);
          analysis.functions.push(funcObj);
          currentPHPDoc = null;
          i = funcObj.lineEnd - 1;
          continue;
        }

        // Global constant
        const defineMatch = trimmed.match(/^define\s*\(\s*['"](\w+)['"]/);
        if (defineMatch) {
          analysis.constants.push({
            name: defineMatch[1],
            lineNumber: i + 1,
            phpdoc: currentPHPDoc || undefined
          });
          currentPHPDoc = null;
          continue;
        }
      }

      console.log(`🐘 PHP: Analyzed ${filePath} - ${analysis.classes.length} classes, ${analysis.interfaces.length} interfaces, ${analysis.traits.length} traits, ${analysis.functions.length} functions`);
      
      return analysis;
    } catch (error) {
      console.error(`❌ PHP parser error for ${filePath}:`, error);
      return {
        uses: [],
        classes: [],
        interfaces: [],
        traits: [],
        functions: [],
        constants: []
      };
    }
  }

  private parseClass(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null): PHPClass {
    const line = lines[startIndex].trim();
    const classMatch = line.match(/^(abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+([\w\\]+))?(?:\s+implements\s+([\w\\,\s]+))?/);
    
    const name = classMatch![2];
    const isAbstract = !!classMatch![1]?.includes('abstract');
    const isFinal = !!classMatch![1]?.includes('final');
    const extendsClass = classMatch![3];
    const implementsList = classMatch![4]?.split(',').map(s => s.trim()).filter(Boolean) || [];

    const fullName = namespace ? `${namespace}\\${name}` : name;
    const lineEnd = this.findBlockEnd(lines, startIndex);

    const properties: PHPProperty[] = [];
    const methods: PHPMethod[] = [];
    const constants: PHPConstant[] = [];

    let memberPHPDoc: string | null = null;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      // Collect PHPDoc for members
      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        for (let j = i + 1; j < lineEnd; j++) {
          memberPHPDoc += '\n' + lines[j];
          if (lines[j].trim().endsWith('*/')) {
            i = j;
            break;
          }
        }
        continue;
      }

      // Property
      const propMatch = trimmed.match(/^(public|private|protected)\s+(static\s+)?(readonly\s+)?(\S+\s+)?\$(\w+)/);
      if (propMatch) {
        const defaultMatch = trimmed.match(/=\s*(.+);/);
        properties.push({
          name: propMatch[5],
          visibility: propMatch[1] as 'public' | 'private' | 'protected',
          isStatic: !!propMatch[2],
          isReadonly: !!propMatch[3],
          type: propMatch[4]?.trim(),
          defaultValue: defaultMatch?.[1]?.trim(),
          lineNumber: i + 1,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        continue;
      }

      // Method
      const methodMatch = trimmed.match(/^(abstract\s+|final\s+)?(public|private|protected)\s+(static\s+)?function\s+(\w+)\s*\(/);
      if (methodMatch) {
        const methodObj = this.parseMethod(lines, i, memberPHPDoc);
        methods.push(methodObj);
        memberPHPDoc = null;
        i = methodObj.lineEnd - 1;
        continue;
      }

      // Constant
      const constMatch = trimmed.match(/^(public|private|protected)?\s*const\s+(\w+)\s*=\s*(.+);/);
      if (constMatch) {
        constants.push({
          name: constMatch[2],
          value: constMatch[3],
          visibility: constMatch[1] as 'public' | 'private' | 'protected' | undefined,
          lineNumber: i + 1,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        continue;
      }
    }

    return {
      name,
      namespace,
      fullName,
      extends: extendsClass,
      implements: implementsList,
      isAbstract,
      isFinal,
      lineStart: startIndex + 1,
      lineEnd,
      phpdoc: phpdoc || undefined,
      properties,
      methods,
      constants
    };
  }

  private parseInterface(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null): PHPInterface {
    const line = lines[startIndex].trim();
    const interfaceMatch = line.match(/^interface\s+(\w+)(?:\s+extends\s+([\w\\,\s]+))?/);
    
    const name = interfaceMatch![1];
    const extendsList = interfaceMatch![2]?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const fullName = namespace ? `${namespace}\\${name}` : name;
    const lineEnd = this.findBlockEnd(lines, startIndex);

    const methods: PHPMethod[] = [];
    let memberPHPDoc: string | null = null;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        for (let j = i + 1; j < lineEnd; j++) {
          memberPHPDoc += '\n' + lines[j];
          if (lines[j].trim().endsWith('*/')) {
            i = j;
            break;
          }
        }
        continue;
      }

      const methodMatch = trimmed.match(/^public\s+function\s+(\w+)\s*\(/);
      if (methodMatch) {
        const methodObj = this.parseMethod(lines, i, memberPHPDoc);
        methods.push(methodObj);
        memberPHPDoc = null;
        i = methodObj.lineEnd - 1;
      }
    }

    return {
      name,
      namespace,
      fullName,
      extends: extendsList,
      lineStart: startIndex + 1,
      lineEnd,
      phpdoc: phpdoc || undefined,
      methods
    };
  }

  private parseTrait(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null): PHPTrait {
    const line = lines[startIndex].trim();
    const traitMatch = line.match(/^trait\s+(\w+)/);
    
    const name = traitMatch![1];
    const fullName = namespace ? `${namespace}\\${name}` : name;
    const lineEnd = this.findBlockEnd(lines, startIndex);

    const properties: PHPProperty[] = [];
    const methods: PHPMethod[] = [];
    let memberPHPDoc: string | null = null;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        for (let j = i + 1; j < lineEnd; j++) {
          memberPHPDoc += '\n' + lines[j];
          if (lines[j].trim().endsWith('*/')) {
            i = j;
            break;
          }
        }
        continue;
      }

      const propMatch = trimmed.match(/^(public|private|protected)\s+(static\s+)?(readonly\s+)?(\S+\s+)?\$(\w+)/);
      if (propMatch) {
        properties.push({
          name: propMatch[5],
          visibility: propMatch[1] as 'public' | 'private' | 'protected',
          isStatic: !!propMatch[2],
          isReadonly: !!propMatch[3],
          type: propMatch[4]?.trim(),
          lineNumber: i + 1,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        continue;
      }

      const methodMatch = trimmed.match(/^(public|private|protected)\s+(static\s+)?function\s+(\w+)\s*\(/);
      if (methodMatch) {
        const methodObj = this.parseMethod(lines, i, memberPHPDoc);
        methods.push(methodObj);
        memberPHPDoc = null;
        i = methodObj.lineEnd - 1;
      }
    }

    return {
      name,
      namespace,
      fullName,
      lineStart: startIndex + 1,
      lineEnd,
      phpdoc: phpdoc || undefined,
      properties,
      methods
    };
  }

  private parseMethod(lines: string[], startIndex: number, phpdoc: string | null): PHPMethod {
    const line = lines[startIndex].trim();
    const methodMatch = line.match(/^(abstract\s+|final\s+)?(public|private|protected)\s+(static\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\??[\w\\|]+))?/);
    
    const name = methodMatch![4];
    const visibility = methodMatch![2] as 'public' | 'private' | 'protected';
    const isStatic = !!methodMatch![3];
    const isAbstract = !!methodMatch![1]?.includes('abstract');
    const isFinal = !!methodMatch![1]?.includes('final');
    const paramsStr = methodMatch![5] || '';
    const returnType = methodMatch![6];

    const parameters = this.parseParameters(paramsStr);
    const lineEnd = line.includes(';') ? startIndex + 1 : this.findBlockEnd(lines, startIndex);

    return {
      name,
      visibility,
      isStatic,
      isAbstract,
      isFinal,
      parameters,
      returnType,
      lineStart: startIndex + 1,
      lineEnd,
      phpdoc: phpdoc || undefined
    };
  }

  private parseFunction(lines: string[], startIndex: number, phpdoc: string | null): PHPFunction {
    const line = lines[startIndex].trim();
    const functionMatch = line.match(/^function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\??[\w\\|]+))?/);
    
    const name = functionMatch![1];
    const paramsStr = functionMatch![2] || '';
    const returnType = functionMatch![3];

    const parameters = this.parseParameters(paramsStr);
    const lineEnd = this.findBlockEnd(lines, startIndex);

    return {
      name,
      parameters,
      returnType,
      lineStart: startIndex + 1,
      lineEnd,
      phpdoc: phpdoc || undefined
    };
  }

  private parseParameters(paramsStr: string): PHPParameter[] {
    if (!paramsStr.trim()) return [];

    const params: PHPParameter[] = [];
    const parts = paramsStr.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const paramMatch = trimmed.match(/^(\??[\w\\|]+\s+)?(\.\.\.)?((&)?\$\w+)(?:\s*=\s*(.+))?/);
      if (paramMatch) {
        const type = paramMatch[1]?.trim();
        const isVariadic = !!paramMatch[2];
        const nameWithRef = paramMatch[3];
        const isReference = !!paramMatch[4];
        const name = nameWithRef.replace(/[&$]/g, '');
        const defaultValue = paramMatch[5];

        params.push({
          name,
          type,
          defaultValue,
          isVariadic,
          isReference
        });
      }
    }

    return params;
  }

  /**
   * Parses a PHP file and extracts PHPDoc chunks (legacy compatibility)
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const analysis = await this.analyze(filePath);
      const chunks: DocumentChunk[] = [];

      // Create chunks from classes
      for (const cls of analysis.classes) {
        if (cls.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, cls.lineStart, cls.lineEnd),
            content: cls.phpdoc,
            metadata: {
              filePath,
              lineStart: cls.lineStart,
              lineEnd: cls.lineEnd,
              chunkType: 'phpdoc',
              symbolName: cls.name,
              symbolKind: 'class',
              visibility: 'public'
            }
          });
        }

        // Methods
        for (const method of cls.methods) {
          if (method.phpdoc) {
            chunks.push({
              id: this.generateChunkId(filePath, method.lineStart, method.lineEnd),
              content: method.phpdoc,
              metadata: {
                filePath,
                lineStart: method.lineStart,
                lineEnd: method.lineEnd,
                chunkType: 'phpdoc',
                symbolName: method.name,
                symbolKind: 'method',
                visibility: method.visibility
              }
            });
          }
        }

        // Properties
        for (const prop of cls.properties) {
          if (prop.phpdoc) {
            chunks.push({
              id: this.generateChunkId(filePath, prop.lineNumber, prop.lineNumber),
              content: prop.phpdoc,
              metadata: {
                filePath,
                lineStart: prop.lineNumber,
                lineEnd: prop.lineNumber,
                chunkType: 'phpdoc',
                symbolName: prop.name,
                symbolKind: 'property',
                visibility: prop.visibility
              }
            });
          }
        }
      }

      // Interfaces
      for (const iface of analysis.interfaces) {
        if (iface.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, iface.lineStart, iface.lineEnd),
            content: iface.phpdoc,
            metadata: {
              filePath,
              lineStart: iface.lineStart,
              lineEnd: iface.lineEnd,
              chunkType: 'phpdoc',
              symbolName: iface.name,
              symbolKind: 'interface'
            }
          });
        }
      }

      // Traits
      for (const trait of analysis.traits) {
        if (trait.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, trait.lineStart, trait.lineEnd),
            content: trait.phpdoc,
            metadata: {
              filePath,
              lineStart: trait.lineStart,
              lineEnd: trait.lineEnd,
              chunkType: 'phpdoc',
              symbolName: trait.name,
              symbolKind: 'trait'
            }
          });
        }
      }

      // Functions
      for (const func of analysis.functions) {
        if (func.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, func.lineStart, func.lineEnd),
            content: func.phpdoc,
            metadata: {
              filePath,
              lineStart: func.lineStart,
              lineEnd: func.lineEnd,
              chunkType: 'phpdoc',
              symbolName: func.name,
              symbolKind: 'function'
            }
          });
        }
      }

      console.log(`🐘 PHP: Parsed ${chunks.length} PHPDoc chunks from ${filePath}`);
      return chunks;
    } catch (error) {
      console.error(`❌ PHP parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Finds the end of a code block (matching braces)
   */
  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }

      // For single-line declarations without braces
      if (!foundOpenBrace && line.trim().endsWith(';')) {
        return i + 1;
      }
    }

    return startIndex + 1;
  }

  /**
   * Generates a chunk ID
   */
  private generateChunkId(filePath: string, lineStart: number, lineEnd: number): string {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return `chunk:${fileName}:${lineStart}-${lineEnd}`;
  }
}

/**
 * Factory function to create PHP parser
 */
export function createPHPParser(): PHPParser {
  return new PHPParser();
}
