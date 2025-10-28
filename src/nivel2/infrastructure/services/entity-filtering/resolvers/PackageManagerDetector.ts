/**
 * Detecta o gerenciador de pacotes do projeto
 */
export class PackageManagerDetector {
  /**
   * Detecta gerenciador de pacotes baseado em arquivos lock
   */
  static async detect(projectRoot: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }
}
