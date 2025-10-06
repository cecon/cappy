# D3.js Graph Metadata Enrichment - Cappy Framework

## 📊 Visão Geral

Documento técnico para enriquecimento dos nós do grafo de conhecimento do Cappy usando **D3.js Force-Directed Graph** com metadados detalhados das entidades, relacionamentos, documentos e chunks.

---

## 🎯 Objetivo

Transformar o grafo atual de visualização simples em um grafo interativo e rico em informações, aproveitando todos os metadados disponíveis no sistema CappyRAG/LightRAG.

---

## 📦 Estrutura de Dados Atual

### Entity (Entidade)
```typescript
interface Entity {
    id: string;                    // UUID único
    name: string;                  // Nome legível
    type: string;                  // Person, Technology, Concept, etc.
    description: string;           // Descrição LLM
    properties: Record<string, any>; // Propriedades customizadas
    vector?: number[];             // Embedding 384d/1024d
    keyValuePairs?: KeyValuePair[]; // Pares para busca
    sourceDocuments: string[];     // IDs dos documentos fonte
    sourceChunks: string[];        // Chunks de origem
    confidence: number;            // Confiança (0-1)
    createdAt: string;             // ISO datetime
    updatedAt: string;             // ISO datetime
    mergedFrom?: string[];         // Entidades merged
}
```

### Relationship (Relacionamento)
```typescript
interface Relationship {
    id: string;                    
    source: string;                // ID entidade origem
    target: string;                // ID entidade destino
    type: string;                  // WORKS_FOR, PART_OF, etc.
    description: string;           // Descrição LLM
    properties: Record<string, any>;
    weight: number;                // Força (0-1)
    bidirectional: boolean;        
    keyValuePairs?: KeyValuePair[];
    sourceDocuments: string[];     
    sourceChunks: string[];        
    confidence: number;            
    createdAt: string;             
    updatedAt: string;             
    mergedFrom?: string[];         
}
```

### Document (Documento)
```typescript
interface CappyRAGDocument {
    id: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    filePath: string;
    fileName: string;
    fileSize: number;
    content: string;
    status: 'processing' | 'completed' | 'failed';
    processingResults?: {
        entities: number;
        relationships: number;
        chunks: number;
        processingTime: string;
    };
    created: string;
    updated: string;
    vector?: number[];
}
```

### Chunk (Fragmento)
```typescript
interface CappyRAGChunk {
    id: string;
    documentId: string;
    content: string;
    startPosition: number;
    endPosition: number;
    startLine?: number;            // Linha inicial
    endLine?: number;              // Linha final
    chunkIndex: number;
    entities: string[];            // IDs de entidades
    relationships: string[];       // IDs de relacionamentos
    created: string;
    vector?: number[];
}
```

---

## 🎨 Proposta de Enriquecimento Visual

### 1. **Nós Enriquecidos - Schema D3.js**

```typescript
interface D3GraphNode {
    // Identificação básica
    id: string;
    label: string;
    type: 'document' | 'entity' | 'relationship' | 'chunk';
    
    // Propriedades visuais
    size: number;                   // Tamanho do nó (baseado em relevância)
    color: string;                  // Cor por tipo ou categoria
    opacity: number;                // Opacidade (0-1)
    shape: 'circle' | 'rect' | 'diamond' | 'star'; // Forma do nó
    
    // Posição D3
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    
    // Metadados enriquecidos
    metadata: {
        // Comum a todos os tipos
        created: string;
        updated?: string;
        confidence?: number;         // Score de confiança (0-1)
        
        // Entity-specific
        entityType?: string;         // Person, Technology, etc.
        description?: string;
        properties?: Record<string, any>;
        sourceDocumentsCount?: number;
        sourceChunksCount?: number;
        mergedCount?: number;        // Número de entidades merged
        
        // Document-specific
        category?: string;
        tags?: string[];
        fileName?: string;
        filePath?: string;
        fileSize?: number;
        status?: string;
        processingResults?: {
            entities: number;
            relationships: number;
            chunks: number;
            processingTime: string;
        };
        
        // Chunk-specific
        chunkIndex?: number;
        contentLength?: number;
        contentPreview?: string;     // Primeiras 200 chars
        fullContent?: string;        // Conteúdo completo
        lineRange?: string;          // "L45-L67"
        documentId?: string;
        entitiesCount?: number;
        relationshipsCount?: number;
        
        // Relationship-specific (para edges, mas pode ser útil)
        relationshipType?: string;
        weight?: number;
        bidirectional?: boolean;
    };
    
    // Estatísticas de conexão
    connections: {
        incoming: number;            // Número de conexões entrantes
        outgoing: number;            // Número de conexões saintes
        total: number;               // Total de conexões
        strongestConnection?: string; // ID do nó mais conectado
    };
    
    // Métricas de relevância
    metrics: {
        pageRank?: number;           // PageRank calculado
        betweenness?: number;        // Centralidade de intermediação
        clustering?: number;         // Coeficiente de agrupamento
        importance: number;          // Score de importância (0-1)
    };
    
    // Estado de visualização
    state: {
        highlighted: boolean;
        selected: boolean;
        hovered: boolean;
        visible: boolean;
        expanded: boolean;           // Se os detalhes estão expandidos
    };
}
```

### 2. **Edges Enriquecidos**

```typescript
interface D3GraphEdge {
    // Identificação
    id: string;
    source: string | D3GraphNode;
    target: string | D3GraphNode;
    
    // Visual
    type: 'line' | 'curve' | 'dashed' | 'dotted';
    label?: string;
    size: number;                    // Espessura da linha
    color: string;
    opacity: number;
    
    // Metadados
    metadata: {
        relationshipType: string;    // WORKS_FOR, CONTAINS, etc.
        description?: string;
        weight: number;              // Força da relação (0-1)
        confidence: number;          // Confiança (0-1)
        bidirectional: boolean;
        created: string;
        sourceDocuments?: string[];
        sourceChunks?: string[];
        properties?: Record<string, any>;
    };
    
    // Estado
    state: {
        highlighted: boolean;
        selected: boolean;
        visible: boolean;
    };
}
```

---

## 🎯 Estratégias de Visualização

### **A) Tamanho do Nó (Size)**
Baseado em múltiplos fatores:

```typescript
function calculateNodeSize(node: D3GraphNode): number {
    const baseSize = {
        'document': 15,
        'entity': 10,
        'chunk': 5,
        'relationship': 8
    }[node.type] || 8;
    
    // Ajusta por número de conexões (importância)
    const connectionsMultiplier = 1 + (node.connections.total * 0.1);
    
    // Ajusta por confiança
    const confidenceMultiplier = node.metadata.confidence || 1;
    
    // Ajusta por métricas de relevância
    const importanceMultiplier = 1 + (node.metrics.importance * 0.5);
    
    return baseSize * connectionsMultiplier * confidenceMultiplier * importanceMultiplier;
}
```

### **B) Cor do Nó (Color)**
Sistema de cores por categoria e tipo de arquivo:

