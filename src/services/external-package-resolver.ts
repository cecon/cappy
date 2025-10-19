/**
 * @fileoverview External Package Resolver - Resolves npm/pnpm/yarn/bun packages
 * @module services/external-package-resolver
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

/**
 * Package resolution result
 */
export interface PackageResolution {
  /** Package name (e.g., "react") */
  name: string;
  /** Subpath if any (e.g., "jsx-runtime" from "react/jsx-runtime") */
  subpath: string | null;
  /** Version range from package.json (e.g., "^18.2.0") */
  range: string | null;
  /** Resolved version from lockfile or node_modules (e.g., "18.3.1") */
  resolved: string | null;
  /** Package manager detected */
  manager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'url' | 'git' | 'unknown';
  /** Lockfile used for resolution */
  lockfile: string | null;
  /** Integrity hash from lockfile */
  integrity: string | null;
  /** Workspace path if internal monorepo package */
  workspace: string | null;
  /** Git commit if git dependency */
  commit: string | null;
  /** URL if URL dependency */
  url: string | null;
  /** Resolution source */
  source: 'lockfile' | 'node_modules' | 'package.json' | 'url' | 'git' | 'unknown';
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Cache entry for package.json content
 */
interface PackageJsonCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>;
  hash: string;
}

/**
 * Cache entry for lockfile content
 */
interface LockfileCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  hash: string;
  type: 'pnpm' | 'npm' | 'yarn' | 'bun';
}

/**
 * External Package Resolver
 * Resolves external npm packages with high confidence using lockfiles and node_modules
 */
export class ExternalPackageResolver {
  private workspaceRoot: string;
  private packageJsonCache: Map<string, PackageJsonCache> = new Map();
  private lockfileCache: LockfileCache | null = null;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Determines if an import specifier is external (not relative)
   */
  isExternalImport(specifier: string): boolean {
    return !specifier.startsWith('.') && !specifier.startsWith('/');
  }

  /**
   * Resolves an external package import
   */
  async resolveExternalImport(specifier: string, fromFile: string): Promise<PackageResolution> {
    // Parse package name and subpath
    const { name, subpath } = this.parseSpecifier(specifier);

    // Check if it's a URL dependency
    if (this.isUrlDependency(specifier)) {
      return this.resolveUrlDependency(specifier);
    }

    // Check if it's a git dependency
    if (this.isGitDependency(specifier)) {
      return this.resolveGitDependency(specifier);
    }

    // Try to resolve from lockfile (highest confidence)
    const lockfileResolution = await this.resolveFromLockfile(name, fromFile);
    if (lockfileResolution) {
      lockfileResolution.subpath = subpath;
      return lockfileResolution;
    }

    // Try to resolve from node_modules (medium confidence)
    const nodeModulesResolution = await this.resolveFromNodeModules(name, fromFile);
    if (nodeModulesResolution) {
      nodeModulesResolution.subpath = subpath;
      return nodeModulesResolution;
    }

    // Fallback to package.json only (low confidence)
    const packageJsonResolution = await this.resolveFromPackageJson(name, fromFile);
    packageJsonResolution.subpath = subpath;
    return packageJsonResolution;
  }

  /**
   * Parses a package specifier into name and subpath
   * Examples:
   *   "react" -> { name: "react", subpath: null }
   *   "react/jsx-runtime" -> { name: "react", subpath: "jsx-runtime" }
   *   "@scope/pkg" -> { name: "@scope/pkg", subpath: null }
   *   "@scope/pkg/sub" -> { name: "@scope/pkg", subpath: "sub" }
   */
  private parseSpecifier(specifier: string): { name: string; subpath: string | null } {
    if (specifier.startsWith('@')) {
      // Scoped package
      const parts = specifier.split('/');
      if (parts.length >= 2) {
        const name = `${parts[0]}/${parts[1]}`;
        const subpath = parts.length > 2 ? parts.slice(2).join('/') : null;
        return { name, subpath };
      }
    }

    // Non-scoped package
    const slashIndex = specifier.indexOf('/');
    if (slashIndex === -1) {
      return { name: specifier, subpath: null };
    }

    return {
      name: specifier.substring(0, slashIndex),
      subpath: specifier.substring(slashIndex + 1)
    };
  }

  /**
   * Checks if specifier is a URL dependency
   */
  private isUrlDependency(specifier: string): boolean {
    return specifier.startsWith('http://') || specifier.startsWith('https://');
  }

  /**
   * Checks if specifier is a git dependency
   */
  private isGitDependency(specifier: string): boolean {
    return specifier.startsWith('git+') || specifier.includes('github:') || specifier.includes('gitlab:');
  }

