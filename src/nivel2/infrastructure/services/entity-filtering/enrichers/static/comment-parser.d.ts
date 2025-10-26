declare module 'comment-parser' {
  export interface Problem {
    code: string;
    message: string;
    line: number;
    critical: boolean;
  }

  export interface SourceLocation {
    number: number;
    source: string;
    tokens: {
      start: string;
      delimiter: string;
      postDelimiter: string;
      tag: string;
      postTag: string;
      name: string;
      postName: string;
      type: string;
      postType: string;
      description: string;
      end: string;
      lineEnd: string;
    };
  }

  export interface Tag {
    tag: string;
    name: string;
    type: string;
    optional: boolean;
    description: string;
    problems: Problem[];
    source: SourceLocation[];
  }

  export interface ParsedComment {
    description: string;
    tags: Tag[];
    source: SourceLocation[];
    problems: Problem[];
  }

  export interface ParseOptions {
    spacing?: 'compact' | 'preserve';
    tokenizers?: Array<(spec: Spec) => Spec>;
    fence?: string;
  }

  export interface Spec {
    tag: string;
    name: string;
    type: string;
    optional: boolean;
    description: string;
    problems: Problem[];
    source: SourceLocation[];
  }

  export function parse(source: string, options?: ParseOptions): ParsedComment[];
}