```typescript
// 🎨 Esquema de cores padronizado
const colorScheme = {
    // Por tipo de nó
    document: {
        processing: '#fbbf24',  // Amarelo (processando)
        completed: '#10b981',   // Verde (completo)
        failed: '#ef4444'       // Vermelho (erro)
    },
    entity: {
        Person: '#3b82f6',      // Azul
        Technology: '#8b5cf6',  // Roxo
        Concept: '#06b6d4',     // Ciano
        Organization: '#f59e0b', // Laranja
        Location: '#14b8a6',    // Verde água
        default: '#6366f1'      // Índigo
    },
    chunk: '#8b5cf6',           // Roxo claro
    relationship: '#f97316',    // Laranja
    
    // 📁 Por categoria/tipo de arquivo (file-based)
    fileCategory: {
        // Documentação
        'documentation': '#10b981',      // Verde - .md, .mdx, .rst, .txt
        'markdown': '#10b981',
        'text': '#6b7280',              // Cinza
        
        // Código - Backend
        'csharp': '#68217a',            // Roxo escuro - .cs
        'dotnet': '#512bd4',            // Roxo .NET
        'java': '#b07219',              // Laranja Java
        'python': '#3572A5',            // Azul Python - .py
        'ruby': '#701516',              // Vermelho Ruby - .rb
        'go': '#00ADD8',                // Ciano Go - .go
        'rust': '#dea584',              // Laranja Rust - .rs
        'php': '#4F5D95',               // Azul PHP - .php
        
        // Código - Frontend
        'javascript': '#f1e05a',        // Amarelo - .js, .mjs
        'typescript': '#2b7489',        // Azul escuro - .ts, .tsx
        'react': '#61dafb',             // Azul claro - .jsx, .tsx
        'vue': '#41b883',               // Verde Vue - .vue
        'angular': '#dd0031',           // Vermelho Angular
        'svelte': '#ff3e00',            // Laranja Svelte - .svelte
        
        // Estilo/Layout
        'css': '#563d7c',               // Roxo - .css
        'scss': '#c6538c',              // Rosa - .scss, .sass
        'less': '#1d365d',              // Azul escuro - .less
        'stylus': '#ff6347',            // Vermelho - .styl
        'tailwind': '#06b6d4',          // Ciano Tailwind
        
        // Markup/Config
        'html': '#e34c26',              // Laranja HTML - .html, .htm
        'xml': '#0060ac',               // Azul - .xml
        'json': '#292929',              // Preto - .json
        'yaml': '#cb171e',              // Vermelho - .yaml, .yml
        'toml': '#9c4221',              // Marrom - .toml
        
        // Database/Query
        'sql': '#e38c00',               // Laranja SQL - .sql
        'database': '#003b57',          // Azul escuro
        'mongodb': '#4db33d',           // Verde Mongo - .mongodb
        'postgresql': '#336791',        // Azul Postgres
        'mysql': '#4479a1',             // Azul MySQL
        'graphql': '#e10098',           // Rosa GraphQL - .graphql, .gql
        
        // Shell/Scripts
        'shell': '#89e051',             // Verde - .sh, .bash, .zsh
        'powershell': '#012456',        // Azul escuro - .ps1
        'batch': '#c1f12e',             // Verde claro - .bat, .cmd
        
        // Build/Config
        'dockerfile': '#384d54',        // Cinza azulado - Dockerfile
        'makefile': '#427819',          // Verde escuro - Makefile
        'cmake': '#da3434',             // Vermelho - CMakeLists.txt
        'gradle': '#02303a',            // Verde escuro - .gradle
        'maven': '#c71a36',             // Vermelho Maven - pom.xml
        
        // Dados
        'csv': '#6b7280',               // Cinza - .csv
        'excel': '#217346',             // Verde Excel - .xlsx, .xls
        'parquet': '#00c8ff',           // Azul Parquet
        'arrow': '#d22128',             // Vermelho Arrow
        
        // Outros
        'binary': '#1f2937',            // Preto - executáveis, .dll, .so
        'image': '#f59e0b',             // Laranja - .png, .jpg, .svg
        'video': '#ef4444',             // Vermelho - .mp4, .avi
        'audio': '#8b5cf6',             // Roxo - .mp3, .wav
        'archive': '#6b7280',           // Cinza - .zip, .tar, .gz
        'pdf': '#f40f02',               // Vermelho PDF
        
        // Default
        'unknown': '#9ca3af',           // Cinza claro
        'default': '#6366f1'            // Índigo
    }
};

// 🗂️ Mapeamento de extensões para categorias
const fileExtensionToCategory: Record<string, string> = {
    // Documentação
    'md': 'markdown',
    'mdx': 'markdown',
    'markdown': 'markdown',
    'rst': 'documentation',
    'txt': 'text',
    'doc': 'documentation',
    'docx': 'documentation',
    
    // Backend
    'cs': 'csharp',
    'csx': 'csharp',
    'java': 'java',
    'py': 'python',
    'pyc': 'python',
    'pyw': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    
    // Frontend
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'react',
    'jsx': 'react',
    'vue': 'vue',
    'svelte': 'svelte',
    
    // Estilo
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'styl': 'stylus',
    
    // Markup
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    
    // Database
    'sql': 'sql',
    'mongodb': 'mongodb',
    'graphql': 'graphql',
    'gql': 'graphql',
    
    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'bat': 'batch',
    'cmd': 'batch',
    
    // Build
    'gradle': 'gradle',
    
    // Dados
    'csv': 'csv',
    'tsv': 'csv',
    'xlsx': 'excel',
    'xls': 'excel',
    'parquet': 'parquet',
    'arrow': 'arrow',
    
    // Outros
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'mp4': 'video',
    'avi': 'video',
    'mov': 'video',
    'mp3': 'audio',
    'wav': 'audio',
    'zip': 'archive',
    'tar': 'archive',
    'gz': 'archive',
    '7z': 'archive',
    'pdf': 'pdf',
    'dll': 'binary',
    'so': 'binary',
    'exe': 'binary'
};

// 🎨 Função para obter cor do nó
function getNodeColor(node: D3GraphNode): string {
    // Documentos com status específico
    if (node.type === 'document') {
        // Se tem extensão de arquivo, usa cor por categoria
        if (node.metadata.fileName) {
            const ext = node.metadata.fileName.split('.').pop()?.toLowerCase();
            if (ext && fileExtensionToCategory[ext]) {
                const category = fileExtensionToCategory[ext];
                return colorScheme.fileCategory[category] || colorScheme.fileCategory.default;
            }
        }
        // Fallback para status
        return colorScheme.document[node.metadata.status || 'completed'];
    }
    
    // Entidades por tipo
    if (node.type === 'entity') {
        return colorScheme.entity[node.metadata.entityType || 'default'];
    }
    
    // Chunks e relationships
    return colorScheme[node.type] || '#9ca3af';
}

// 📊 Função auxiliar para obter categoria de arquivo
function getFileCategory(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'unknown';
    return fileExtensionToCategory[ext] || 'unknown';
}

// 🏷️ Função para obter label amigável da categoria
function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        'markdown': '📝 Markdown',
        'documentation': '📚 Documentação',
        'text': '📄 Texto',
        'csharp': '🔷 C#',
        'dotnet': '💎 .NET',
        'java': '☕ Java',
        'python': '🐍 Python',
        'ruby': '💎 Ruby',
        'go': '🐹 Go',
        'rust': '🦀 Rust',
        'php': '🐘 PHP',
        'javascript': '📜 JavaScript',
        'typescript': '📘 TypeScript',
        'react': '⚛️ React',
        'vue': '💚 Vue',
        'angular': '🅰️ Angular',
        'svelte': '🔥 Svelte',
        'css': '🎨 CSS',
        'scss': '🎨 SCSS',
        'html': '🌐 HTML',
        'xml': '📋 XML',
        'json': '📦 JSON',
        'yaml': '⚙️ YAML',
        'sql': '🗄️ SQL',
        'database': '💾 Database',
        'graphql': '◉ GraphQL',
        'shell': '🐚 Shell',
        'powershell': '💻 PowerShell',
        'dockerfile': '🐳 Docker',
        'csv': '📊 CSV',
        'excel': '📊 Excel',
        'pdf': '📕 PDF',
        'image': '🖼️ Imagem',
        'video': '🎬 Vídeo',
        'audio': '🎵 Áudio',
        'archive': '📦 Arquivo',
        'binary': '⚙️ Binário',
        'unknown': '❓ Desconhecido',
        'default': '📄 Arquivo'
    };
    return labels[category] || '📄 ' + category;
}
```

### **C) Forma do Nó (Shape) com Ícones/Logos**

D3.js suporta **imagens SVG** e **emojis** nos nós! Vamos usar ícones para cada tipo de arquivo:

```typescript
// 🎨 URLs de ícones por categoria (SVG simples ou emojis)
const iconsByCategory: Record<string, string> = {
    // Backend - Emojis ou SVG paths
    'csharp': '🔷',           // ou URL: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/csharp.svg'
    'dotnet': '💎',
    'java': '☕',
    'python': '🐍',
    'ruby': '💎',
    'go': '🐹',
    'rust': '🦀',
    'php': '🐘',
    
    // Frontend
    'javascript': '📜',
    'typescript': '📘',
    'react': '⚛️',
    'vue': '💚',
    'angular': '🅰️',
    'svelte': '🔥',
    
    // Estilo
    'css': '🎨',
    'scss': '🎨',
    'html': '🌐',
    
    // Database
    'sql': '🗄️',
    'mongodb': '🍃',
    'postgresql': '🐘',
    'mysql': '🐬',
    'graphql': '◉',
    
    // Documentação
    'markdown': '📝',
    'documentation': '📚',
    'text': '📄',
    
    // Markup/Config
    'xml': '📋',
    'json': '📦',
    'yaml': '⚙️',
    
    // Shell
    'shell': '🐚',
    'powershell': '💻',
    'batch': '⚡',
    
    // Build
    'dockerfile': '🐳',
    'makefile': '🔨',
    
    // Dados
    'csv': '📊',
    'excel': '📊',
    'pdf': '📕',
    
    // Mídia
    'image': '🖼️',
    'video': '🎬',
    'audio': '🎵',
    'archive': '📦',
    
    // Default
    'unknown': '❓',
    'default': '📄'
};

// 🎯 Opção 1: Usar emojis (mais simples, funciona em qualquer contexto)
function getNodeIcon(node: D3GraphNode): string {
    if (node.type === 'document' && node.metadata.fileName) {
        const category = getFileCategory(node.metadata.fileName);
        return iconsByCategory[category] || iconsByCategory.default;
    }
    
    // Ícones por tipo de nó
    const nodeTypeIcons = {
        'entity': '👤',
        'chunk': '📄',
        'relationship': '🔗',
        'document': '📄'
    };
    
    return nodeTypeIcons[node.type] || '⚫';
}

// 🎨 Opção 2: Usar SVG de ícones externos (mais profissional)
// Recomendo: https://simpleicons.org/ ou https://devicon.dev/
const svgIconUrls: Record<string, string> = {
    'csharp': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/csharp.svg',
    'python': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/python.svg',
    'javascript': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/javascript.svg',
    'typescript': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/typescript.svg',
    'react': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/react.svg',
    'vue': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/vuedotjs.svg',
    'angular': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/angular.svg',
    'nodejs': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/nodedotjs.svg',
    'css': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/css3.svg',
    'html': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/html5.svg',
    'sql': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/mysql.svg',
    'mongodb': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/mongodb.svg',
    'postgresql': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/postgresql.svg',
    'docker': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/docker.svg',
    'markdown': 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/markdown.svg'
};

function getNodeShape(node: D3GraphNode): string {
    const shapeMap = {
        'document': 'image',     // Imagem/ícone
        'entity': 'circle',      // Círculo
        'chunk': 'rect',         // Retângulo pequeno
        'relationship': 'circle' // Círculo (edge visual)
    };
    return shapeMap[node.type] || 'circle';
}
```

### **Renderização de Nós com Ícones**

