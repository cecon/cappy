import type { ExtractedEntity } from "../../../../../shared/types/entity";

/**
 * Category for AST entities
 */
export type ASTEntityCategory = "internal" | "external" | "builtin" | "jsx";

/**
 * AST Node kind (represents where the entity came from in the AST)
 */
export type ASTNodeKind = 
  | "import"
  | "export" 
  | "call"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "jsx";

/**
 * Enhanced entity with detailed metadata
 */
export interface ASTEntity extends ExtractedEntity {
  /** AST Node kind (where it came from in the syntax tree) */
  kind?: ASTNodeKind;

  /** Entity category */
  category: ASTEntityCategory;

  /** Source file or module */
  source: string;

  /** Line number in source */
  line: number;

  /** Column number in source */
  column: number;

  /** Whether this entity is exported */
  isExported?: boolean;

  /** Export type (for exported entities) */
  exportType?: "default" | "named" | "re-export";

  /** Whether this entity is imported (for JSX components) */
  isImported?: boolean;

  /** Original module for imported/re-exported entities */
  originalModule?: string;
}
