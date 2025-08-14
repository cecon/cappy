import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { writeOutput } from '../utils/outputWriter';

export type TelemetryConsentStatus = 'accepted' | 'declined';

const CONSENT_VERSION = '1.0.0'; // Fallback version if parsing fails
const GLOBAL_STATE_KEYS = {
    status: 'cappy.telemetryConsent.status',
    version: 'cappy.telemetryConsent.version',
    timestamp: 'cappy.telemetryConsent.timestamp',
};

export interface ConsentState {
    status?: TelemetryConsentStatus;
    version?: string;
    timestamp?: string;
}

export function getConsentState(context: vscode.ExtensionContext): ConsentState {
    return {
        status: context.globalState.get<TelemetryConsentStatus>(GLOBAL_STATE_KEYS.status),
        version: context.globalState.get<string>(GLOBAL_STATE_KEYS.version),
        timestamp: context.globalState.get<string>(GLOBAL_STATE_KEYS.timestamp),
    };
}

export function isConsentUpToDate(state: ConsentState, desiredVersion: string): boolean {
    if (!state.status || !state.version) {
        return false;
    }
    return state.version === desiredVersion; // show again if version changed
}

export async function ensureTelemetryConsent(context: vscode.ExtensionContext): Promise<boolean> {
    const contractMd = await readContractMarkdown(context);
    const desiredVersion = extractContractVersion(contractMd) || CONSENT_VERSION;
    const state = getConsentState(context);
    if (isConsentUpToDate(state, desiredVersion)) {
        const result = state.status === 'accepted';
        writeOutput(`Telemetry consent: ${result ? 'accepted' : 'declined'}`);
        return result;
    }

    const accepted = await showConsentWebview(context);
    const now = new Date().toISOString();
    await context.globalState.update(GLOBAL_STATE_KEYS.status, accepted ? 'accepted' : 'declined');
    await context.globalState.update(GLOBAL_STATE_KEYS.version, desiredVersion);
    await context.globalState.update(GLOBAL_STATE_KEYS.timestamp, now);
    
    writeOutput(`Telemetry consent: ${accepted ? 'accepted' : 'declined'}`);
    return accepted;
}

export async function showConsentWebview(context: vscode.ExtensionContext): Promise<boolean> {
    const panel = vscode.window.createWebviewPanel(
        'cappyTelemetryConsent',
        'Cappy - Termos de Uso e Telemetria',
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            retainContextWhenHidden: false,
        }
    );

    const contractMd = await readContractMarkdown(context);
    panel.webview.html = getWebviewHtml(panel.webview, contractMd);

    return await new Promise<boolean>((resolve) => {
        const subscription = panel.webview.onDidReceiveMessage((msg: any) => {
            if (msg?.type === 'accept') {
                resolve(true);
                panel.dispose();
            } else if (msg?.type === 'decline') {
                resolve(false);
                panel.dispose();
            }
        });

        panel.onDidDispose(() => {
            subscription.dispose();
        });
    });
}

async function readContractMarkdown(context: vscode.ExtensionContext): Promise<string> {
    const candidates = [
        path.join(context.extensionPath, 'resources', 'templates', 'telemetry-contract.md'),
        // fallback to working dir during tests
        path.join(process.cwd(), 'resources', 'templates', 'telemetry-contract.md'),
    ];
    for (const p of candidates) {
        try {
            return await fs.promises.readFile(p, 'utf8');
        } catch {
            // try next
        }
    }
    // minimal fallback
    return `# Termos de Uso e Telemetria (v${CONSENT_VERSION})\n\n` +
        `Coletamos eventos de uso anônimos para melhorar a extensão. ` +
        `Você pode aceitar para ajudar ou recusar sem prejuízo.\n`;
}

function extractContractVersion(md: string): string | null {
    // Expect something like: "# Termos de Uso e Telemetria (v1.2.3)"
    const firstLine = md.split(/\r?\n/, 1)[0] ?? '';
    const m = /\(v(\d+\.\d+\.\d+)\)/i.exec(firstLine);
    return m ? m[1] : null;
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getWebviewHtml(webview: vscode.Webview, contractMd: string): string {
    // Render markdown as pre-wrapped text; keep it simple without extra deps
    const safeContent = escapeHtml(contractMd);
    const csp = `default-src 'none'; img-src ${webview.cspSource} https:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-abc123' ${webview.cspSource};`;
    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cappy - Termos de Uso e Telemetria</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 0; }
    header { padding: 16px 20px; background: #0f172a; color: #fff; }
    main { padding: 16px 20px; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #0b1020; color: #e5e7eb; padding: 16px; border-radius: 8px; }
    .actions { display: flex; gap: 12px; margin-top: 16px; }
    button { padding: 8px 14px; border-radius: 6px; border: 1px solid #1f2937; cursor: pointer; }
    .primary { background: #10b981; color: #06231a; border-color: #065f46; }
    .secondary { background: #111827; color: #e5e7eb; }
    small { color: #9ca3af; display: block; margin-top: 8px; }
  </style>
  </head>
<body>
  <header>
    <h2>🦫 Cappy — Termos de Uso e Telemetria</h2>
  </header>
  <main>
    <pre>${safeContent}</pre>
    <div class="actions">
      <button class="primary" id="accept">Aceitar</button>
      <button class="secondary" id="decline">Recusar</button>
    </div>
    <small>Esta tela aparece apenas uma vez e quando os termos forem atualizados.</small>
  </main>
  <script nonce="abc123">
    const vscode = acquireVsCodeApi();
    document.getElementById('accept').addEventListener('click', () => {
      vscode.postMessage({ type: 'accept' });
    });
    document.getElementById('decline').addEventListener('click', () => {
      vscode.postMessage({ type: 'decline' });
    });
  </script>
</body>
</html>`;
}

export const telemetryConsent = {
    consentVersion: CONSENT_VERSION,
    ensureTelemetryConsent,
    showConsentWebview,
    getConsentState,
    isConsentUpToDate,
};