```javascript
// Opção 1: Emoji como texto no centro do nó
function renderNodeWithEmoji(d, nodeElement) {
    // Círculo de fundo com cor da categoria
    nodeElement.append("circle")
        .attr("r", d.size)
        .attr("fill", d.color)
        .attr("opacity", d.opacity)
        .attr("stroke", "#fff")
        .attr("stroke-width", d.metadata.confidence > 0.8 ? 3 : 1.5);
    
    // Emoji/ícone centralizado
    const icon = getNodeIcon(d);
    nodeElement.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", `${d.size * 1.2}px`)
        .attr("pointer-events", "none")
        .text(icon);
}

// Opção 2: Imagem SVG externa (mais profissional)
function renderNodeWithSVGIcon(d, nodeElement) {
    const category = getFileCategory(d.metadata.fileName || '');
    const iconUrl = svgIconUrls[category];
    
    if (iconUrl) {
        // Círculo de fundo
        nodeElement.append("circle")
            .attr("r", d.size)
            .attr("fill", "#ffffff")
            .attr("opacity", 0.9)
            .attr("stroke", d.color)
            .attr("stroke-width", 3);
        
        // SVG externo como imagem
        nodeElement.append("image")
            .attr("xlink:href", iconUrl)
            .attr("x", -d.size * 0.6)
            .attr("y", -d.size * 0.6)
            .attr("width", d.size * 1.2)
            .attr("height", d.size * 1.2)
            .attr("pointer-events", "none");
    } else {
        // Fallback para emoji
        renderNodeWithEmoji(d, nodeElement);
    }
}

// Opção 3: Pattern SVG inline (melhor performance)
function defineIconPatterns(svg) {
    const defs = svg.append("defs");
    
    // Define pattern para cada categoria
    Object.entries(svgIconUrls).forEach(([category, url]) => {
        const pattern = defs.append("pattern")
            .attr("id", `icon-${category}`)
            .attr("x", "0")
            .attr("y", "0")
            .attr("width", "1")
            .attr("height", "1");
        
        pattern.append("image")
            .attr("xlink:href", url)
            .attr("x", "0")
            .attr("y", "0")
            .attr("width", "24")
            .attr("height", "24");
    });
}

function renderNodeWithPattern(d, nodeElement) {
    const category = getFileCategory(d.metadata.fileName || '');
    
    // Usa pattern se disponível, senão cor sólida
    const fill = svgIconUrls[category] 
        ? `url(#icon-${category})` 
        : d.color;
    
    nodeElement.append("circle")
        .attr("r", d.size)
        .attr("fill", fill)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
}
```

### **D) Opacidade (Opacity)**
Baseada em confiança e relevância:

```typescript
function calculateOpacity(node: D3GraphNode): number {
    const baseOpacity = node.state.visible ? 1.0 : 0.3;
    const confidence = node.metadata.confidence || 1;
    const importance = node.metrics.importance || 0.5;
    
    return baseOpacity * (0.5 + (confidence * 0.25) + (importance * 0.25));
}
```

---

## 🎨 Implementação D3.js - Código Base

### **Setup Inicial**

```javascript
// Configuração do canvas
const width = 1200;
const height = 800;

// Simulação de forças
const simulation = d3.forceSimulation()
    .force("charge", d3.forceManyBody()
        .strength(d => -30 * d.size)  // Repulsão baseada no tamanho
    )
    .force("link", d3.forceLink()
        .id(d => d.id)
        .distance(d => {
            // Distância baseada no tipo de relação
            const baseDistance = 100;
            const weight = d.metadata?.weight || 0.5;
            return baseDistance * (1 / weight); // Relações fortes = mais próximas
        })
        .strength(d => d.metadata?.weight || 0.5)
    )
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05))
    .force("collision", d3.forceCollide()
        .radius(d => d.size + 5)  // Evita sobreposição
    )
    .on("tick", ticked);

// SVG Container
const svg = d3.select("#graph-container")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height);

// Grupos para organizar elementos
const g = svg.append("g");
const linkGroup = g.append("g").attr("class", "links");
const nodeGroup = g.append("g").attr("class", "nodes");

