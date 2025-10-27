import path from "node:path";
import type { IFileSystem } from "../ports/IFileSystem";
import type { IWebSocketClient } from "../ports/IWebSocketServer";
import type { FileMetadata } from "../../nivel2/infrastructure/services/file-metadata-database";

export interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  summary: string;
  status: string;
  length: number;
  chunks: number;
  created: string;
  updated: string;
  trackId: string;
  processingStartTime?: string;
  processingEndTime?: string;
  currentStep?: string;
  progress?: number;
}

/**
 * Use Case: Gerenciamento de documentos
 */
export class DocumentManagement {
  private fileSystem: IFileSystem;
  private workspaceRoot: string;

  constructor(
    fileSystem: IFileSystem,
    workspaceRoot: string
  ) {
    this.fileSystem = fileSystem;
    this.workspaceRoot = workspaceRoot;
  }

  async refreshDocuments(client: IWebSocketClient): Promise<void> {
    console.log("🔄 [DocumentManagement] Atualizando lista de documentos...");

    const dbPath = path.join(this.workspaceRoot, ".cappy", "file-metadata.db");
    console.log("💾 [DocumentManagement] Database path:", dbPath);

    if (!this.fileSystem.exists(dbPath)) {
      console.log("⚠️  [DocumentManagement] Database não encontrado - retornando lista vazia");
      client.send({
        type: "document/list",
        payload: { documents: [] },
      });
      return;
    }

    try {
      console.log("📦 [DocumentManagement] Importando FileMetadataDatabase...");
      const { FileMetadataDatabase } = await import(
        "../../nivel2/infrastructure/services/file-metadata-database"
      );

      console.log("🔧 [DocumentManagement] Inicializando database...");
      const db = new FileMetadataDatabase(dbPath);
      await db.initialize();

      console.log("📊 [DocumentManagement] Lendo arquivos do database...");
      const allFiles = await db.getAllFiles();
      console.log(`📊 [DocumentManagement] Encontrados ${allFiles.length} arquivos no database`);

      if (allFiles.length > 0) {
        console.log("📋 [DocumentManagement] Primeiros 5 arquivos:");
        allFiles.slice(0, 5).forEach((file, idx) => {
          console.log(`   ${idx + 1}. ${file.fileName} (${file.status})`);
        });
      }

      const documents: DocumentItem[] = allFiles.map((file: FileMetadata) => {
        let status = "pending";
        if (file.status === "completed" || file.status === "processed") {
          status = "completed";
        } else if (file.status === "processing") {
          status = "processing";
        } else if (file.status === "failed" || file.status === "error") {
          status = "failed";
        }

        return {
          id: file.id,
          fileName: file.fileName,
          filePath: file.filePath,
          summary: file.errorMessage || "",
          status,
          length: file.fileSize || 0,
          chunks: file.chunksCount || 0,
          created: file.processingStartedAt || new Date().toISOString(),
          updated: file.processingCompletedAt || new Date().toISOString(),
          trackId: file.id,
          processingStartTime: file.processingStartedAt,
          processingEndTime: file.processingCompletedAt,
          currentStep: file.currentStep,
          progress: file.progress,
        };
      });

      db.close();

      console.log(`📤 [DocumentManagement] Enviando ${documents.length} documentos para o frontend`);
      client.send({
        type: "document/list",
        payload: { documents },
      });

      console.log(`✅ [DocumentManagement] Lista de documentos atualizada (${documents.length} items)`);
    } catch (error) {
      console.error("❌ [DocumentManagement] Erro ao ler database:", error);
      if (error instanceof Error) {
        console.error("   Mensagem:", error.message);
        console.error("   Stack:", error.stack);
      }
      client.send({
        type: "document/list",
        payload: { documents: [] },
      });
    }
  }

