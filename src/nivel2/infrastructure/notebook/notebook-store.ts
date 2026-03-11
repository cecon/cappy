/**
 * @fileoverview Notebook store — CRUD for notebook JSON files
 * @module infrastructure/notebook/notebook-store
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NotebookData, Chunk } from '../../../domains/notebook/notebook-types';
import { TextChunker } from './text-chunker';
import { HashEmbedder } from './embedder';
import { GraphBuilder } from './graph-builder';

const NOTEBOOKS_DIR = '.cappy/notebooks';

/**
 * CRUD operations for notebook JSON files.
 * Notebooks live in `.cappy/notebooks/<name>/notebook.json` in the workspace.
 */
export class NotebookStore {
  private readonly workspaceRoot: string;
  private readonly chunker: TextChunker;
  private readonly embedder: HashEmbedder;
  private readonly graphBuilder: GraphBuilder;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.chunker = new TextChunker();
    this.embedder = new HashEmbedder();
    this.graphBuilder = new GraphBuilder();
  }

  /**
   * Get the path to a notebook directory.
   */
  private getNotebookDir(notebookName: string): string {
    return path.join(this.workspaceRoot, NOTEBOOKS_DIR, notebookName);
  }

  /**
   * Get the path to a notebook JSON file.
   */
  private getNotebookPath(notebookName: string): string {
    return path.join(this.getNotebookDir(notebookName), 'notebook.json');
  }

  /**
   * Load a notebook from disk.
   * Returns null if the notebook doesn't exist.
   */
  load(notebookName: string): NotebookData | null {
    const filePath = this.getNotebookPath(notebookName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as NotebookData;
    } catch {
      console.error(`[NotebookStore] Failed to load notebook: ${filePath}`);
      return null;
    }
  }

  /**
   * Save a notebook to disk.
   */
  save(notebookName: string, data: NotebookData): void {
    const dir = this.getNotebookDir(notebookName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = this.getNotebookPath(notebookName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * List all notebooks in the workspace.
   */
  listNotebooks(): string[] {
    const baseDir = path.join(this.workspaceRoot, NOTEBOOKS_DIR);
    if (!fs.existsSync(baseDir)) return [];

    return fs.readdirSync(baseDir).filter(name => {
      const notebookFile = path.join(baseDir, name, 'notebook.json');
      return fs.existsSync(notebookFile);
    });
  }

  /**
   * Create a new empty notebook.
   */
  create(notebookName: string): NotebookData {
    const data: NotebookData = {
      meta: {
        name: notebookName,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        sources: [],
        embeddingDim: this.embedder.dimension,
      },
      chunks: [],
      graph: { nodes: [], edges: [] },
    };
    this.save(notebookName, data);
    return data;
  }

  /**
   * Ingest a source file into a notebook.
   * Chunks the file, generates embeddings, and rebuilds the graph.
   */
  addSource(notebookName: string, filePath: string): NotebookData {
    // Load or create notebook
    let notebook = this.load(notebookName);
    if (!notebook) {
      notebook = this.create(notebookName);
    }

    // Resolve file path
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const relPath = path.relative(this.workspaceRoot, absPath);

    // Remove existing chunks from this source (re-ingest)
    notebook.chunks = notebook.chunks.filter(c => c.source !== relPath);
    notebook.meta.sources = notebook.meta.sources.filter(s => s !== relPath);

    // Read and chunk the file
    const text = fs.readFileSync(absPath, 'utf-8');
    const chunkedTexts = this.chunker.chunk(text, relPath);

    // Generate IDs starting from the current max
    const maxId = notebook.chunks.reduce((max, c) => {
      const num = parseInt(c.id.replace('c_', ''), 10);
      return num > max ? num : max;
    }, 0);

    const newChunks: Chunk[] = chunkedTexts.map((ct, i) => ({
      id: `c_${String(maxId + i + 1).padStart(3, '0')}`,
      source: relPath,
      text: ct.text,
      embedding: this.embedder.embed(ct.text),
      metadata: ct.metadata,
    }));

    // Add new chunks and source
    notebook.chunks.push(...newChunks);
    notebook.meta.sources.push(relPath);
    notebook.meta.updated = new Date().toISOString();

    // Rebuild knowledge graph with ALL chunks
    notebook.graph = this.graphBuilder.build(notebook.chunks);

    // Save
    this.save(notebookName, notebook);

    return notebook;
  }

  /**
   * Remove a source file and its chunks from a notebook.
   */
  removeSource(notebookName: string, filePath: string): NotebookData | null {
    const notebook = this.load(notebookName);
    if (!notebook) return null;

    const relPath = path.isAbsolute(filePath)
      ? path.relative(this.workspaceRoot, filePath)
      : filePath;

    notebook.chunks = notebook.chunks.filter(c => c.source !== relPath);
    notebook.meta.sources = notebook.meta.sources.filter(s => s !== relPath);
    notebook.meta.updated = new Date().toISOString();

    // Rebuild graph
    notebook.graph = this.graphBuilder.build(notebook.chunks);

    this.save(notebookName, notebook);
    return notebook;
  }
}