// Zoom e pan
const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
svg.call(zoom);
```

### **Renderização de Nós Enriquecidos**

```javascript
function renderNodes(nodes) {
    const nodeElements = nodeGroup
        .selectAll(".node")
        .data(nodes, d => d.id)
        .join(
            enter => {
                const nodeEnter = enter.append("g")
                    .attr("class", "node")
                    .call(drag(simulation));
                
                // Adiciona forma baseada no tipo
                nodeEnter.each(function(d) {
                    const node = d3.select(this);
                    
                    if (d.shape === 'circle') {
                        node.append("circle")
                            .attr("r", d.size)
                            .attr("fill", d.color)
                            .attr("opacity", d.opacity);
                    } else if (d.shape === 'rect') {
                        node.append("rect")
                            .attr("width", d.size * 2)
                            .attr("height", d.size * 1.5)
                            .attr("x", -d.size)
                            .attr("y", -d.size * 0.75)
                            .attr("rx", 3)
                            .attr("fill", d.color)
                            .attr("opacity", d.opacity);
                    } else if (d.shape === 'diamond') {
                        const points = [
                            [0, -d.size],
                            [d.size, 0],
                            [0, d.size],
                            [-d.size, 0]
                        ].map(p => p.join(",")).join(" ");
                        
                        node.append("polygon")
                            .attr("points", points)
                            .attr("fill", d.color)
                            .attr("opacity", d.opacity);
                    }
                    
                    // Borda baseada em confiança
                    node.select(d.shape === 'circle' ? 'circle' : 
                               d.shape === 'rect' ? 'rect' : 'polygon')
                        .attr("stroke", "#fff")
                        .attr("stroke-width", d.metadata.confidence > 0.8 ? 3 : 1.5);
                    
                    // Label
                    node.append("text")
                        .attr("dy", d.size + 12)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "10px")
                        .attr("fill", "#333")
                        .text(d.label.length > 20 ? d.label.substring(0, 17) + "..." : d.label);
                    
                    // Badge de conexões (se > 5)
                    if (d.connections.total > 5) {
                        node.append("circle")
                            .attr("cx", d.size * 0.7)
                            .attr("cy", -d.size * 0.7)
                            .attr("r", 8)
                            .attr("fill", "#ef4444");
                        
                        node.append("text")
                            .attr("x", d.size * 0.7)
                            .attr("y", -d.size * 0.7 + 1)
                            .attr("text-anchor", "middle")
                            .attr("font-size", "9px")
                            .attr("fill", "#fff")
                            .attr("font-weight", "bold")
                            .text(d.connections.total);
                    }
                });
                
                // Eventos de interação
                nodeEnter
                    .on("mouseover", handleNodeHover)
                    .on("mouseout", handleNodeOut)
                    .on("click", handleNodeClick)
                    .on("dblclick", handleNodeDoubleClick);
                
                return nodeEnter;
            },
            update => update,
            exit => exit.remove()
        );
    
    return nodeElements;
}
```

### **Renderização de Edges com Metadados**

```javascript
function renderEdges(edges) {
    const linkElements = linkGroup
        .selectAll(".link")
        .data(edges, d => d.id)
        .join(
            enter => {
                const linkEnter = enter.append("g")
                    .attr("class", "link");
                
                // Linha principal
                linkEnter.append("line")
                    .attr("stroke", d => d.color)
                    .attr("stroke-width", d => d.size)
                    .attr("stroke-opacity", d => d.opacity)
                    .attr("stroke-dasharray", d => {
                        if (d.type === 'dashed') return "5,5";
                        if (d.type === 'dotted') return "2,3";
                        return null;
                    })
                    .attr("marker-end", d => {
                        return d.metadata.bidirectional ? null : "url(#arrowhead)";
                    });
                
                // Label do relacionamento (exibido no hover)
                linkEnter.append("text")
                    .attr("class", "edge-label")
                    .attr("font-size", "9px")
                    .attr("fill", "#666")
                    .attr("text-anchor", "middle")
                    .attr("display", "none")  // Oculto por padrão
                    .text(d => d.label || d.metadata.relationshipType);
                
                // Eventos
                linkEnter
                    .on("mouseover", handleEdgeHover)
                    .on("mouseout", handleEdgeOut);
                
                return linkEnter;
            },
            update => update,
            exit => exit.remove()
        );
    
    return linkElements;
}
```

### **Tooltip Enriquecido**

```javascript
function createTooltip() {
    return d3.select("body")
        .append("div")
        .attr("class", "graph-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "#fff")
        .style("padding", "12px")
        .style("border-radius", "8px")
        .style("font-size", "12px")
        .style("max-width", "300px")
        .style("z-index", "1000")
        .style("pointer-events", "none");
}

function handleNodeHover(event, d) {
    const tooltip = d3.select(".graph-tooltip");
    
    let tooltipHtml = `
        <div style="border-bottom: 1px solid #444; padding-bottom: 8px; margin-bottom: 8px;">
            <strong style="font-size: 14px;">${d.label}</strong>
            <div style="font-size: 10px; color: #aaa; margin-top: 4px;">
                ${d.type.toUpperCase()} • ID: ${d.id.substring(0, 8)}...
            </div>
        </div>
    `;
    
    if (d.type === 'entity') {
        tooltipHtml += `
            <div><strong>Tipo:</strong> ${d.metadata.entityType || 'N/A'}</div>
            <div><strong>Confiança:</strong> ${((d.metadata.confidence || 0) * 100).toFixed(0)}%</div>
            <div><strong>Conexões:</strong> ${d.connections.total}</div>
        `;
        if (d.metadata.description) {
            tooltipHtml += `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">
                    <div style="font-size: 11px; color: #ccc;">
                        ${d.metadata.description.substring(0, 150)}${d.metadata.description.length > 150 ? '...' : ''}
                    </div>
                </div>
            `;
        }
    } else if (d.type === 'document') {
        tooltipHtml += `
            <div><strong>Arquivo:</strong> ${d.metadata.fileName}</div>
            <div><strong>Categoria:</strong> ${d.metadata.category}</div>
            <div><strong>Status:</strong> ${d.metadata.status}</div>
        `;
        if (d.metadata.processingResults) {
            tooltipHtml += `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">
                    <div>📊 Entidades: ${d.metadata.processingResults.entities}</div>
                    <div>🔗 Relacionamentos: ${d.metadata.processingResults.relationships}</div>
                    <div>📝 Chunks: ${d.metadata.processingResults.chunks}</div>
                </div>
            `;
        }
    } else if (d.type === 'chunk') {
        tooltipHtml += `
            <div><strong>Chunk:</strong> #${d.metadata.chunkIndex}</div>
            <div><strong>Tamanho:</strong> ${d.metadata.contentLength} chars</div>
            ${d.metadata.lineRange ? `<div><strong>Linhas:</strong> ${d.metadata.lineRange}</div>` : ''}
        `;
        if (d.metadata.contentPreview) {
            tooltipHtml += `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">
                    <div style="font-size: 10px; color: #aaa; font-style: italic;">
                        "${d.metadata.contentPreview}"
                    </div>
                </div>
            `;
        }
    }
    
    tooltipHtml += `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444; font-size: 10px; color: #888;">
            Criado: ${new Date(d.metadata.created).toLocaleDateString()}
            ${d.metadata.updated ? `• Atualizado: ${new Date(d.metadata.updated).toLocaleDateString()}` : ''}
        </div>
    `;
    
    tooltip.html(tooltipHtml)
        .style("visibility", "visible")
        .style("top", (event.pageY + 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    
    // Highlight do nó
    d3.select(event.currentTarget)
        .select(d.shape === 'circle' ? 'circle' : 
               d.shape === 'rect' ? 'rect' : 'polygon')
        .transition()
        .duration(200)
        .attr("stroke-width", 4)
        .attr("stroke", "#fbbf24");
}

function handleNodeOut(event, d) {
    d3.select(".graph-tooltip").style("visibility", "hidden");
    
    // Remove highlight
    d3.select(event.currentTarget)
        .select(d.shape === 'circle' ? 'circle' : 
               d.shape === 'rect' ? 'rect' : 'polygon')
        .transition()
        .duration(200)
        .attr("stroke-width", d.metadata.confidence > 0.8 ? 3 : 1.5)
        .attr("stroke", "#fff");
}
```

### **Panel de Detalhes (ao clicar)**

```javascript
function handleNodeClick(event, d) {
    event.stopPropagation();
    
    // Marca como selecionado
    d.state.selected = !d.state.selected;
    
    // Update visual
    d3.select(event.currentTarget)
        .select(d.shape === 'circle' ? 'circle' : 
               d.shape === 'rect' ? 'rect' : 'polygon')
        .attr("stroke", d.state.selected ? "#f59e0b" : "#fff")
        .attr("stroke-width", d.state.selected ? 5 : (d.metadata.confidence > 0.8 ? 3 : 1.5));
    
    if (d.state.selected) {
        showDetailPanel(d);
    } else {
        hideDetailPanel();
    }
}

function showDetailPanel(node) {
    const panel = d3.select("#detail-panel");
    
    let panelHtml = `
        <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <h3 style="margin: 0 0 8px 0;">${node.label}</h3>
                    <div style="font-size: 12px; color: #666;">
                        ${node.type.toUpperCase()} • ${node.id}
                    </div>
                </div>
                <button onclick="hideDetailPanel()" style="background: none; border: none; cursor: pointer; font-size: 20px;">×</button>
            </div>
    `;
    
    // Métricas de conexão
    panelHtml += `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${node.connections.incoming}</div>
                <div style="font-size: 11px; color: #666;">Entrantes</div>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${node.connections.outgoing}</div>
                <div style="font-size: 11px; color: #666;">Saintes</div>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${node.connections.total}</div>
                <div style="font-size: 11px; color: #666;">Total</div>
            </div>
        </div>
    `;
    
    // Metadados específicos por tipo
    if (node.type === 'entity') {
        panelHtml += `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px;">Informações da Entidade</h4>
                <div style="font-size: 13px; line-height: 1.6;">
                    <div><strong>Tipo:</strong> ${node.metadata.entityType || 'N/A'}</div>
                    <div><strong>Confiança:</strong> 
                        <div style="display: inline-block; width: 100px; height: 8px; background: #e5e7eb; border-radius: 4px; vertical-align: middle;">
                            <div style="width: ${(node.metadata.confidence || 0) * 100}%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                        </div>
                        ${((node.metadata.confidence || 0) * 100).toFixed(0)}%
                    </div>
                    <div><strong>Documentos:</strong> ${node.metadata.sourceDocumentsCount || 0}</div>
                    <div><strong>Chunks:</strong> ${node.metadata.sourceChunksCount || 0}</div>
                    ${node.metadata.mergedCount ? `<div><strong>Merged:</strong> ${node.metadata.mergedCount} entidades</div>` : ''}
                </div>
            </div>
        `;
        
        if (node.metadata.description) {
            panelHtml += `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Descrição</h4>
                    <div style="font-size: 13px; color: #666; line-height: 1.5;">
                        ${node.metadata.description}
                    </div>
                </div>
            `;
        }
        
        if (node.metadata.properties && Object.keys(node.metadata.properties).length > 0) {
            panelHtml += `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Propriedades</h4>
                    <div style="font-size: 12px; background: #f9fafb; padding: 12px; border-radius: 6px;">
                        ${Object.entries(node.metadata.properties)
                            .map(([key, value]) => `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`)
                            .join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // Métricas de relevância
    panelHtml += `
        <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px;">Métricas de Relevância</h4>
            <div style="font-size: 13px;">
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Importância</span>
                        <span>${(node.metrics.importance * 100).toFixed(0)}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px;">
                        <div style="width: ${node.metrics.importance * 100}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px;"></div>
                    </div>
                </div>
                ${node.metrics.pageRank ? `
                    <div style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span>PageRank</span>
                            <span>${node.metrics.pageRank.toFixed(3)}</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px;">
                            <div style="width: ${Math.min(node.metrics.pageRank * 1000, 100)}%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Timestamps
    panelHtml += `
        <div style="font-size: 11px; color: #999; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div>Criado: ${new Date(node.metadata.created).toLocaleString()}</div>
            ${node.metadata.updated ? `<div>Atualizado: ${new Date(node.metadata.updated).toLocaleString()}</div>` : ''}
        </div>
    `;
    
    panelHtml += `</div>`;
    
    panel.html(panelHtml)
        .style("display", "block")
        .style("animation", "slideIn 0.3s ease-out");
}
```

---

## 📊 Métricas de Relevância Calculadas

### **1. Importância (Importance Score)**

```typescript
function calculateImportance(node: D3GraphNode): number {
    const weights = {
        connections: 0.4,      // 40% baseado em conexões
        confidence: 0.3,       // 30% baseado em confiança
        recency: 0.2,          // 20% baseado em quão recente
        sources: 0.1           // 10% baseado em número de fontes
    };
    
    // Normaliza conexões (0-1)
    const maxConnections = 50; // Assume máximo de 50 conexões
    const connectionsScore = Math.min(node.connections.total / maxConnections, 1);
    
    // Confiança já está em 0-1
    const confidenceScore = node.metadata.confidence || 0.5;
    
    // Recency (mais recente = maior score)
    const daysSinceCreation = (Date.now() - new Date(node.metadata.created).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(1 - (daysSinceCreation / 365), 0); // Decai em 1 ano
    
    // Número de fontes
    const sourcesCount = node.metadata.sourceDocumentsCount || 1;
    const sourcesScore = Math.min(sourcesCount / 10, 1); // Normaliza para máx 10 documentos
    
    return (
        connectionsScore * weights.connections +
        confidenceScore * weights.confidence +
        recencyScore * weights.recency +
        sourcesScore * weights.sources
    );
}
```

### **2. PageRank (Opcional - requer biblioteca)**

```typescript
// Usando biblioteca graph-theory ou implementação custom
function calculatePageRank(nodes: D3GraphNode[], edges: D3GraphEdge[]): Map<string, number> {
    const dampingFactor = 0.85;
    const iterations = 20;
    const nodeCount = nodes.length;
    
    // Inicializa PageRank
    const pageRank = new Map<string, number>();
    nodes.forEach(node => pageRank.set(node.id, 1 / nodeCount));
    
    // Constrói grafo de adjacência
    const outLinks = new Map<string, string[]>();
    edges.forEach(edge => {
        const source = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const target = typeof edge.target === 'string' ? edge.target : edge.target.id;
        
        if (!outLinks.has(source)) outLinks.set(source, []);
        outLinks.get(source)!.push(target);
    });
    
    // Itera
    for (let i = 0; i < iterations; i++) {
        const newPageRank = new Map<string, number>();
        
        nodes.forEach(node => {
            let sum = 0;
            
            // Soma contribuições dos nós que apontam para este
            edges.forEach(edge => {
                const target = typeof edge.target === 'string' ? edge.target : edge.target.id;
                if (target === node.id) {
                    const source = typeof edge.source === 'string' ? edge.source : edge.source.id;
                    const sourceOutLinks = outLinks.get(source)?.length || 1;
                    sum += pageRank.get(source)! / sourceOutLinks;
                }
            });
            
            newPageRank.set(node.id, (1 - dampingFactor) / nodeCount + dampingFactor * sum);
        });
        
        pageRank.clear();
        newPageRank.forEach((value, key) => pageRank.set(key, value));
    }
    
    return pageRank;
}
```

---

## 🎯 Filtros e Controles Interativos

### **Filtro por Tipo**

```javascript
function filterByType(types: string[]) {
    d3.selectAll(".node")
        .transition()
        .duration(300)
        .style("opacity", d => types.includes(d.type) ? 1 : 0.1)
        .style("pointer-events", d => types.includes(d.type) ? "all" : "none");
    
    d3.selectAll(".link")
        .transition()
        .duration(300)
        .style("opacity", d => {
            const sourceType = typeof d.source === 'object' ? d.source.type : null;
            const targetType = typeof d.target === 'object' ? d.target.type : null;
            return (types.includes(sourceType) && types.includes(targetType)) ? 1 : 0.1;
        });
}
```

### **Filtro por Confiança**

```javascript
function filterByConfidence(minConfidence: number) {
    d3.selectAll(".node")
        .transition()
        .duration(300)
        .style("opacity", d => {
            const confidence = d.metadata.confidence || 1;
            return confidence >= minConfidence ? 1 : 0.1;
        })
        .style("pointer-events", d => {
            const confidence = d.metadata.confidence || 1;
            return confidence >= minConfidence ? "all" : "none";
        });
}
```

### **Busca de Nós**

```javascript
function searchNodes(query: string) {
    const lowerQuery = query.toLowerCase();
    
    d3.selectAll(".node")
        .transition()
        .duration(300)
        .style("opacity", d => {
            const matchesLabel = d.label.toLowerCase().includes(lowerQuery);
            const matchesType = d.type.toLowerCase().includes(lowerQuery);
            const matchesDescription = d.metadata.description?.toLowerCase().includes(lowerQuery);
            
            return (matchesLabel || matchesType || matchesDescription) ? 1 : 0.1;
        })
        .each(function(d) {
            if (d.label.toLowerCase().includes(lowerQuery)) {
                // Destaca nós que correspondem
                d3.select(this)
                    .select(d.shape === 'circle' ? 'circle' : 
                           d.shape === 'rect' ? 'rect' : 'polygon')
                    .attr("stroke", "#fbbf24")
                    .attr("stroke-width", 4);
            }
        });
}
```

---

## � Timeline de Evolução do Grafo

### **Conceito**

Uma timeline interativa que mostra a evolução temporal do grafo, permitindo:
- 🕐 Visualizar quando entidades, documentos e relacionamentos foram criados
- ▶️ Reproduzir a construção do grafo ao longo do tempo (playback)
- 📊 Identificar períodos de maior atividade
- 🔍 Filtrar nós por período temporal

### **Schema de Data do Chart**

```typescript
interface TimelineDataPoint {
    timestamp: Date;              // Data/hora do evento
    type: 'entity' | 'document' | 'chunk' | 'relationship';
    action: 'created' | 'updated' | 'merged';
    nodeId: string;               // ID do nó afetado
    metadata: {
        label: string;
        category?: string;
        confidence?: number;
    };
}

interface TimelineState {
    currentTime: Date;            // Tempo atual do playback
    minTime: Date;                // Tempo mínimo (primeiro evento)
    maxTime: Date;                // Tempo máximo (último evento)
    isPlaying: boolean;           // Se está em playback
    playbackSpeed: number;        // Velocidade (1x, 2x, 5x, 10x)
    visibleNodes: Set<string>;    // IDs dos nós visíveis no tempo atual
    visibleEdges: Set<string>;    // IDs das edges visíveis no tempo atual
}
```

### **Implementação D3.js - Timeline Component**

```javascript
class GraphTimeline {
    constructor(containerId, graphData) {
        this.container = d3.select(`#${containerId}`);
        this.graphData = graphData;
        this.width = 1200;
        this.height = 150;
        this.margin = { top: 20, right: 40, bottom: 40, left: 40 };
        
        this.state = {
            currentTime: null,
            minTime: null,
            maxTime: null,
            isPlaying: false,
            playbackSpeed: 1,
            visibleNodes: new Set(),
            visibleEdges: new Set()
        };
        
        this.init();
    }
    
    init() {
        // Extrai e ordena eventos temporais
        this.timelineData = this.extractTimelineData();
        
        if (this.timelineData.length === 0) {
            console.warn('No timeline data available');
            return;
        }
        
        this.state.minTime = this.timelineData[0].timestamp;
        this.state.maxTime = this.timelineData[this.timelineData.length - 1].timestamp;
        this.state.currentTime = this.state.minTime;
        
        this.render();
    }
    
    extractTimelineData() {
        const events = [];
        
        // Extrai eventos dos nós
        this.graphData.nodes.forEach(node => {
            if (node.metadata.created) {
                events.push({
                    timestamp: new Date(node.metadata.created),
                    type: node.type,
                    action: 'created',
                    nodeId: node.id,
                    metadata: {
                        label: node.label,
                        category: node.metadata.category || node.metadata.entityType,
                        confidence: node.metadata.confidence
                    }
                });
            }
            
            if (node.metadata.updated) {
                events.push({
                    timestamp: new Date(node.metadata.updated),
                    type: node.type,
                    action: 'updated',
                    nodeId: node.id,
                    metadata: {
                        label: node.label,
                        category: node.metadata.category || node.metadata.entityType,
                        confidence: node.metadata.confidence
                    }
                });
            }
            
            if (node.metadata.mergedFrom && node.metadata.mergedFrom.length > 0) {
                events.push({
                    timestamp: new Date(node.metadata.updated || node.metadata.created),
                    type: node.type,
                    action: 'merged',
                    nodeId: node.id,
                    metadata: {
                        label: node.label,
                        category: node.metadata.category || node.metadata.entityType,
                        confidence: node.metadata.confidence
                    }
                });
            }
        });
        
        // Ordena por timestamp
        return events.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    render() {
        // Limpa container
        this.container.html('');
        
        // SVG principal
        const svg = this.container.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        const innerWidth = this.width - this.margin.left - this.margin.right;
        const innerHeight = this.height - this.margin.top - this.margin.bottom;
        
        // Escala de tempo
        this.timeScale = d3.scaleTime()
            .domain([this.state.minTime, this.state.maxTime])
            .range([0, innerWidth]);
        
        // Eixo temporal
        const xAxis = d3.axisBottom(this.timeScale)
            .ticks(10)
            .tickFormat(d3.timeFormat('%d/%m/%Y %H:%M'));
        
        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');
        
        // Agrupa eventos por data (para empilhamento)
        const eventsByDate = d3.group(this.timelineData, d => {
            return d3.timeDay.floor(d.timestamp).getTime();
        });
        
        // Escala de cores por tipo
        const colorScale = d3.scaleOrdinal()
            .domain(['document', 'entity', 'chunk', 'relationship'])
            .range(['#10b981', '#3b82f6', '#8b5cf6', '#f97316']);
        
        // Renderiza eventos como círculos empilhados
        const maxEventsPerDay = d3.max(Array.from(eventsByDate.values()), d => d.length);
        const yScale = d3.scaleLinear()
            .domain([0, maxEventsPerDay])
            .range([innerHeight - 20, 20]);
        
        eventsByDate.forEach((events, dateKey) => {
            const date = new Date(parseInt(dateKey));
            const x = this.timeScale(date);
            
            events.forEach((event, i) => {
                const y = yScale(i);
                
                g.append('circle')
                    .attr('class', 'timeline-event')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 4)
                    .attr('fill', colorScale(event.type))
                    .attr('opacity', 0.7)
                    .attr('data-event-id', `${event.nodeId}-${event.timestamp.getTime()}`)
                    .on('mouseover', (mouseEvent) => {
                        this.showEventTooltip(mouseEvent, event);
                    })
                    .on('mouseout', () => {
                        this.hideEventTooltip();
                    });
            });
        });
        
        // Linha de densidade (heatmap)
        const densityData = this.calculateDensity();
        const densityLine = d3.line()
            .x(d => this.timeScale(d.date))
            .y(d => yScale(d.count))
            .curve(d3.curveBasis);
        
        g.append('path')
            .datum(densityData)
            .attr('class', 'density-line')
            .attr('d', densityLine)
            .attr('fill', 'none')
            .attr('stroke', '#6366f1')
            .attr('stroke-width', 2)
            .attr('opacity', 0.5);
        
        // Área sob a linha
        const densityArea = d3.area()
            .x(d => this.timeScale(d.date))
            .y0(innerHeight - 20)
            .y1(d => yScale(d.count))
            .curve(d3.curveBasis);
        
        g.append('path')
            .datum(densityData)
            .attr('class', 'density-area')
            .attr('d', densityArea)
            .attr('fill', '#6366f1')
            .attr('opacity', 0.1);
        
        // Cursor de tempo atual
        this.timeCursor = g.append('line')
            .attr('class', 'time-cursor')
            .attr('x1', this.timeScale(this.state.currentTime))
            .attr('x2', this.timeScale(this.state.currentTime))
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', '5,5')
            .style('cursor', 'ew-resize')
            .call(d3.drag()
                .on('drag', (event) => {
                    const newX = Math.max(0, Math.min(innerWidth, event.x));
                    const newTime = this.timeScale.invert(newX);
                    this.updateTime(newTime);
                })
            );
        
        // Label do cursor
        this.timeLabel = g.append('text')
            .attr('class', 'time-label')
            .attr('x', this.timeScale(this.state.currentTime))
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#ef4444')
            .text(d3.timeFormat('%d/%m/%Y %H:%M')(this.state.currentTime));
        
        // Controles de playback
        this.renderControls();
        
        // Legenda
        this.renderLegend(g, innerWidth, innerHeight);
    }
    
    calculateDensity() {
        const densityMap = new Map();
        const dayMs = 24 * 60 * 60 * 1000;
        
        // Agrupa por dia
        this.timelineData.forEach(event => {
            const dayKey = Math.floor(event.timestamp.getTime() / dayMs) * dayMs;
            densityMap.set(dayKey, (densityMap.get(dayKey) || 0) + 1);
        });
        
        // Converte para array ordenado
        const density = Array.from(densityMap.entries())
            .map(([timestamp, count]) => ({
                date: new Date(timestamp),
                count: count
            }))
            .sort((a, b) => a.date - b.date);
        
        return density;
    }
    
    renderControls() {
        const controls = this.container.append('div')
            .attr('class', 'timeline-controls')
            .style('margin-top', '10px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '10px');
        
        // Botão Play/Pause
        this.playButton = controls.append('button')
            .attr('class', 'timeline-play-btn')
            .style('padding', '8px 16px')
            .style('background', '#3b82f6')
            .style('color', 'white')
            .style('border', 'none')
            .style('border-radius', '6px')
            .style('cursor', 'pointer')
            .style('font-weight', '500')
            .text('▶ Play')
            .on('click', () => this.togglePlayback());
        
        // Botão Reset
        controls.append('button')
            .attr('class', 'timeline-reset-btn')
            .style('padding', '8px 16px')
            .style('background', '#6b7280')
            .style('color', 'white')
            .style('border', 'none')
            .style('border-radius', '6px')
            .style('cursor', 'pointer')
            .style('font-weight', '500')
            .text('↺ Reset')
            .on('click', () => this.resetTimeline());
        
        // Selector de velocidade
        controls.append('label')
            .style('font-size', '13px')
            .style('color', '#374151')
            .text('Velocidade:');
        
        controls.append('select')
            .attr('class', 'timeline-speed-select')
            .style('padding', '6px 12px')
            .style('border', '1px solid #d1d5db')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .on('change', (event) => {
                this.state.playbackSpeed = parseFloat(event.target.value);
            })
            .selectAll('option')
            .data([
                { value: 0.5, label: '0.5x' },
                { value: 1, label: '1x' },
                { value: 2, label: '2x' },
                { value: 5, label: '5x' },
                { value: 10, label: '10x' }
            ])
            .join('option')
            .attr('value', d => d.value)
            .attr('selected', d => d.value === 1 ? true : null)
            .text(d => d.label);
        
        // Info de eventos visíveis
        this.eventInfo = controls.append('div')
            .style('margin-left', 'auto')
            .style('font-size', '13px')
            .style('color', '#6b7280')
            .text('Nós visíveis: 0 / 0');
    }
    
    renderLegend(g, width, height) {
        const legend = g.append('g')
            .attr('class', 'timeline-legend')
            .attr('transform', `translate(${width - 150}, 10)`);
        
        const legendData = [
            { type: 'document', label: 'Documentos', color: '#10b981' },
            { type: 'entity', label: 'Entidades', color: '#3b82f6' },
            { type: 'chunk', label: 'Chunks', color: '#8b5cf6' },
            { type: 'relationship', label: 'Relações', color: '#f97316' }
        ];
        
        legendData.forEach((item, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);
            
            legendItem.append('circle')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', 4)
                .attr('fill', item.color);
            
            legendItem.append('text')
                .attr('x', 10)
                .attr('y', 4)
                .attr('font-size', '11px')
                .attr('fill', '#374151')
                .text(item.label);
        });
    }
    
    updateTime(newTime) {
        this.state.currentTime = newTime;
        
        // Atualiza cursor
        const x = this.timeScale(newTime);
        this.timeCursor
            .attr('x1', x)
            .attr('x2', x);
        
        this.timeLabel
            .attr('x', x)
            .text(d3.timeFormat('%d/%m/%Y %H:%M')(newTime));
        
        // Calcula nós visíveis até o tempo atual
        this.updateVisibleNodes();
        
        // Notifica o grafo principal para atualizar
        if (this.onTimeChange) {
            this.onTimeChange(this.state);
        }
    }
    
    updateVisibleNodes() {
        this.state.visibleNodes.clear();
        this.state.visibleEdges.clear();
        
        // Adiciona todos os nós criados até o tempo atual
        this.timelineData.forEach(event => {
            if (event.timestamp <= this.state.currentTime) {
                if (event.action === 'created' || event.action === 'updated') {
                    this.state.visibleNodes.add(event.nodeId);
                }
            }
        });
        
        // Atualiza edges visíveis (ambos os nós devem estar visíveis)
        this.graphData.edges.forEach(edge => {
            const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
            
            if (this.state.visibleNodes.has(sourceId) && this.state.visibleNodes.has(targetId)) {
                this.state.visibleEdges.add(edge.id);
            }
        });
        
        // Atualiza info
        this.eventInfo.text(
            `Nós visíveis: ${this.state.visibleNodes.size} / ${this.graphData.nodes.length}`
        );
    }
    
    togglePlayback() {
        this.state.isPlaying = !this.state.isPlaying;
        
        if (this.state.isPlaying) {
            this.playButton.text('⏸ Pause');
            this.startPlayback();
        } else {
            this.playButton.text('▶ Play');
            this.stopPlayback();
        }
    }
    
    startPlayback() {
        const duration = this.state.maxTime - this.state.minTime;
        const fps = 30;
        const frameTime = 1000 / fps;
        const realTimeDuration = 10000; // 10 segundos para toda a timeline em 1x
        const timePerFrame = (duration / (realTimeDuration / frameTime)) * this.state.playbackSpeed;
        
        this.playbackInterval = setInterval(() => {
            const newTime = new Date(this.state.currentTime.getTime() + timePerFrame);
            
            if (newTime >= this.state.maxTime) {
                this.stopPlayback();
                this.state.currentTime = this.state.maxTime;
                this.updateTime(this.state.currentTime);
            } else {
                this.updateTime(newTime);
            }
        }, frameTime);
    }
    
    stopPlayback() {
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
        this.state.isPlaying = false;
        this.playButton.text('▶ Play');
    }
    
    resetTimeline() {
        this.stopPlayback();
        this.state.currentTime = this.state.minTime;
        this.updateTime(this.state.currentTime);
    }
    
    showEventTooltip(event, data) {
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'timeline-event-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', '#fff')
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('z-index', '1000')
            .style('pointer-events', 'none');
        
        const actionLabel = {
            'created': '✨ Criado',
            'updated': '🔄 Atualizado',
            'merged': '🔀 Merged'
        };
        
        tooltip.html(`
            <div style="font-weight: bold; margin-bottom: 4px;">${data.metadata.label}</div>
            <div style="font-size: 10px; color: #aaa;">
                ${actionLabel[data.action]} • ${data.type.toUpperCase()}
            </div>
            <div style="font-size: 10px; margin-top: 4px;">
                ${d3.timeFormat('%d/%m/%Y %H:%M:%S')(data.timestamp)}
            </div>
            ${data.metadata.confidence ? `
                <div style="font-size: 10px; margin-top: 4px;">
                    Confiança: ${(data.metadata.confidence * 100).toFixed(0)}%
                </div>
            ` : ''}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 40) + 'px');
    }
    
    hideEventTooltip() {
        d3.selectAll('.timeline-event-tooltip').remove();
    }
    
    // Método para conectar com o grafo principal
    setTimeChangeCallback(callback) {
        this.onTimeChange = callback;
    }
}
```

### **Integração com o Grafo Principal**

```javascript
// Inicializa o grafo e a timeline
const graphData = {
    nodes: [...], // Seus nós
    edges: [...]  // Suas edges
};

// Cria o grafo D3
const graph = createGraph('#graph-container', graphData);

// Cria a timeline
const timeline = new GraphTimeline('timeline-container', graphData);

// Conecta timeline ao grafo
timeline.setTimeChangeCallback((timelineState) => {
    // Filtra nós visíveis baseado no tempo
    d3.selectAll('.node')
        .transition()
        .duration(200)
        .style('opacity', d => timelineState.visibleNodes.has(d.id) ? 1 : 0.1)
        .style('pointer-events', d => timelineState.visibleNodes.has(d.id) ? 'all' : 'none');
    
    // Filtra edges visíveis
    d3.selectAll('.link')
        .transition()
        .duration(200)
        .style('opacity', d => timelineState.visibleEdges.has(d.id) ? 1 : 0.05);
    
    // Atualiza a simulação
    graph.simulation.alpha(0.3).restart();
});
```

### **HTML Structure**

```html
<div id="visualization-container">
    <!-- Grafo principal -->
    <div id="graph-container" style="width: 100%; height: calc(100vh - 200px);"></div>
    
    <!-- Timeline na parte inferior -->
    <div id="timeline-container" style="width: 100%; height: 200px; background: #f9fafb; padding: 20px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);"></div>
</div>
```

### **CSS para Timeline**

```css
/* Timeline Container */
#timeline-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Timeline Events */
.timeline-event {
    cursor: pointer;
    transition: all 0.2s ease;
}

.timeline-event:hover {
    r: 6;
    opacity: 1 !important;
    stroke: #fff;
    stroke-width: 2;
}

/* Time Cursor */
.time-cursor {
    pointer-events: all;
}

.time-cursor:hover {
    stroke-width: 4;
}

/* Density Line */
.density-line {
    pointer-events: none;
}

/* Controls */
.timeline-controls button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

.timeline-controls button:active {
    transform: translateY(0);
}

/* Tooltip */
.timeline-event-tooltip {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

### **Features da Timeline**

✅ **Visualização de Eventos Temporais**
- Círculos coloridos representando cada evento
- Empilhamento de eventos no mesmo dia
- Linha de densidade mostrando períodos de alta atividade

✅ **Cursor de Tempo Interativo**
- Arraste para navegar na linha do tempo
- Sincronização com o grafo principal
- Label mostrando data/hora atual

✅ **Controles de Playback**
- ▶️ Play/Pause para animação automática
- ↺ Reset para voltar ao início
- Velocidade ajustável (0.5x até 10x)

✅ **Filtro Temporal Automático**
- Mostra apenas nós existentes no tempo selecionado
- Desvanece edges de nós não criados ainda
- Contador de nós visíveis

✅ **Tooltips Informativos**
- Detalhes do evento ao passar o mouse
- Tipo de ação (criado, atualizado, merged)
- Data/hora precisa

✅ **Legenda Visual**
- Cores por tipo de elemento
- Fácil identificação

---

## �🚀 Próximos Passos

### **1. Integração com Backend**
- Modificar `graphHandlers.ts` para incluir todos os metadados
- Calcular métricas de relevância no backend
- Implementar cache de métricas calculadas

### **2. Otimizações de Performance**
- Implementar virtualização para grafos grandes (>1000 nós)
- Web Workers para cálculos de PageRank
- Canvas rendering para grafos muito grandes (fallback do SVG)

### **3. Features Avançadas**
- Agrupamento hierárquico de nós
- **Timeline de evolução do grafo** (implementada abaixo)
- Exportação em formatos (JSON, GraphML, GEXF)
- Layouts alternativos (hierárquico, radial, força-direcionada customizado)

### **4. Analytics**
- Dashboard de estatísticas do grafo
- Detecção de comunidades
- Análise de caminhos críticos
- Identificação de pontos de articulação

---

## 📚 Referências

- **D3.js Force-Directed Graph**: https://d3js.org/
- **D3 Force Simulation**: https://github.com/d3/d3-force
- **Graph Visualization Best Practices**: https://www.graphviz.org/
- **Apache Arrow**: https://arrow.apache.org/
- **LanceDB**: https://lancedb.com/

---

## 🎨 Estilos CSS Recomendados

```css
/* Graph Container */
#graph-container {
    width: 100%;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
    overflow: hidden;
}

/* Nodes */
.node {
    cursor: pointer;
    transition: all 0.3s ease;
}

.node:hover {
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
}

.node.selected {
    filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.9));
}

/* Links */
.link line {
    transition: all 0.3s ease;
}

.link:hover line {
    stroke-width: 4 !important;
    stroke-opacity: 1 !important;
}

/* Tooltip */
.graph-tooltip {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Detail Panel */
#detail-panel {
    position: fixed;
    right: 0;
    top: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
    overflow-y: auto;
    display: none;
    z-index: 1000;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
    }
    to {
        transform: translateX(0);
    }
}

/* Controls */
.graph-controls {
    position: fixed;
    top: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

.graph-controls input,
.graph-controls select {
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
}

.graph-controls button {
    width: 100%;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
}

.graph-controls button:hover {
    background: #2563eb;
}
```

---

## 🎯 Exemplo Base D3.js (Referência)

O código abaixo é o **exemplo base** do D3.js Force-Directed Graph que será enriquecido:

```javascript
chart = {
  // Specify the dimensions of the chart.
  const width = 928;
  const height = 600;

  // Specify the color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // The force simulation mutates links and nodes, so create a copy
  // so that re-evaluating this cell produces the same result.
  const links = data.links.map(d => ({...d}));
  const nodes = data.nodes.map(d => ({...d}));

  // Create a simulation with several forces.
  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);

  // Create the SVG container.
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

  // Add a line for each link, and a circle for each node.
  const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll()
    .data(links)
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

  const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll()
    .data(nodes)
    .join("circle")
      .attr("r", 5)
      .attr("fill", d => color(d.group));

  node.append("title")
      .text(d => d.id);

  // Add a drag behavior.
  node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  // Set the position attributes of links and nodes each time the simulation ticks.
  function ticked() {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
  }

  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  // Update the subject (dragged node) position during drag.
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it's no longer being dragged.
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  // When this cell is re-run, stop the previous simulation. (This doesn't
  // really matter since the target alpha is zero and the simulation will
  // stop naturally, but it's a good practice.)
  invalidation.then(() => simulation.stop());

  return svg.node();
}
```

### **Diferenças entre Base e Versão Enriquecida**

| Aspecto | Base D3.js | Versão Enriquecida Cappy |
|---------|-----------|--------------------------|
| **Nós** | Círculos simples com cor por grupo | Múltiplas formas (círculo, retângulo, diamante) com cores por categoria de arquivo |
| **Tamanho** | Fixo (r=5) | Dinâmico baseado em conexões, confiança e importância |
| **Tooltip** | Apenas ID | Metadados completos (descrição, confidence, timestamps, métricas) |
| **Edges** | Linhas simples | Linhas com labels, tipos (sólida, tracejada, pontilhada), cores e pesos |
| **Interação** | Drag básico | Drag + Click (detail panel) + Hover (tooltip rico) + Double-click (expand) |
| **Dados** | `{id, group}` | Metadados completos (Entity, Document, Chunk, Relationship) |
| **Categorização** | Grupo numérico | Categorias semânticas por tipo de arquivo (.cs, .py, .md, .sql, etc) |
| **Timeline** | Não tem | Timeline interativa com playback e filtro temporal |
| **Filtros** | Não tem | Filtros por tipo, confiança, busca textual, período temporal |
| **Métricas** | Não tem | Importance Score, PageRank, Betweenness, Clustering |

---

## 🎨 Exemplo Visual de Nós com Ícones

### **Cenário: Sistema Cliente-Servidor Full Stack**

```
          Cliente (Entidade)
         /     |      |      \
        /      |      |       \
       /       |      |        \
    🌐HTML  📘TS   🎨CSS   🗄️SQL
   index.ts app.ts style.css database.sql
   (Laranja) (Azul)  (Roxo)   (Laranja)
   
   Frontend    Backend   Estilo   Database
```

### **Interpretação Visual:**

- **Cliente (👤)**: Entidade central (nó círculo com ícone de pessoa)
- **HTML (🌐)**: Documento front-end com ícone de globo/HTML5
- **TypeScript (📘)**: Código backend/frontend com ícone TS azul
- **CSS (🎨)**: Estilos com ícone de paleta de cores
- **SQL (🗄️)**: Database com ícone de banco de dados

**Com um olhar rápido você já sabe:**
- ✅ Cliente tem interface HTML (front-end)
- ✅ Usa TypeScript (tanto front quanto back)
- ✅ Tem estilos CSS próprios
- ✅ Conecta com banco SQL

### **Implementação Completa - Renderização com Ícones**

```javascript
function renderNodes(nodes) {
    const nodeElements = nodeGroup
        .selectAll(".node")
        .data(nodes, d => d.id)
        .join(
            enter => {
                const nodeEnter = enter.append("g")
                    .attr("class", "node")
                    .call(drag(simulation));
                
                nodeEnter.each(function(d) {
                    const node = d3.select(this);
                    const category = getFileCategory(d.metadata.fileName || '');
                    const icon = getNodeIcon(d);
                    
                    // OPÇÃO 1: Emoji simples (recomendado para começar)
                    if (d.type === 'document') {
                        // Círculo de fundo com cor da categoria
                        node.append("circle")
                            .attr("r", d.size)
                            .attr("fill", d.color)
                            .attr("opacity", 0.85)
                            .attr("stroke", "#fff")
                            .attr("stroke-width", 2);
                        
                        // Emoji/ícone centralizado
                        node.append("text")
                            .attr("class", "node-icon")
                            .attr("text-anchor", "middle")
                            .attr("dy", "0.35em")
                            .attr("font-size", `${d.size * 1.3}px`)
                            .attr("pointer-events", "none")
                            .attr("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.3))")
                            .text(icon);
                    } 
                    // Entidades e outros tipos
                    else if (d.type === 'entity') {
                        node.append("circle")
                            .attr("r", d.size)
                            .attr("fill", d.color)
                            .attr("opacity", 0.85)
                            .attr("stroke", "#fff")
                            .attr("stroke-width", 2);
                        
                        node.append("text")
                            .attr("text-anchor", "middle")
                            .attr("dy", "0.35em")
                            .attr("font-size", `${d.size * 1.2}px`)
                            .text("👤");
                    }
                    else if (d.type === 'chunk') {
                        node.append("rect")
                            .attr("width", d.size * 1.5)
                            .attr("height", d.size)
                            .attr("x", -d.size * 0.75)
                            .attr("y", -d.size * 0.5)
                            .attr("rx", 3)
                            .attr("fill", d.color)
                            .attr("opacity", 0.7)
                            .attr("stroke", "#fff")
                            .attr("stroke-width", 1.5);
                        
                        node.append("text")
                            .attr("text-anchor", "middle")
                            .attr("dy", "0.25em")
                            .attr("font-size", `${d.size * 0.8}px`)
                            .text("📄");
                    }
                    
                    // Label abaixo do nó
                    node.append("text")
                        .attr("class", "node-label")
                        .attr("dy", d.size + 14)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "11px")
                        .attr("font-weight", "500")
                        .attr("fill", "#374151")
                        .attr("stroke", "#fff")
                        .attr("stroke-width", "3px")
                        .attr("paint-order", "stroke")
                        .text(d.label.length > 20 ? d.label.substring(0, 17) + "..." : d.label);
                    
                    // Badge de categoria (tag pequena)
                    if (d.type === 'document' && category !== 'unknown') {
                        const categoryLabel = getCategoryLabel(category).split(' ')[1]; // Remove emoji
                        
                        node.append("rect")
                            .attr("x", d.size - 20)
                            .attr("y", -d.size)
                            .attr("width", 40)
                            .attr("height", 14)
                            .attr("rx", 7)
                            .attr("fill", "#1f2937")
                            .attr("opacity", 0.8);
                        
                        node.append("text")
                            .attr("x", d.size)
                            .attr("y", -d.size + 10)
                            .attr("text-anchor", "middle")
                            .attr("font-size", "9px")
                            .attr("font-weight", "600")
                            .attr("fill", "#fff")
                            .text(categoryLabel.substring(0, 5).toUpperCase());
                    }
                    
                    // Badge de conexões (se > 5)
                    if (d.connections.total > 5) {
                        node.append("circle")
                            .attr("cx", d.size * 0.7)
                            .attr("cy", -d.size * 0.7)
                            .attr("r", 9)
                            .attr("fill", "#ef4444")
                            .attr("stroke", "#fff")
                            .attr("stroke-width", 2);
                        
                        node.append("text")
                            .attr("x", d.size * 0.7)
                            .attr("y", -d.size * 0.7 + 1)
                            .attr("text-anchor", "middle")
                            .attr("dy", "0.3em")
                            .attr("font-size", "9px")
                            .attr("font-weight", "bold")
                            .attr("fill", "#fff")
                            .text(d.connections.total);
                    }
                });
                
                // Eventos de interação
                nodeEnter
                    .on("mouseover", handleNodeHover)
                    .on("mouseout", handleNodeOut)
                    .on("click", handleNodeClick)
                    .on("dblclick", handleNodeDoubleClick);
                
                return nodeEnter;
            },
            update => update,
            exit => exit.remove()
        );
    
    return nodeElements;
}
```

### **CSS para Ícones**

```css
/* Ícones de nós */
.node-icon {
    user-select: none;
    -webkit-user-select: none;
    pointer-events: none;
}

/* Labels de nós com outline */
.node-label {
    user-select: none;
    -webkit-user-select: none;
    pointer-events: none;
}

/* Animação de hover nos nós */
.node:hover .node-icon {
    transform: scale(1.2);
    transition: transform 0.2s ease;
}

.node:hover circle,
.node:hover rect {
    stroke-width: 4;
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
    transition: all 0.2s ease;
}
```

### **Legenda Interativa com Ícones**

```javascript
function renderLegend() {
    const legend = d3.select("#legend-container")
        .style("position", "fixed")
        .style("bottom", "20px")
        .style("right", "20px")
        .style("background", "rgba(255, 255, 255, 0.95)")
        .style("padding", "16px")
        .style("border-radius", "12px")
        .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.15)")
        .style("font-size", "13px");
    
    legend.append("div")
        .style("font-weight", "600")
        .style("margin-bottom", "12px")
        .style("color", "#1f2937")
        .text("📊 Tipos de Arquivo");
    
    const categories = [
        { icon: '🔷', label: 'C#', color: '#68217a' },
        { icon: '🐍', label: 'Python', color: '#3572A5' },
        { icon: '📘', label: 'TypeScript', color: '#2b7489' },
        { icon: '📜', label: 'JavaScript', color: '#f1e05a' },
        { icon: '🎨', label: 'CSS', color: '#563d7c' },
        { icon: '🌐', label: 'HTML', color: '#e34c26' },
        { icon: '🗄️', label: 'SQL', color: '#e38c00' },
        { icon: '📝', label: 'Markdown', color: '#10b981' },
        { icon: '📦', label: 'JSON', color: '#292929' },
        { icon: '🐳', label: 'Docker', color: '#384d54' }
    ];
    
    categories.forEach(cat => {
        const item = legend.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "8px")
            .style("cursor", "pointer")
            .on("click", () => filterByCategory(cat.label))
            .on("mouseover", function() {
                d3.select(this)
                    .style("background", "#f3f4f6")
                    .style("margin-left", "4px")
                    .style("transition", "all 0.2s");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .style("background", "transparent")
                    .style("margin-left", "0");
            });
        
        item.append("span")
            .style("font-size", "20px")
            .style("margin-right", "8px")
            .text(cat.icon);
        
        item.append("span")
            .style("color", cat.color)
            .style("font-weight", "500")
            .text(cat.label);
    });
}
```

---

## 📋 Prompts Prontos para LLMs

### **Prompt 1: Geração do Grafo Base Enriquecido**

```
Crie um grafo D3.js force-directed enriquecido para o Cappy Framework com as seguintes especificações:

