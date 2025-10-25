// AST Node Type Interfaces for Entity Extraction

export interface BaseASTNode {
  type: string;
  loc?: {
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  [key: string]: unknown;
}

export type ASTNode = BaseASTNode;

export interface NamedASTNode extends BaseASTNode {
  id?: { name?: string; typeAnnotation?: unknown };
  name?: string;
}

export interface ImportDeclarationNode extends BaseASTNode {
  type: "ImportDeclaration";
  source?: { value?: string };
  specifiers?: Array<{
    imported?: { name?: string };
    local?: { name?: string };
  }>;
}

export interface ExportDefaultDeclarationNode extends BaseASTNode {
  type: "ExportDefaultDeclaration";
  declaration?: NamedASTNode;
}

export interface ExportNamedDeclarationNode extends BaseASTNode {
  type: "ExportNamedDeclaration";
  declaration?: {
    declarations?: Array<{ id?: { name?: string } }>;
    id?: { name?: string };
  };
  specifiers?: Array<{ exported?: { name?: string } }>;
  source?: { value?: string };
}

export interface FunctionNode extends NamedASTNode {
  params?: ParameterNode[];
  returnType?: TypeAnnotationNode;
}

export interface VariableDeclaratorNode extends NamedASTNode {
  init?: {
    type?: string;
    params?: ParameterNode[];
    returnType?: TypeAnnotationNode;
    value?: unknown;
  };
}

export interface JSXElementNode extends BaseASTNode {
  openingElement?: {
    name?: { name?: string };
    attributes?: Array<{
      type?: string;
      name?: { name?: string };
    }>;
  };
}

export interface CallExpressionNode extends BaseASTNode {
  type: "CallExpression";
  callee?: CalleeNode;
  arguments?: Array<{ type?: string; value?: unknown }>;
}

export interface CalleeNode extends BaseASTNode {
  name?: string;
  object?: CalleeNode;
  property?: { name?: string };
}

export interface ParameterNode extends BaseASTNode {
  name?: string;
  typeAnnotation?: TypeAnnotationNode;
}

export interface TypeAnnotationNode {
  type?: string;
  typeAnnotation?: TypeAnnotationNode;
  typeName?: { name?: string };
}
