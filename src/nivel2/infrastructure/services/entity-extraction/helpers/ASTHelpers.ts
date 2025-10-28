import type { ASTNode, ParameterNode, TypeAnnotationNode } from "../ast-types/ASTNodeTypes";

export class ASTHelpers {
  /**
   * Extract parameters from function
   */
  static extractParameters(
    params: ParameterNode[]
  ): Array<{ name: string; type?: string }> {
    if (!params) return [];

    return params.map((param) => ({
      name: param.name || "unknown",
      type: ASTHelpers.extractTypeAnnotation(param.typeAnnotation as ASTNode),
    }));
  }

  /**
   * Extract type annotation
   */
  static extractTypeAnnotation(typeAnnotation: ASTNode | undefined): string | undefined {
    if (!typeAnnotation) return undefined;

    const annotation = (typeAnnotation as TypeAnnotationNode).typeAnnotation || typeAnnotation;

    if (annotation.type === "TSStringKeyword") return "string";
    if (annotation.type === "TSNumberKeyword") return "number";
    if (annotation.type === "TSBooleanKeyword") return "boolean";
    if (annotation.type === "TSTypeReference" && (annotation as TypeAnnotationNode).typeName?.name) {
      return (annotation as TypeAnnotationNode).typeName?.name;
    }

    return "any";
  }

  /**
   * Extract initial value
   */
  static extractInitialValue(init: ASTNode | undefined): string | undefined {
    if (!init) return undefined;

    if (init.type === "Literal") return String((init as { value?: unknown }).value);
    if (init.type === "ArrowFunctionExpression") return "(arrow function)";
    if (init.type === "FunctionExpression") return "(function)";
    if (init.type === "CallExpression") return "(function call)";
    if (init.type === "ObjectExpression") return "(object)";
    if (init.type === "ArrayExpression") return "(array)";

    return undefined;
  }

  /**
   * Extract JSX props
   */
  static extractJSXProps(openingElement: ASTNode | undefined): string[] {
    if (!openingElement) return [];

    const element = openingElement as { attributes?: Array<{ type?: string; name?: { name?: string } }> };
    if (!element.attributes) return [];

    return element.attributes
      .filter((attr) => attr.type === "JSXAttribute" && attr.name?.name)
      .map((attr) => attr.name?.name as string);
  }

  /**
   * Extract call name
   */
  static extractCallName(callee: ASTNode | undefined): string | undefined {
    if (!callee) return undefined;

    if (callee.type === "Identifier") return (callee as { name?: string }).name;
    if (callee.type === "MemberExpression") {
      const memberExpr = callee as { object?: ASTNode; property?: { name?: string } };
      const object = ASTHelpers.extractCallName(memberExpr.object);
      const property = memberExpr.property?.name;
      return object && property ? `${object}.${property}` : property;
    }

    return undefined;
  }

  /**
   * Check if import is external
   */
  static isExternalImport(source: string): boolean {
    return !source.startsWith(".") && !source.startsWith("/");
  }

  /**
   * Extract entity name from node
   */
  static extractEntityName(node: ASTNode): string | undefined {
    if (!node) return undefined;

    const n = node as unknown;
    if (
      typeof n === "object" &&
      n !== null &&
      "id" in n &&
      typeof (n as any).id?.name === "string"
    ) {
      return (n as any).id.name;
    }
    if (typeof n === "object" && n !== null && "name" in n && typeof (n as any).name === "string") {
      return (n as any).name;
    }
    if (
      typeof n === "object" &&
      n !== null &&
      "key" in n &&
      typeof (n as any).key?.name === "string"
    ) {
      return (n as any).key.name;
    }

    return undefined;
  }

  /**
   * Check if node has type annotation
   */
  static hasTypeAnnotation(node: ASTNode): boolean {
    const n = node as any;
    return !!(
      n.typeAnnotation ||
      n.returnType ||
      n.id?.typeAnnotation
    );
  }
}