ESTRUTURA DE DADOS:
- Nós com tipo: 'document', 'entity', 'chunk', 'relationship'
- Metadados completos incluindo: created, updated, confidence, description, properties
- Categorização de documentos por extensão de arquivo (.md, .cs, .py, .ts, .js, .sql, .css, .html, etc)
- Conexões (incoming, outgoing, total) e métricas de relevância (importance, pageRank)

VISUALIZAÇÃO:
- Ícones/Emojis por categoria de arquivo:
  • C# (.cs): 🔷 | Cor: #68217a (roxo escuro)
  • Python (.py): 🐍 | Cor: #3572A5 (azul)
  • TypeScript (.ts): 📘 | Cor: #2b7489 (azul escuro)
  • JavaScript (.js): 📜 | Cor: #f1e05a (amarelo)
  • CSS (.css): 🎨 | Cor: #563d7c (roxo)
  • SQL (.sql): 🗄️ | Cor: #e38c00 (laranja)
  • Markdown (.md): 📝 | Cor: #10b981 (verde)
  • HTML (.html): 🌐 | Cor: #e34c26 (laranja)
  • JSON (.json): 📦 | Cor: #292929 (preto)
  • YAML (.yaml): ⚙️ | Cor: #cb171e (vermelho)
  • Docker: 🐳 | Cor: #384d54 (cinza azulado)
  • React (.tsx): ⚛️ | Cor: #61dafb (azul claro)
  • Vue (.vue): 💚 | Cor: #41b883 (verde)
  
