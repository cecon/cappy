import type { NormalizedEntity } from '../types/FilterTypes';
import { PackageManagerDetector } from './PackageManagerDetector';

/**
 * Resolve informações de pacotes externos
 */
export class PackageInfoResolver {
  /**
   * Resolve informações do pacote
   */
  static async resolve(
    packageName: string,
    filePath: string
  ): Promise<NormalizedEntity['packageInfo']> {
    try {
      const path = await import('node:path');
      const fs = await import('node:fs');

      // Navega até encontrar package.json
      let currentDir = path.dirname(filePath);
      const maxDepth = 10;
      let depth = 0;

      while (depth < maxDepth) {
        const packageJsonPath = path.join(currentDir, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          // Verifica se é dependência ou devDependency
          const deps = packageJson.dependencies || {};
          const devDeps = packageJson.devDependencies || {};

          const version = deps[packageName] || devDeps[packageName];

          if (version) {
            return {
              name: packageName,
              version: version.replace(/^[\^~]/, ''), // Remove ^ e ~
              manager: await PackageManagerDetector.detect(currentDir),
              isDevDependency: !!devDeps[packageName]
            };
          }
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // Chegou na raiz
        currentDir = parentDir;
        depth++;
      }
    } catch {
      // Ignora erros silenciosamente
    }

    return {
      name: packageName
    };
  }
}
