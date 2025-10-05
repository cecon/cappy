import * as vscode from 'vscode';
import { LightRAGDocument } from '../../../store/lightragLanceDb';
import { getDatabase } from '../utils/databaseHelper';
import { DocumentUploadData } from '../utils/messageTypes';
import { getProcessingQueue } from '../../../services/documentProcessingQueue';
import { getBackgroundProcessor } from '../../../services/backgroundProcessor';

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
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        const chunks = await db.getChunksAsync();
        
        console.log(`[LightRAG] Stats - Docs: ${documents.length}, Entities: ${entities.length}, Relationships: ${relationships.length}, Chunks: ${chunks.length}`);
        
        const stats = {
            documents: documents.length,
            entities: entities.length,
            relationships: relationships.length,
            chunks: chunks.length
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
 * Handle document upload with processing queue
 */
export async function handleDocumentUpload(data: DocumentUploadData, panel: vscode.WebviewPanel): Promise<void> {
    try {
        // Check Copilot availability first
        const processor = getBackgroundProcessor();
        const copilotAvailable = await processor.checkCopilotAvailability();
        
        if (!copilotAvailable) {
            panel.webview.postMessage({
                command: 'uploadError',
                data: { 
                    message: 'GitHub Copilot is required for document processing. Please sign in to GitHub Copilot to enable intelligent analysis.',
                    requiresCopilot: true
                }
            });
            return;
        }

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

        // Add document to processing queue
        const queue = getProcessingQueue();
        const queueId = await queue.enqueue({
            documentId: newDocument.id,
            title: newDocument.title,
            fileName: newDocument.fileName,
            content: newDocument.content
        });

        console.log(`[LightRAG] Document added to processing queue: ${queueId}`);

        // Start processor if not already running
        if (!processor.getQueue().isQueueProcessing()) {
            processor.start();
        }

        panel.webview.postMessage({
            command: 'documentAdded',
            data: {
                ...newDocument,
                queueId,
                processingMessage: 'Document queued for intelligent analysis with Copilot'
            }
        });

        vscode.window.showInformationMessage(
            `✨ Document "${data.title}" added to processing queue. Copilot will analyze it chunk by chunk.`
        );

        // Old simulation code removed - now using real background processing
        /*
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
            let createdRelationshipsCount = 0;
            const targetRelCount = Math.floor(createdEntities.length / 2);
            console.log(`[LightRAG] Creating ${targetRelCount} relationships between ${createdEntities.length} entities`);
            
            for (let i = 0; i < targetRelCount; i++) {
                const sourceIdx = i;
                const targetIdx = (i + 1) % createdEntities.length;
                
                try {
                    const relId = await db.addRelationship({
                        source: createdEntities[sourceIdx],
                        target: createdEntities[targetIdx],
                        type: 'co-occurs',
                        description: 'Found together in document',
                        weight: 1.0,
                        documentIds: [newDocument.id]
                    });
                    createdRelationshipsCount++;
                    console.log(`[LightRAG] Created relationship ${i + 1}/${targetRelCount}: ${relId} (${createdEntities[sourceIdx]} -> ${createdEntities[targetIdx]})`);
                } catch (error) {
                    console.error(`[LightRAG] Error creating relationship ${i}:`, error);
                }
            }
            
            console.log(`[LightRAG] Successfully created ${createdRelationshipsCount} relationships`);
            
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
                relationships: createdRelationshipsCount,
                chunks: chunks,
                processingTime: '00:02:15'
            };
            newDocument.updated = new Date().toISOString();
            
            panel.webview.postMessage({
                command: 'documentUpdated',
                data: newDocument
            });
        }, 3000);
        */

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

/**
 * Handle generating description using Copilot
 */
export async function handleGenerateDescription(data: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
        const { fileName, fileExtension, fileSize, contentPreview, title } = data;
        
        // Prepare prompt for GitHub Copilot
        const prompt = `Analyze this document and provide:
1. A concise description (2-3 sentences)
2. An appropriate category (e.g., Documentation, Code, Research, Tutorial, Reference)
3. Suggested chunk size based on content type

Document: ${fileName}
Extension: ${fileExtension}
Size: ${fileSize} bytes
${title ? `Title: ${title}` : ''}

Content preview:
${contentPreview}

Respond in JSON format:
{
    "description": "...",
    "category": "...",
    "chunkInfo": "Suggested chunk size: X tokens based on Y"
}`;

        // Use VS Code's language model API (Copilot)
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });

        if (models.length === 0) {
            throw new Error('No Copilot model available');
        }

        const model = models[0];
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        
        let fullResponse = '';
        for await (const chunk of response.text) {
            fullResponse += chunk;
        }

        // Parse JSON response
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            panel.webview.postMessage({
                command: 'descriptionGenerated',
                data: {
                    description: result.description,
                    category: result.category,
                    chunkInfo: result.chunkInfo
                }
            });
        } else {
            throw new Error('Failed to parse Copilot response');
        }

    } catch (error) {
        console.error('[LightRAG] Failed to generate description:', error);
        panel.webview.postMessage({
            command: 'uploadError',
            data: { message: error instanceof Error ? error.message : 'Failed to generate description' }
        });
    }
}