- Renderização de nós:
  • Documentos: círculos com ícone emoji centralizado
  • Entidades: círculos com ícone 👤
  • Chunks: retângulos pequenos com ícone 📄
  • Relacionamentos: diamantes ou linhas com labels
  
- Elementos visuais adicionais:
  • Badge de categoria (ex: "TS", "PY", "SQL") no canto superior direito
  • Badge de conexões (círculo vermelho com número) se >5 conexões
  • Label do arquivo abaixo do nó com stroke branco para legibilidade
  
- Tamanho dinâmico baseado em:
  • Número de conexões (peso 40%)
  • Confiança/confidence (peso 30%)
  • Recência (peso 20%)
  • Número de fontes (peso 10%)

INTERATIVIDADE:
- Tooltip ao hover mostrando: label, tipo, categoria de arquivo, confiança, número de conexões, descrição
- Detail panel lateral ao clicar mostrando metadados completos
- Drag and drop para reposicionar nós
- Zoom e pan
- Badges visuais para nós com >5 conexões

FILTROS:
- Por tipo de nó (document, entity, chunk, relationship)
- Por categoria de arquivo (código, documentação, database, etc)
- Por nível de confiança (slider 0-100%)
- Busca textual em labels e descrições

Use as cores padronizadas do esquema de cores fornecido na documentação.
```

### **Prompt 2: Adicionar Timeline Temporal**

```
Adicione uma timeline interativa ao grafo D3.js com as seguintes features:

