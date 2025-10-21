# PDF Parser Implementation

## 📄 Overview

Implementação completa do suporte para arquivos PDF no `DocumentEnhancedParser`.

## ✅ What was implemented

### 1. Dependencies installed
- `pdf-parse`: Biblioteca para extrair texto de arquivos PDF
- `@types/pdf-parse`: Definições TypeScript para pdf-parse

### 2. PDF Parser Method

O método `parsePDF()` foi completamente implementado com as seguintes funcionalidades:

#### Features:
- ✅ Extração de texto de arquivos PDF
- ✅ Suporte para PDFs multi-página
- ✅ Extração de metadados do PDF (título, autor, data de criação, etc.)
- ✅ Chunking com overlap (sliding window)
- ✅ Extração de entidades automaticamente
- ✅ Tratamento de erros específicos:
  - PDFs protegidos por senha
  - PDFs corrompidos ou inválidos
  - Arquivos vazios

#### Metadata Extracted:
```typescript
{
  pdfPages: number,
  pdfInfo: {
    title: string,
    author: string,
    subject: string,
    creator: string,
    producer: string,
    creationDate: string,
    modDate: string
  }
}
```

### 3. Dynamic Import Strategy

Utilizado import dinâmico para lidar com módulos CommonJS:
```typescript
const pdfParseModule = await import('pdf-parse');
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
```

### 4. Error Handling

- Detecção de PDFs protegidos por senha
- Detecção de PDFs corrompidos
- Logs informativos e detalhados
- Fallback gracioso em caso de erro

## 🚀 Usage

```typescript
import { createDocumentEnhancedParser } from './adapters/secondary/parsers/document-enhanced-parser';

const parser = createDocumentEnhancedParser();

// Parse PDF with entity extraction
const chunks = await parser.parseFile('document.pdf', true);

// Parse PDF without entity extraction
const chunksNoEntities = await parser.parseFile('document.pdf', false);
```

## 📊 Output Example

```typescript
[
  {
    id: 'chunk:document.pdf:0:1-34',
    content: 'Extracted text from PDF...',
    metadata: {
      filePath: '/path/to/document.pdf',
      lineStart: 1,
      lineEnd: 34,
      chunkType: 'document_section',
      chunkNumber: 0,
      hasOverlap: false,
      overlapTokens: 0,
      pdfPages: 10,
      pdfInfo: {
        title: 'Sample Document',
        author: 'John Doe',
        subject: 'Technical Documentation',
        creator: 'Microsoft Word',
        producer: 'Adobe PDF Library',
        creationDate: '2024-01-15',
        modDate: '2024-01-20'
      },
      entities: ['EntityA', 'EntityB'],
      entityTypes: {
        'EntityA': 'class',
        'EntityB': 'function'
      },
      relationships: [...],
      extractedAt: '2025-10-21T...',
      extractionModel: 'gpt-4o-mini'
    }
  }
]
```

## 🧪 Testing

Um script de teste foi criado em `test-pdf-parser.ts`:

```bash
npx ts-node test-pdf-parser.ts
```

## 📝 Supported Extensions

O parser agora suporta completamente:
- ✅ `.md` - Markdown
- ✅ `.mdx` - MDX
- ✅ `.pdf` - PDF ⭐ NEW!
- ✅ `.doc` - Word (limited support)
- ✅ `.docx` - Word

## 🔧 Configuration

O parser utiliza as seguintes configurações padrão:
- **maxTokens**: 512 tokens por chunk
- **overlapTokens**: 100 tokens de overlap entre chunks
- **tokensPerLine**: ~15 tokens (estimativa)

## ⚠️ Known Limitations

1. PDFs protegidos por senha não podem ser processados
2. PDFs escaneados (imagens) requerem OCR adicional
3. Tabelas complexas podem ter formatação alterada
4. Imagens incorporadas não são extraídas

## 🎯 Next Steps

Possíveis melhorias futuras:
- [ ] Suporte para OCR em PDFs escaneados
- [ ] Extração de imagens e tabelas
- [ ] Melhor preservação de formatação
- [ ] Cache de PDFs processados
- [ ] Suporte para PDFs protegidos (com senha fornecida)

## 📦 Dependencies

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

## ✅ Build Status

✓ Compilação bem-sucedida
✓ Sem erros de TypeScript
✓ Sem warnings de lint
