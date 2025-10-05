import * as vscode from 'vscode';
import { LightRAGDocument } from '../../../store/lightragLanceDb';
import { getDatabase } from '../utils/databaseHelper';
import { DocumentUploadData } from '../utils/messageTypes';

/**
 * Generate unique document ID
 */
function generateDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle loading all documents
 */
export async function handleLoadDocuments(panel: vscode.WebviewPanel): Promise<void> {
    try {
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        const stats = {
            documents: documents.length,
            entities: (await db.getEntitiesAsync()).length,
            relationships: (await db.getRelationshipsAsync()).length,
            chunks: (await db.getChunksAsync()).length
        };

        panel.webview.postMessage({
            command: 'documentsLoaded',
            data: {
                documents,
                stats
            }
        });
    } catch (error) {
        panel.webview.postMessage({
            command: 'loadError',
            data: { message: error instanceof Error ? error.message : 'Failed to load documents' }
        });
    }
}

/**
 * Handle document upload with processing
 */
export async function handleDocumentUpload(data: DocumentUploadData, panel: vscode.WebviewPanel): Promise<void> {
    try {
        const db = getDatabase();
        await db.initialize();
        
        // Create document object
        const newDocument: LightRAGDocument = {
            id: generateDocumentId(),
            title: data.title,
            description: data.description || '',
            category: data.category || 'general',
            tags: [],
            filePath: data.fileName,
            fileName: data.fileName,
            fileSize: data.fileSize,
            content: data.content,
            status: 'processing',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Add document to database
        await db.addDocument(newDocument);

        // Simulate processing and create graph entities
        setTimeout(async () => {
            newDocument.status = 'completed';
            
            // Extract simple entities from content (words that appear frequently)
            const words = data.content.split(/\W+/).filter((w: string) => w.length > 5);
            const wordFreq: { [key: string]: number } = {};
            words.forEach((word: string) => {
                const lower = word.toLowerCase();
                wordFreq[lower] = (wordFreq[lower] || 0) + 1;
            });
            
            // Get top entities
            const topEntities = Object.entries(wordFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([word]) => word);
            
            // Create entities
            const createdEntities: string[] = [];
            for (const entity of topEntities) {
                const entityId = await db.addEntity({
                    name: entity.charAt(0).toUpperCase() + entity.slice(1),
                    type: 'keyword',
                    description: 'Extracted from ' + newDocument.title,
                    documentIds: [newDocument.id]
                });
                createdEntities.push(entityId);
            }
            
            // Create relationships between entities
            const createdRelationships = Math.floor(createdEntities.length / 2);
            for (let i = 0; i < createdRelationships; i++) {
                const sourceIdx = i;
                const targetIdx = (i + 1) % createdEntities.length;
                await db.addRelationship({
                    source: createdEntities[sourceIdx],
                    target: createdEntities[targetIdx],
                    type: 'co-occurs',
                    description: 'Found together in document',
                    weight: 1.0,
                    documentIds: [newDocument.id]
                });
            }
            
            // Create chunks
            const chunkSize = 1000;
            const chunks = Math.ceil(data.content.length / chunkSize);
            for (let i = 0; i < chunks; i++) {
                await db.addChunk({
                    documentId: newDocument.id,
                    content: data.content.substring(i * chunkSize, (i + 1) * chunkSize),
                    startPosition: i * chunkSize,
                    endPosition: Math.min((i + 1) * chunkSize, data.content.length),
                    chunkIndex: i,
                    entities: createdEntities.slice(0, 3),
                    relationships: []
                });
            }
            
            newDocument.processingResults = {
                entities: createdEntities.length,
                relationships: createdRelationships,
                chunks: chunks,
                processingTime: '00:02:15'
            };
            newDocument.updated = new Date().toISOString();
            
            panel.webview.postMessage({
                command: 'documentUpdated',
                data: newDocument
            });
        }, 3000);

        panel.webview.postMessage({
            command: 'documentAdded',
            data: newDocument
        });

        vscode.window.showInformationMessage(`Document "${data.title}" uploaded successfully`);
    } catch (error) {
        panel.webview.postMessage({
            command: 'uploadError',
            data: { message: error instanceof Error ? error.message : 'Failed to upload document' }
        });
        vscode.window.showErrorMessage('Failed to upload document');
    }
}

/**
 * Handle document deletion
 */
export async function handleDocumentDelete(documentId: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
        const db = getDatabase();
        await db.initialize();
        await db.deleteDocument(documentId);

        panel.webview.postMessage({
            command: 'documentDeleted',
            data: { id: documentId }
        });

        vscode.window.showInformationMessage('Document deleted successfully');
    } catch (error) {
        panel.webview.postMessage({
            command: 'deleteError',
            data: { message: error instanceof Error ? error.message : 'Failed to delete document' }
        });
        vscode.window.showErrorMessage('Failed to delete document');
    }
}

/**
 * Handle clearing all documents
 */
export async function handleClearAllDocuments(panel: vscode.WebviewPanel): Promise<void> {
    try {
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        
        // Delete all documents
        for (const doc of documents) {
            await db.deleteDocument(doc.id);
        }

        panel.webview.postMessage({
            command: 'documentsCleared'
        });

        vscode.window.showInformationMessage('All documents cleared successfully');
    } catch (error) {
        vscode.window.showErrorMessage('Failed to clear documents');
    }
}