VISUALIZAÇÃO:
- Timeline horizontal na parte inferior (altura: 200px)
- Eixo temporal com datas formatadas (dd/mm/yyyy HH:MM)
- Círculos coloridos representando eventos (created, updated, merged)
- Linha de densidade mostrando períodos de alta atividade
- Área preenchida (heatmap) de intensidade temporal
- Legenda com cores por tipo (document, entity, chunk, relationship)

CONTROLES:
- Botão Play/Pause para playback automático
- Botão Reset para voltar ao início
- Selector de velocidade (0.5x, 1x, 2x, 5x, 10x)
- Contador de nós visíveis no tempo atual

CURSOR INTERATIVO:
- Linha vertical vermelha tracejada indicando tempo atual
- Label com data/hora flutuante
- Arrastável para navegar na timeline
- Sincronização com o grafo principal

FILTRO TEMPORAL:
- Mostra apenas nós criados até o tempo selecionado
- Desvanece nós e edges do "futuro" (opacity: 0.1)
- Atualiza em tempo real durante o playback

EVENTOS:
- Extrai timestamps de node.metadata.created e node.metadata.updated
- Agrupa eventos por dia para empilhamento
- Tooltip ao hover mostrando detalhes do evento
- Callback para notificar o grafo principal de mudanças temporais

