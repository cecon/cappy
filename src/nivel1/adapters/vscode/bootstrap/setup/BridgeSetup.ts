/**
 * @fileoverview BridgeSetup — wires CappyBridge to WebView and starts it
 * @module bootstrap/setup/BridgeSetup
 */

import * as vscode from 'vscode';
import { CappyBridge }       from '../../../../../nivel2/infrastructure/bridge/cappy-bridge';
import { CappyWebViewProvider } from '../../webview/cappy-webview';
import type { IntelligentAgent } from '../../../../../nivel2/infrastructure/agents';

export class BridgeSetup {
  private bridge: CappyBridge | null = null;

  async start(
    context: vscode.ExtensionContext,
    agent: IntelligentAgent,
    webviewProvider: CappyWebViewProvider | null,
  ): Promise<CappyBridge | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      console.log('[BridgeSetup] No workspace folder — bridge not started');
      return null;
    }

    const workspaceRoot = folders[0].uri.fsPath;
    const projectName   = folders[0].name;

    this.bridge = new CappyBridge(projectName, workspaceRoot, agent);

    if (webviewProvider) {
      webviewProvider.setBridge(this.bridge);

      this.bridge.onQRCode(async (qr) => {
        try {
          const QRCode = await import('qrcode');
          const dataUri = await QRCode.toDataURL(qr, { width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
          webviewProvider.updateQRCode(dataUri);
        } catch {
          webviewProvider.updateQRCode(qr);
        }
      });

      this.bridge.onStatusChange((status) => {
        webviewProvider.updateStatus(status);
        if (status.whatsapp === 'connected') webviewProvider.clearQRCode();
      });

      this.bridge.onMessage((from, text, direction) => {
        webviewProvider.addMessage(from, text, direction);
      });
    }

    try {
      await this.bridge.start();
      console.log(`[BridgeSetup] Bridge started for: ${projectName}`);
    } catch (err) {
      console.error('[BridgeSetup] Failed to start bridge:', err);
    }

    context.subscriptions.push({ dispose: () => this.bridge?.stop() });
    return this.bridge;
  }
}
