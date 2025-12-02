/**
 * @fileoverview Checkpoint Tracker - Git-based workspace snapshots
 * @module persistence/CheckpointTracker
 * 
 * Inspired by Cline's CheckpointTracker using shadow Git repository
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import type { CheckpointMetadata } from './types';

const execAsync = promisify(exec);

interface CheckpointTrackerOptions {
  workspacePath: string;
  checkpointsPath: string;
  taskId: string;
}

/**
 * Manages Git-based checkpoints for workspace state
 * 
 * Features:
 * - Shadow Git repository for snapshots
 * - Workspace-wide snapshots
 * - Fast commit/restore operations
 * - Diff between checkpoints
 * - Isolated from user's Git repo
 */
export class CheckpointTracker {
  private workspacePath: string;
  private shadowGitPath: string;
  private taskId: string;
  private isInitialized = false;

  constructor(options: CheckpointTrackerOptions) {
    this.workspacePath = options.workspacePath;
    this.taskId = options.taskId;
    
    // Create workspace-specific shadow git path
    const workspaceHash = this.hashString(this.workspacePath);
    this.shadowGitPath = path.join(options.checkpointsPath, workspaceHash);
  }

  /**
   * Initialize shadow Git repository
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create checkpoints directory
      await fs.mkdir(this.shadowGitPath, { recursive: true });

      // Check if Git repo already exists
      const gitDir = path.join(this.shadowGitPath, '.git');
      const exists = await fs.access(gitDir).then(() => true).catch(() => false);

      if (!exists) {
        // Initialize new Git repo
        await this.execGit('init');
        await this.execGit('config user.name "Cappy"');
        await this.execGit('config user.email "cappy@localhost"');
        
        // Create initial commit
        await this.createInitialCommit();
      }

      this.isInitialized = true;
      console.log('[CheckpointTracker] Initialized for task:', this.taskId);
    } catch (error) {
      console.error('[CheckpointTracker] Failed to initialize:', error);
      throw new Error('Checkpoints initialization failed');
    }
  }

  /**
   * Create initial commit
   */
  private async createInitialCommit(): Promise<void> {
    try {
      // Create .gitkeep file
      const gitkeepPath = path.join(this.shadowGitPath, '.gitkeep');
      await fs.writeFile(gitkeepPath, '');
      
      await this.execGit('add .gitkeep');
      await this.execGit('commit -m "Initial commit"');
    } catch (error) {
      console.error('[CheckpointTracker] Failed to create initial commit:', error);
    }
  }

  /**
   * Create a checkpoint (commit current workspace state)
   */
  async commit(description?: string): Promise<string> {
    this.ensureInitialized();

    try {
      // Sync workspace to shadow git
      await this.syncWorkspaceToShadowGit();

      // Stage all changes
      await this.execGit('add -A');

      // Check if there are changes to commit
      const status = await this.execGit('status --porcelain');
      if (!status.stdout.trim()) {
        // No changes, return latest commit hash
        const hash = await this.getLatestCommitHash();
        return hash;
      }

      // Create commit
      const message = description || `Checkpoint for task ${this.taskId}`;
      await this.execGit(`commit -m "${message}"`);

      // Get commit hash
      const hash = await this.getLatestCommitHash();
      console.log('[CheckpointTracker] Created checkpoint:', hash);
      
      return hash;
    } catch (error) {
      console.error('[CheckpointTracker] Failed to create checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore workspace to a checkpoint
   */
  async restore(commitHash: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Verify commit exists
      await this.execGit(`cat-file -e ${commitHash}^{commit}`);

      // Checkout the commit
      await this.execGit(`checkout ${commitHash} .`);

      // Sync shadow git back to workspace
      await this.syncShadowGitToWorkspace();

      console.log('[CheckpointTracker] Restored to checkpoint:', commitHash);
    } catch (error) {
      console.error('[CheckpointTracker] Failed to restore checkpoint:', error);
      throw error;
    }
  }

  /**
   * Get diff between two checkpoints
   */
  async getDiff(fromHash: string, toHash: string): Promise<string> {
    this.ensureInitialized();

    try {
      const result = await this.execGit(`diff ${fromHash} ${toHash}`);
      return result.stdout;
    } catch (error) {
      console.error('[CheckpointTracker] Failed to get diff:', error);
      throw error;
    }
  }

  /**
   * Get list of all checkpoints
   */
  async listCheckpoints(): Promise<CheckpointMetadata[]> {
    this.ensureInitialized();

    try {
      const result = await this.execGit('log --pretty=format:"%H|%at|%s"');
      const lines = result.stdout.trim().split('\n').filter(Boolean);

      return lines.map((line, index) => {
        const [hash, timestamp, description] = line.split('|');
        return {
          hash,
          timestamp: parseInt(timestamp) * 1000,
          messageIndex: lines.length - index - 1,
          description
        };
      });
    } catch (error) {
      console.error('[CheckpointTracker] Failed to list checkpoints:', error);
      return [];
    }
  }

  /**
   * Get latest commit hash
   */
  private async getLatestCommitHash(): Promise<string> {
    try {
      const result = await this.execGit('rev-parse HEAD');
      return result.stdout.trim();
    } catch (error) {
      throw new Error('Failed to get latest commit hash');
    }
  }

  /**
   * Sync workspace files to shadow Git directory
   */
  private async syncWorkspaceToShadowGit(): Promise<void> {
    try {
      // Copy all files from workspace to shadow git (excluding .git)
      await this.copyDirectory(this.workspacePath, this.shadowGitPath, ['.git', 'node_modules', '.cappy']);
    } catch (error) {
      console.error('[CheckpointTracker] Failed to sync workspace to shadow git:', error);
      throw error;
    }
  }

  /**
   * Sync shadow Git files back to workspace
   */
  private async syncShadowGitToWorkspace(): Promise<void> {
    try {
      // Copy all files from shadow git to workspace (excluding .git)
      await this.copyDirectory(this.shadowGitPath, this.workspacePath, ['.git']);
    } catch (error) {
      console.error('[CheckpointTracker] Failed to sync shadow git to workspace:', error);
      throw error;
    }
  }

  /**
   * Copy directory recursively with exclusions
   */
  private async copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    try {
      await fs.mkdir(dest, { recursive: true });
      
      const entries = await fs.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        if (exclude.includes(entry.name)) {
          continue;
        }

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath, exclude);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error('[CheckpointTracker] Failed to copy directory:', error);
      throw error;
    }
  }

  /**
   * Execute Git command in shadow repository
   */
  private async execGit(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(`git ${command}`, {
        cwd: this.shadowGitPath,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
    } catch (error: any) {
      throw new Error(`Git command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Hash string for directory name
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Ensure initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('[CheckpointTracker] Not initialized. Call initialize() first.');
    }
  }

  /**
   * Get shadow Git configuration work tree
   */
  getShadowGitConfigWorkTree(): string {
    return this.shadowGitPath;
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    this.isInitialized = false;
  }
}