Integre com o grafo principal usando o método setTimeChangeCallback().
```

### **Prompt 3: Sistema de Métricas e Analytics**

```
Implemente um sistema de métricas de relevância para os nós do grafo:

MÉTRICAS A CALCULAR:
1. Importance Score (0-1):
   - Conexões: 40% (normalizado para max 50 conexões)
   - Confiança: 30% (já normalizado 0-1)
   - Recência: 20% (decai em 1 ano)
   - Fontes: 10% (normalizado para max 10 documentos)

2. PageRank:
   - Damping factor: 0.85
   - Iterações: 20
   - Normalizado por número total de nós

3. Betweenness Centrality (opcional):
   - Mede importância como ponte entre comunidades

4. Clustering Coefficient (opcional):
   - Mede densidade de conexões dos vizinhos

VISUALIZAÇÃO DAS MÉTRICAS:
- Badge de importância em nós com score > 0.8
- Tamanho do nó proporcional ao importance score
- Espessura da borda baseada no PageRank
- Tooltip mostrando todas as métricas
- Detail panel com barras de progresso para cada métrica

DASHBOARD DE ANALYTICS:
- Total de nós por categoria
- Top 10 nós mais importantes
- Distribuição de confiança (histograma)
- Evolução temporal (linha do tempo)
- Matriz de conectividade por tipo
- Detecção de clusters/comunidades

Retorne as métricas calculadas em formato JSON para cache.
```

### **Prompt 4: Filtros e Controles Avançados**

```
Crie um painel de controles avançados para o grafo D3.js:

FILTROS:
1. Por Tipo de Nó:
   - Checkboxes para: Documents, Entities, Chunks, Relationships
   - Atualiza visualização em tempo real

2. Por Categoria de Arquivo:
   - Dropdown com categorias: Código Backend, Código Frontend, Database, Documentação, Estilo/Layout, Config, Dados, Outros
   - Sub-filtros por extensão (.cs, .py, .ts, .js, .sql, .md, etc)

3. Por Confiança:
   - Slider de 0-100%
   - Mostra apenas nós acima do threshold

4. Por Conexões:
   - Range slider (min-max conexões)
   - Destaca hubs (>10 conexões)

5. Busca Textual:
   - Input de busca em tempo real
   - Pesquisa em: label, description, metadata
   - Destaca resultados em amarelo

LAYOUT ALTERNATIVOS:
- Force-directed (padrão)
- Hierárquico (tree layout)
- Radial (circular)
- Grid (organizado em grade)

EXPORTAÇÃO:
- JSON (formato completo)
- CSV (tabela de nós e edges)
- PNG (imagem do grafo atual)
- SVG (vetorial)

ESTILO DO PAINEL:
- Position: fixed, top: 20px, left: 20px
- Background: rgba(255, 255, 255, 0.95)
- Border-radius: 12px
- Box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
- Colapsável (botão toggle)
- Responsivo

Anime as transições de filtro (duration: 300ms).
```

### **Prompt 5: Integração Backend (GraphHandlers.ts)**

```
Atualize o arquivo src/commands/cappyrag/handlers/graphHandlers.ts para enviar metadados completos:

PARA CADA DOCUMENT NODE:
- id, title, fileName, filePath, fileSize
- category (detectar por extensão de arquivo usando fileExtensionToCategory)
- status (processing, completed, failed)
- processingResults (entities count, relationships count, chunks count, processingTime)
- created, updated (ISO timestamps)
- vector (opcional, para semantic search)

PARA CADA ENTITY NODE:
- id, name, type (Person, Technology, Concept, Organization, Location)
- description (LLM-generated)
- properties (custom key-value pairs)
- sourceDocuments (array de IDs), sourceChunks (array de IDs)
- confidence (0-1)
- created, updated
- mergedFrom (array de IDs se houve merge)

PARA CADA CHUNK NODE:
- id, documentId, content, chunkIndex
- startLine, endLine (line numbers)
- entities (array de IDs), relationships (array de IDs)
- created
- contentPreview (primeiras 200 chars)

PARA CADA RELATIONSHIP EDGE:
- id, source, target, type (WORKS_FOR, PART_OF, CONTAINS, etc)
- description
- weight (0-1), confidence (0-1)
- bidirectional (boolean)
- created, updated

CALCULAR NO BACKEND:
- connections.incoming, connections.outgoing, connections.total para cada nó
- metrics.importance usando a fórmula da documentação
- Opcional: metrics.pageRank (pode ser calculado no frontend)

Retorne JSON no formato:
{
  nodes: D3GraphNode[],
  edges: D3GraphEdge[],
  statistics: {
    totalNodes, totalEdges, 
    nodesByType, edgesByType,
    avgConfidence, dateRange
  }
}
```

---

**Documento criado em:** 2025-10-05  
**Versão:** 1.0.0  
**Autor:** Cappy Framework Team  
**Status:** ✅ Ready for Implementation
