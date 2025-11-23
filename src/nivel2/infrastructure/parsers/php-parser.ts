/**
 * @fileoverview PHP parser for extracting PHPDoc and code structure
 * @module adapters/secondary/parsers/php-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../shared/types/chunk';
import * as fs from 'fs';

/**
 * PHP dynamic include/require
 */
export interface PHPDynamicImport {
  type: 'require' | 'require_once' | 'include' | 'include_once';
  path: string;
  isDynamic: boolean;
  lineNumber: number;
}

/**
 * Complete PHP AST-like structure
 */
export interface PHPAnalysis {
  namespace?: string;
  uses: Array<{ alias: string; fullName: string; lineNumber: number }>;
  dynamicImports: PHPDynamicImport[];
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
  phpdocStartLine?: number;
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
  phpdocStartLine?: number;
  phpdoc?: string;
  methods: PHPMethod[];
}

export interface PHPTrait {
  name: string;
  namespace?: string;
  fullName: string;
  lineStart: number;
  lineEnd: number;
  phpdocStartLine?: number;
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
  phpdocStartLine?: number;
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
  phpdocStartLine?: number;
  phpdoc?: string;
}

export interface PHPFunction {
  name: string;
  parameters: PHPParameter[];
  returnType?: string;
  lineStart: number;
  lineEnd: number;
  phpdocStartLine?: number;
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
  phpdocStartLine?: number;
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
        dynamicImports: [],
        classes: [],
        interfaces: [],
        traits: [],
        functions: [],
        constants: []
      };

      let currentNamespace: string | undefined;
  let currentPHPDoc: string | null = null;
  let currentPHPDocStartLine: number | undefined;
  let phpdocComplete = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Handle inline PHPDoc on the same line as declarations: '<?php /** ... */ class X {}'
        let code = trimmed;
        // Remove leading PHP open tag if present
        if (code.startsWith('<?php')) {
          code = code.replace(/^<\?php\s*/, '');
        }
        if (trimmed.includes('/**') && trimmed.includes('*/')) {
          const start = line.indexOf('/**');
          const end = line.indexOf('*/', start);
          if (start !== -1 && end !== -1) {
            currentPHPDoc = line.slice(start, end + 2);
            currentPHPDocStartLine = i + 1;
            phpdocComplete = true;
            // Remove the phpdoc portion to allow matching declarations on the same line
            const withoutDoc = line.slice(0, start) + line.slice(end + 2);
            code = withoutDoc.replace(/^<\?php\s*/, '').trim();
          }
        }

        // Detect PHPDoc start
        if (trimmed.startsWith('/**')) {
          currentPHPDoc = line;
          currentPHPDocStartLine = i + 1;
          // Handle single-line PHPDoc /** ... */
          phpdocComplete = trimmed.includes('*/');
          if (!phpdocComplete) {
            // We'll accumulate until we hit the end */
          }
          continue;
        }

        // Accumulate PHPDoc lines until end
        if (currentPHPDoc !== null && !phpdocComplete) {
          currentPHPDoc += '\n' + line;
          if (trimmed.endsWith('*/')) {
            phpdocComplete = true; // Mark ready for next declaration
          }
          continue;
        }

        // Namespace declaration
        const namespaceMatch = code.match(/^namespace\s+([\w\\]+);/);
        if (namespaceMatch) {
          currentNamespace = namespaceMatch[1];
          continue;
        }

        // Use statement
        const useMatch = code.match(/^use\s+([\w\\]+)(?:\s+as\s+(\w+))?;/);
        if (useMatch) {
          const fullName = useMatch[1];
          const alias = useMatch[2] || fullName.split('\\').pop() || fullName;
          analysis.uses.push({ alias, fullName, lineNumber: i + 1 });
          continue;
        }

        // Dynamic imports: require, require_once, include, include_once
        const dynamicImport = this.extractDynamicImport(code, i + 1);
        if (dynamicImport) {
          analysis.dynamicImports.push(dynamicImport);
          continue;
        }

        // Class declaration
        const classMatch = code.match(/^(abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+([\w\\]+))?(?:\s+implements\s+([\w\\,\s]+))?/);
        if (classMatch) {
          const classObj = this.parseClass(lines, i, currentNamespace, currentPHPDoc, currentPHPDocStartLine);
          analysis.classes.push(classObj);
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          i = classObj.lineEnd - 1;
          continue;
        }

        // Interface declaration
        const interfaceMatch = code.match(/^interface\s+(\w+)(?:\s+extends\s+([\w\\,\s]+))?/);
        if (interfaceMatch) {
          const interfaceObj = this.parseInterface(lines, i, currentNamespace, currentPHPDoc, currentPHPDocStartLine);
          analysis.interfaces.push(interfaceObj);
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          i = interfaceObj.lineEnd - 1;
          continue;
        }

        // Trait declaration
        const traitMatch = code.match(/^trait\s+(\w+)/);
        if (traitMatch) {
          const traitObj = this.parseTrait(lines, i, currentNamespace, currentPHPDoc, currentPHPDocStartLine);
          analysis.traits.push(traitObj);
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          i = traitObj.lineEnd - 1;
          continue;
        }

        // Global function declaration
        const functionMatch = code.match(/^function\s+(\w+)\s*\(/);
        if (functionMatch) {
          const funcObj = this.parseFunction(lines, i, currentPHPDoc, currentPHPDocStartLine);
          analysis.functions.push(funcObj);
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          i = funcObj.lineEnd - 1;
          continue;
        }

        // Global constant
        const defineMatch = code.match(/^define\s*\(\s*['"](\w+)['"]/);
        if (defineMatch) {
          analysis.constants.push({
            name: defineMatch[1],
            lineNumber: i + 1,
            phpdoc: currentPHPDoc || undefined,
            phpdocStartLine: currentPHPDocStartLine
          });
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          continue;
        }

        // Global constant using const keyword
        const globalConstMatch = code.match(/^const\s+(\w+)\s*=\s*.+;/);
        if (globalConstMatch) {
          analysis.constants.push({
            name: globalConstMatch[1],
            lineNumber: i + 1,
            phpdoc: currentPHPDoc || undefined,
            phpdocStartLine: currentPHPDocStartLine
          });
          currentPHPDoc = null;
          currentPHPDocStartLine = undefined;
          phpdocComplete = false;
          continue;
        }
      }

      console.log(`🐘 PHP: Analyzed ${filePath} - ${analysis.classes.length} classes, ${analysis.interfaces.length} interfaces, ${analysis.traits.length} traits, ${analysis.functions.length} functions`);
      
      return analysis;
    } catch (error) {
      console.error(`❌ PHP parser error for ${filePath}:`, error);
      return {
        uses: [],
        dynamicImports: [],
        classes: [],
        interfaces: [],
        traits: [],
        functions: [],
        constants: []
      };
    }
  }

  private parseClass(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null, phpdocStartLine?: number): PHPClass {
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
  let memberPHPDocStartLine: number | undefined;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      // Collect PHPDoc for members
      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        memberPHPDocStartLine = i + 1;
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
          phpdocStartLine: memberPHPDocStartLine,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
        continue;
      }

      // Method
      const methodMatch = trimmed.match(/^(abstract\s+|final\s+)?(public|private|protected)\s+(static\s+)?function\s+(\w+)\s*\(/);
      if (methodMatch) {
        const methodObj = this.parseMethod(lines, i, memberPHPDoc, memberPHPDocStartLine);
        methods.push(methodObj);
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
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
          phpdocStartLine: memberPHPDocStartLine,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
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
      phpdocStartLine: phpdocStartLine,
      phpdoc: phpdoc || undefined,
      properties,
      methods,
      constants
    };
  }

  private parseInterface(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null, phpdocStartLine?: number): PHPInterface {
    const line = lines[startIndex].trim();
    const interfaceMatch = line.match(/^interface\s+(\w+)(?:\s+extends\s+([\w\\,\s]+))?/);
    
    const name = interfaceMatch![1];
    const extendsList = interfaceMatch![2]?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const fullName = namespace ? `${namespace}\\${name}` : name;
    const lineEnd = this.findBlockEnd(lines, startIndex);

    const methods: PHPMethod[] = [];
  let memberPHPDoc: string | null = null;
  let memberPHPDocStartLine: number | undefined;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        memberPHPDocStartLine = i + 1;
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
        const methodObj = this.parseMethod(lines, i, memberPHPDoc, memberPHPDocStartLine);
        methods.push(methodObj);
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
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
      phpdocStartLine: phpdocStartLine,
      phpdoc: phpdoc || undefined,
      methods
    };
  }

  private parseTrait(lines: string[], startIndex: number, namespace: string | undefined, phpdoc: string | null, phpdocStartLine?: number): PHPTrait {
    const line = lines[startIndex].trim();
    const traitMatch = line.match(/^trait\s+(\w+)/);
    
    const name = traitMatch![1];
    const fullName = namespace ? `${namespace}\\${name}` : name;
    const lineEnd = this.findBlockEnd(lines, startIndex);

    const properties: PHPProperty[] = [];
    const methods: PHPMethod[] = [];
  let memberPHPDoc: string | null = null;
  let memberPHPDocStartLine: number | undefined;

    for (let i = startIndex + 1; i < lineEnd; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.startsWith('/**')) {
        memberPHPDoc = lines[i];
        memberPHPDocStartLine = i + 1;
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
          phpdocStartLine: memberPHPDocStartLine,
          phpdoc: memberPHPDoc || undefined
        });
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
        continue;
      }

      const methodMatch = trimmed.match(/^(public|private|protected)\s+(static\s+)?function\s+(\w+)\s*\(/);
      if (methodMatch) {
        const methodObj = this.parseMethod(lines, i, memberPHPDoc, memberPHPDocStartLine);
        methods.push(methodObj);
        memberPHPDoc = null;
        memberPHPDocStartLine = undefined;
        i = methodObj.lineEnd - 1;
      }
    }

    return {
      name,
      namespace,
      fullName,
      lineStart: startIndex + 1,
      lineEnd,
      phpdocStartLine: phpdocStartLine,
      phpdoc: phpdoc || undefined,
      properties,
      methods
    };
  }

  private parseMethod(lines: string[], startIndex: number, phpdoc: string | null, phpdocStartLine?: number): PHPMethod {
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
      phpdocStartLine: phpdocStartLine,
      phpdoc: phpdoc || undefined
    };
  }

  private parseFunction(lines: string[], startIndex: number, phpdoc: string | null, phpdocStartLine?: number): PHPFunction {
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
      phpdocStartLine: phpdocStartLine,
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
            id: this.generateChunkId(filePath, cls.phpdocStartLine ?? cls.lineStart, cls.lineEnd),
            content: cls.phpdoc,
            metadata: {
              filePath,
              lineStart: cls.phpdocStartLine ?? cls.lineStart,
              lineEnd: cls.lineEnd,
              chunkType: 'phpdoc',
              symbolName: cls.name,
              symbolKind: 'class',
              visibility: 'public'
            }
          });
        }

        // Properties (emit before methods to match test expectations)
        for (const prop of cls.properties) {
          if (prop.phpdoc) {
            chunks.push({
              id: this.generateChunkId(filePath, prop.phpdocStartLine ?? prop.lineNumber, prop.lineNumber),
              content: prop.phpdoc,
              metadata: {
                filePath,
                lineStart: prop.phpdocStartLine ?? prop.lineNumber,
                lineEnd: prop.lineNumber,
                chunkType: 'phpdoc',
                symbolName: prop.name,
                symbolKind: 'property',
                visibility: prop.visibility
              }
            });
          }
        }

        // Methods
        for (const method of cls.methods) {
          if (method.phpdoc) {
            chunks.push({
              id: this.generateChunkId(filePath, method.phpdocStartLine ?? method.lineStart, method.lineEnd),
              content: method.phpdoc,
              metadata: {
                filePath,
                lineStart: method.phpdocStartLine ?? method.lineStart,
                lineEnd: method.lineEnd,
                chunkType: 'phpdoc',
                symbolName: method.name,
                symbolKind: 'method',
                visibility: method.visibility
              }
            });
          }
        }

        // Class constants
        for (const c of cls.constants) {
          if (c.phpdoc) {
            chunks.push({
              id: this.generateChunkId(filePath, c.phpdocStartLine ?? c.lineNumber, c.lineNumber),
              content: c.phpdoc,
              metadata: {
                filePath,
                lineStart: c.phpdocStartLine ?? c.lineNumber,
                lineEnd: c.lineNumber,
                chunkType: 'phpdoc',
                symbolName: c.name,
                symbolKind: 'constant',
                visibility: c.visibility ?? 'public'
              }
            });
          }
        }
      }

      // Interfaces
      for (const iface of analysis.interfaces) {
        if (iface.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, iface.phpdocStartLine ?? iface.lineStart, iface.lineEnd),
            content: iface.phpdoc,
            metadata: {
              filePath,
              lineStart: iface.phpdocStartLine ?? iface.lineStart,
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
            id: this.generateChunkId(filePath, trait.phpdocStartLine ?? trait.lineStart, trait.lineEnd),
            content: trait.phpdoc,
            metadata: {
              filePath,
              lineStart: trait.phpdocStartLine ?? trait.lineStart,
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
            id: this.generateChunkId(filePath, func.phpdocStartLine ?? func.lineStart, func.lineEnd),
            content: func.phpdoc,
            metadata: {
              filePath,
              lineStart: func.phpdocStartLine ?? func.lineStart,
              lineEnd: func.lineEnd,
              chunkType: 'phpdoc',
              symbolName: func.name,
              symbolKind: 'function'
            }
          });
        }
      }

      // Global constants
      for (const c of analysis.constants) {
        if (c.phpdoc) {
          chunks.push({
            id: this.generateChunkId(filePath, c.phpdocStartLine ?? c.lineNumber, c.lineNumber),
            content: c.phpdoc,
            metadata: {
              filePath,
              lineStart: c.phpdocStartLine ?? c.lineNumber,
              lineEnd: c.lineNumber,
              chunkType: 'phpdoc',
              symbolName: c.name,
              symbolKind: 'constant'
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

  /**
   * Extract dynamic imports from PHP code
   * Detects: require('path'), require_once('path'), include('path'), include_once('path')
   */
  private extractDynamicImport(line: string, lineNumber: number): PHPDynamicImport | null {
    // Match require/include with string literals or simple concatenations
    const patterns = [
      // require('path') or require("path")
      /\b(require|require_once|include|include_once)\s*\(\s*['"]([^'"]+)['"]\s*\)/,
      // require __DIR__ . '/path'
      /\b(require|require_once|include|include_once)\s+__DIR__\s*\.\s*['"]([^'"]+)['"]/,
      // require dirname(__FILE__) . '/path'
      /\b(require|require_once|include|include_once)\s+dirname\(__FILE__\)\s*\.\s*['"]([^'"]+)['"]/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const type = match[1].toLowerCase() as 'require' | 'require_once' | 'include' | 'include_once';
        const path = match[2];
        
        // Check if path contains variables (dynamic)
        const isDynamic = path.includes('$') || line.includes('$');

        return {
          type,
          path,
          isDynamic,
          lineNumber
        };
      }
    }

    // Detect dynamic requires with variables
    const dynamicPattern = /\b(require|require_once|include|include_once)\s*\([^)]*\$[^)]*\)/;
    const dynamicMatch = line.match(dynamicPattern);
    if (dynamicMatch) {
      return {
        type: dynamicMatch[1].toLowerCase() as 'require' | 'require_once' | 'include' | 'include_once',
        path: '*', // Unknown path
        isDynamic: true,
        lineNumber
      };
    }

    return null;
  }
}

/**
 * Factory function to create PHP parser
 */
export function createPHPParser(): PHPParser {
  return new PHPParser();
}