  /**
   * Resolves a URL dependency
   */
  private resolveUrlDependency(url: string): PackageResolution {
    // Extract version from URL if possible (e.g., https://esm.sh/react@18.3.1)
    const versionMatch = url.match(/@([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : null;

    const { name } = this.parseSpecifier(url.split('/').pop() || url);

    return {
      name,
      subpath: null,
      range: null,
      resolved: version,
      manager: 'url',
      lockfile: null,
      integrity: null,
      workspace: null,
      commit: null,
      url,
      source: 'url',
      confidence: 0.8
    };
  }

  /**
   * Resolves a git dependency
   */
  private resolveGitDependency(specifier: string): PackageResolution {
    // Extract commit hash if available
    const commitMatch = specifier.match(/#([a-f0-9]{7,40})/);
    const commit = commitMatch ? commitMatch[1] : null;

    const { name } = this.parseSpecifier(specifier.split('#')[0]);

    return {
      name,
      subpath: null,
      range: null,
      resolved: commit,
      manager: 'git',
      lockfile: null,
      integrity: null,
      workspace: null,
      commit,
      url: specifier,
      source: 'git',
      confidence: 0.9
    };
  }

  /**
   * Resolves from lockfile (pnpm, npm, yarn, bun)
   */
  private async resolveFromLockfile(name: string, _fromFile: string): Promise<PackageResolution | null> {
    const lockfile = await this.loadLockfile();
    if (!lockfile) return null;

    switch (lockfile.type) {
      case 'pnpm':
        return this.resolveFromPnpmLock(name, lockfile.content);
      case 'npm':
        return this.resolveFromNpmLock(name, lockfile.content);
      case 'yarn':
        return this.resolveFromYarnLock(name, lockfile.content);
      case 'bun':
        return this.resolveFromBunLock(name, lockfile.content);
      default:
        return null;
    }
  }

  /**
   * Loads and caches lockfile
   */
  private async loadLockfile(): Promise<LockfileCache | null> {
    if (this.lockfileCache) return this.lockfileCache;

    // Try pnpm-lock.yaml
    const pnpmLockPath = path.join(this.workspaceRoot, 'pnpm-lock.yaml');
    if (fs.existsSync(pnpmLockPath)) {
      const content = fs.readFileSync(pnpmLockPath, 'utf-8');
      const parsed = yaml.parse(content);
      this.lockfileCache = {
        content: parsed,
        hash: this.hashContent(content),
        type: 'pnpm'
      };
      return this.lockfileCache;
    }

    // Try package-lock.json
    const npmLockPath = path.join(this.workspaceRoot, 'package-lock.json');
    if (fs.existsSync(npmLockPath)) {
      const content = fs.readFileSync(npmLockPath, 'utf-8');
      this.lockfileCache = {
        content: JSON.parse(content),
        hash: this.hashContent(content),
        type: 'npm'
      };
      return this.lockfileCache;
    }

    // Try yarn.lock
    const yarnLockPath = path.join(this.workspaceRoot, 'yarn.lock');
    if (fs.existsSync(yarnLockPath)) {
      const content = fs.readFileSync(yarnLockPath, 'utf-8');
      this.lockfileCache = {
        content: this.parseYarnLock(content),
        hash: this.hashContent(content),
        type: 'yarn'
      };
      return this.lockfileCache;
    }

    // Try bun.lockb
    const bunLockPath = path.join(this.workspaceRoot, 'bun.lockb');
    if (fs.existsSync(bunLockPath)) {
      // bun.lockb is binary, we can't parse it easily
      // Just return a marker that bun is used
      this.lockfileCache = {
        content: {},
        hash: '',
        type: 'bun'
      };
      return this.lockfileCache;
    }

    return null;
  }

  /**
   * Resolves from pnpm-lock.yaml
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveFromPnpmLock(name: string, lockContent: any): PackageResolution | null {
    if (!lockContent.packages) return null;

    // Search for package in packages
    for (const [key, value] of Object.entries(lockContent.packages)) {
      if (key.includes(`/${name}@`) || key.includes(`/${name}/`)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkg = value as any;
        return {
          name,
          subpath: null,
          range: null,
          resolved: pkg.version || this.extractVersionFromKey(key),
          manager: 'pnpm',
          lockfile: 'pnpm-lock.yaml',
          integrity: pkg.integrity || null,
          workspace: null,
          commit: null,
          url: null,
          source: 'lockfile',
          confidence: 1.0
        };
      }
    }

    return null;
  }

  /**
   * Resolves from package-lock.json
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveFromNpmLock(name: string, lockContent: any): PackageResolution | null {
    if (!lockContent.packages) return null;

    // Search in packages
    for (const [key, value] of Object.entries(lockContent.packages)) {
      if (key.includes(`node_modules/${name}`)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkg = value as any;
        return {
          name,
          subpath: null,
          range: null,
          resolved: pkg.version || null,
          manager: 'npm',
          lockfile: 'package-lock.json',
          integrity: pkg.integrity || null,
          workspace: null,
          commit: null,
          url: null,
          source: 'lockfile',
          confidence: 1.0
        };
      }
    }

    return null;
  }

  /**
   * Resolves from yarn.lock
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveFromYarnLock(name: string, lockContent: any): PackageResolution | null {
    for (const [key, value] of Object.entries(lockContent)) {
      if (key.startsWith(`${name}@`)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkg = value as any;
        return {
          name,
          subpath: null,
          range: null,
          resolved: pkg.version || null,
          manager: 'yarn',
          lockfile: 'yarn.lock',
          integrity: pkg.integrity || null,
          workspace: null,
          commit: null,
          url: null,
          source: 'lockfile',
          confidence: 1.0
        };
      }
    }

    return null;
  }

  /**
   * Resolves from bun.lockb
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  private resolveFromBunLock(_name: string, _lockContent: any): PackageResolution | null {
    // bun.lockb is binary and hard to parse
    // We'll fallback to node_modules resolution
    return null;
  }

  /**
   * Parses yarn.lock format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseYarnLock(content: string): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    const lines = content.split('\n');
    let currentKey: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentObj: any = {};

    for (const line of lines) {
      if (line.trim() === '' || line.startsWith('#')) continue;

      if (line.match(/^[^\s]/)) {
        // New package entry
        if (currentKey) {
          result[currentKey] = currentObj;
        }
        currentKey = line.replace(':', '').trim();
        currentObj = {};
      } else {
        // Property
        const match = line.match(/^\s+(\w+)\s+"?(.+?)"?$/);
        if (match) {
          currentObj[match[1]] = match[2];
        }
      }
    }

    if (currentKey) {
      result[currentKey] = currentObj;
    }

    return result;
  }

  /**
   * Resolves from node_modules
   */
  private async resolveFromNodeModules(name: string, fromFile: string): Promise<PackageResolution | null> {
    let currentDir = path.dirname(fromFile);

    // Walk up the directory tree looking for node_modules
    while (currentDir !== path.dirname(currentDir)) {
      const nodeModulesPath = path.join(currentDir, 'node_modules', name, 'package.json');
      
      if (fs.existsSync(nodeModulesPath)) {
        try {
          const content = fs.readFileSync(nodeModulesPath, 'utf-8');
          const pkg = JSON.parse(content);
          
          return {
            name,
            subpath: null,
            range: null,
            resolved: pkg.version || null,
            manager: 'unknown',
            lockfile: null,
            integrity: null,
            workspace: null,
            commit: null,
            url: null,
            source: 'node_modules',
            confidence: 0.95
          };
        } catch {
          // Continue searching
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Resolves from package.json only (lowest confidence)
   */
  private async resolveFromPackageJson(name: string, fromFile: string): Promise<PackageResolution> {
    const packageJson = await this.loadPackageJson(fromFile);
    
    if (packageJson) {
      const deps = {
        ...packageJson.content.dependencies,
        ...packageJson.content.devDependencies,
        ...packageJson.content.peerDependencies,
        ...packageJson.content.optionalDependencies
      };

      const range = deps[name] || null;

      // Check if it's a workspace dependency
      if (range?.startsWith('workspace:')) {
        return {
          name,
          subpath: null,
          range,
          resolved: null,
          manager: 'unknown',
          lockfile: null,
          integrity: null,
          workspace: range.replace('workspace:', ''),
          commit: null,
          url: null,
          source: 'package.json',
          confidence: 0.7
        };
      }

      return {
        name,
        subpath: null,
        range,
        resolved: null,
        manager: 'unknown',
        lockfile: null,
        integrity: null,
        workspace: null,
        commit: null,
        url: null,
        source: 'package.json',
        confidence: 0.7
      };
    }

    // Completely unknown package
    return {
      name,
      subpath: null,
      range: null,
      resolved: null,
      manager: 'unknown',
      lockfile: null,
      integrity: null,
      workspace: null,
      commit: null,
      url: null,
      source: 'unknown',
      confidence: 0.5
    };
  }

  /**
   * Loads and caches package.json
   */
  private async loadPackageJson(fromFile: string): Promise<PackageJsonCache | null> {
    let currentDir = path.dirname(fromFile);

    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (this.packageJsonCache.has(packageJsonPath)) {
        return this.packageJsonCache.get(packageJsonPath)!;
      }

      if (fs.existsSync(packageJsonPath)) {
        try {
          const content = fs.readFileSync(packageJsonPath, 'utf-8');
          const parsed = JSON.parse(content);
          const cache: PackageJsonCache = {
            content: parsed,
            hash: this.hashContent(content)
          };
          this.packageJsonCache.set(packageJsonPath, cache);
          return cache;
        } catch {
          // Continue searching
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Extracts version from lockfile key
   * Example: "/react@18.3.1" -> "18.3.1"
   */
  private extractVersionFromKey(key: string): string | null {
    const match = key.match(/@([\d.]+)/);
    return match ? match[1] : null;
  }

  /**
   * Hashes content for cache invalidation
   */
  private hashContent(content: string): string {
    // Simple hash for cache invalidation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clears all caches (call when package.json or lockfiles change)
   */
  clearCache(): void {
    this.packageJsonCache.clear();
    this.lockfileCache = null;
  }
}