  async scanDocuments(client: IWebSocketClient): Promise<void> {
    console.log("\n════════════════════════════════════════════════════════");
    console.log("🔍 [DocumentManagement] INICIANDO SCAN DO WORKSPACE");
    console.log("📂 Workspace Root:", this.workspaceRoot);
    console.log("════════════════════════════════════════════════════════\n");

    client.send({
      type: "document/scan-started",
    });

    try {
      const dbPath = path.join(this.workspaceRoot, ".cappy", "file-metadata.db");
      console.log("💾 [DocumentManagement] Database path:", dbPath);
      
      console.log("📦 [DocumentManagement] Importando FileMetadataDatabase...");
      const { FileMetadataDatabase } = await import(
        "../../nivel2/infrastructure/services/file-metadata-database"
      );
      
      console.log("🔧 [DocumentManagement] Inicializando database...");
      const db = new FileMetadataDatabase(dbPath);
      await db.initialize();
      console.log("✅ [DocumentManagement] Database inicializado");

      const existingFiles = await db.getAllFiles();
      console.log(`📊 [DocumentManagement] Arquivos no database: ${existingFiles.length}`);

      // If database is empty, populate it with workspace files
      if (existingFiles.length === 0) {
        console.log("\n🔄 [DocumentManagement] Database vazio - iniciando scan completo...\n");

        console.log("📦 [DocumentManagement] Importando WorkspaceScanner...");
        const { WorkspaceScanner } = await import(
          "../../nivel2/infrastructure/services/workspace-scanner.js"
        );
        
        console.log("📦 [DocumentManagement] Importando ParserService...");
        const { ParserService } = await import("../../nivel2/infrastructure/services/parser-service.js");
        const parserService = new ParserService();
        console.log("✅ [DocumentManagement] ParserService criado");

        console.log("\n🔧 [DocumentManagement] Configurando scanner...");
        const scanner = new WorkspaceScanner({
          workspaceRoot: this.workspaceRoot,
          repoId: "dev-repo",
          parserService,
          metadataDatabase: db
        });
        console.log("✅ [DocumentManagement] Scanner configurado");

        // Setup progress callback with detailed logging
        scanner.onProgress((progress) => {
          console.log(`📈 [Scan Progress] ${progress.processedFiles}/${progress.totalFiles} - ${progress.status}`);
          if (progress.currentFile) {
            console.log(`   📄 Processando: ${progress.currentFile}`);
          }
          if (progress.errors && progress.errors.length > 0) {
            console.log(`   ⚠️  Erros: ${progress.errors.length}`);
          }
          
          client.send({
            type: "document/scan-progress",
            payload: {
              total: progress.totalFiles,
              processed: progress.processedFiles,
              current: progress.currentFile,
              status: progress.status,
            },
          });
        });

        console.log("🚀 [DocumentManagement] Inicializando scanner...");
        await scanner.initialize();
        console.log("✅ [DocumentManagement] Scanner inicializado");
        
        console.log("\n🔍 [DocumentManagement] Executando scan do workspace...\n");
        await scanner.scanWorkspace();
        
        console.log("\n✅ [DocumentManagement] Workspace scan concluído!");
        
        // Check final count
        const finalFiles = await db.getAllFiles();
        console.log(`📊 [DocumentManagement] Total de arquivos salvos no database: ${finalFiles.length}`);
      } else {
        console.log("ℹ️ [DocumentManagement] Database já contém arquivos - pulando scan");
      }

      console.log("🔒 [DocumentManagement] Fechando database...");
      db.close();
      console.log("✅ [DocumentManagement] Database fechado");

      client.send({
        type: "document/scan-completed",
      });

      console.log("🔄 [DocumentManagement] Atualizando lista de documentos...");
      await this.refreshDocuments(client);
      
      console.log("\n════════════════════════════════════════════════════════");
      console.log("✅ [DocumentManagement] SCAN FINALIZADO COM SUCESSO");
      console.log("════════════════════════════════════════════════════════\n");
    } catch (error) {
      console.log("\n════════════════════════════════════════════════════════");
      console.error("❌ [DocumentManagement] ERRO NO SCAN:", error);
      console.log("════════════════════════════════════════════════════════\n");
      
      if (error instanceof Error) {
        console.error("   Mensagem:", error.message);
        console.error("   Stack:", error.stack);
      }
      
      client.send({
        type: "error",
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
