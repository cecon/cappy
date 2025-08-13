import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function getWorkspaceRoot(): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder?.uri.fsPath ?? null;
}

function detectMainLanguage(root: string): string {
    try {
        if (fs.existsSync(path.join(root, 'tsconfig.json'))) {
            return 'TypeScript';
        }
        if (fs.existsSync(path.join(root, 'jsconfig.json'))) {
            return 'JavaScript';
        }
    } catch { /* ignore */ }
    return 'TypeScript';
}

function detectFrameworks(pkgJson: any | null): string {
    const names: string[] = [];
    const deps = { ...(pkgJson?.dependencies || {}), ...(pkgJson?.devDependencies || {}) } as Record<string, string>;
    const known = ['react', 'next', 'vue', 'nuxt', 'svelte', 'angular', 'express', 'nestjs'];
    for (const k of known) {
        if (deps[k]) {
            names.push(k);
        }
    }
    return names.join(', ');
}

function getExtensionRoot(context?: vscode.ExtensionContext): string {
    const candidates = [
        context?.extensionPath,
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../..')
    ].filter(Boolean) as string[];
    for (const base of candidates) {
        const tpl = path.join(base, 'resources', 'templates', 'cappy-copilot-instructions.md');
        if (fs.existsSync(tpl)) {
            return base;
        }
    }
    return process.cwd();
}

async function readPackageJson(root: string): Promise<any | null> {
    try {
        const content = await fs.promises.readFile(path.join(root, 'package.json'), 'utf8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUpperSnake(camel: string): string {
    return camel
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

function fillTemplate(content: string, values: Record<string, string>): string {
    let out = content;
    for (const [camelKey, value] of Object.entries(values)) {
        const token = toUpperSnake(camelKey); // e.g., projectName -> PROJECT_NAME
        const pattern = new RegExp(`\\{${escapeRegex(token)}\\}`, 'g');
        out = out.replace(pattern, value);
    }
    return out;
}

export async function getNewTaskInstruction(context?: vscode.ExtensionContext, args?: Record<string, string>): Promise<string> {
    const root = getWorkspaceRoot();
    if (!root) {
        const msg = 'Nenhuma pasta de projeto aberta.';
        void vscode.window.showWarningMessage(`Cappy: ${msg}`);
        return msg;
    }

    const pkg = await readPackageJson(root);
    const projectName = path.basename(root);
    const mainLanguage = detectMainLanguage(root);
    const frameworks = detectFrameworks(pkg);

    const defaults: Record<string, string> = {
        projectName,
        projectType: pkg?.description ? 'Node/VS Code Extension' : 'Node Project',
        mainLanguage,
        frameworks: frameworks || 'N/A',
    };

    const merged: Record<string, string> = { ...defaults, ...(args || {}) };

    const extRoot = getExtensionRoot(context);
    const templatePath = path.join(extRoot, 'resources', 'templates', 'cappy-copilot-instructions.md');
    let template: string;
    try {
        template = await fs.promises.readFile(templatePath, 'utf8');
    } catch (e) {
        const fallback = '# Cappy Copilot Instructions\n';
        template = fallback;
    }

    const processed = fillTemplate(template, merged);

    // Also persist under .capy/instructions for local reference
    try {
        const capyDir = path.join(root, '.capy', 'instructions');
        await fs.promises.mkdir(capyDir, { recursive: true });
        await fs.promises.writeFile(path.join(capyDir, 'copilot-instructions.md'), processed, 'utf8');
    } catch (e) {
        // Non-fatal
    }

    return processed;
}

export default getNewTaskInstruction;
