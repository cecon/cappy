import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Hashing utilities for chunk identification and change detection
 * Uses BLAKE3 via @noble/hashes for fast, secure hashing
 */

export interface HashResult {
    /** The hash value as hex string */
    hash: string;
    /** Algorithm used */
    algorithm: 'blake3';
    /** Input size in bytes */
    inputSize: number;
}

/**
 * Generate a stable hash for chunk content
 * Combines text content with position information for unique identification
 */
export function hashChunk(
    content: string, 
    filePath: string, 
    startLine: number, 
    endLine: number
): HashResult {
    // Create a stable input that includes content + position
    const input = JSON.stringify({
        content: content.trim(),
        path: filePath,
        startLine,
        endLine
    });
    
    const hashBytes = blake3(input);
    const hash = bytesToHex(hashBytes);
    
    return {
        hash,
        algorithm: 'blake3',
        inputSize: Buffer.byteLength(input, 'utf8')
    };
}

/**
 * Generate hash for text content only (for change detection)
 */
export function hashText(content: string): string {
    const hashBytes = blake3(content.trim());
    return bytesToHex(hashBytes);
}

/**
 * Generate hash for file metadata (path, size, mtime)
 */
export function hashFile(filePath: string, stats: { size: number, mtime: Date }): string {
    const input = JSON.stringify({
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.toISOString()
    });
    
    const hashBytes = blake3(input);
    return bytesToHex(hashBytes);
}

/**
 * Generate hash for a chunk's vector embedding
 */
export function hashVector(vector: number[]): string {
    // Convert numbers to string with fixed precision to ensure consistency
    const vectorString = vector.map(n => n.toFixed(6)).join(',');
    
    const hashBytes = blake3(vectorString);
    return bytesToHex(hashBytes);
}

/**
 * Generate stable ID for graph nodes
 */
export function hashNodeId(type: string, label: string, properties: any): string {
    const input = JSON.stringify({
        type,
        label,
        properties: Object.keys(properties).sort().reduce((acc, key) => {
            acc[key] = properties[key];
            return acc;
        }, {} as any)
    });
    
    const hashBytes = blake3(input);
    return bytesToHex(hashBytes).substring(0, 16); // Shorter ID for nodes
}

/**
 * Generate stable ID for graph edges
 */
export function hashEdgeId(sourceId: string, targetId: string, type: string): string {
    const input = `${sourceId}->${targetId}:${type}`;
    
    const hashBytes = blake3(input);
    return bytesToHex(hashBytes).substring(0, 16); // Shorter ID for edges
}

/**
 * Check if two hash results are equal
 */
export function hashEquals(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
}

/**
 * Generate a short hash for display purposes
 */
export function shortHash(hash: string, length: number = 8): string {
    return hash.substring(0, length);
}

/**
 * Validate hash format
 */
export function isValidHash(hash: string): boolean {
    return /^[a-f0-9]{64}$/.test(hash); // BLAKE3 hex format (32 bytes = 64 hex chars)
}

/**
 * Utility to create a deterministic hash from any object
 */
export function hashObject(obj: any): string {
    const sortedString = JSON.stringify(obj, Object.keys(obj).sort());
    const hashBytes = blake3(sortedString);
    return bytesToHex(hashBytes);
}