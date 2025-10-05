/**
 * Message types for webview communication
 */

export interface WebviewMessage {
    command: string;
    [key: string]: any;
}

export interface DocumentUploadData {
    title: string;
    description?: string;
    category?: string;
    fileName: string;
    fileSize: number;
    content: string;
}

export interface QuerySubmitData {
    query: string;
}
