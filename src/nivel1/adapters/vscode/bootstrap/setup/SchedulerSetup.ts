/**
 * @fileoverview SchedulerSetup — creates and wires CronScheduler
 * @module bootstrap/setup/SchedulerSetup
 */

import * as vscode from 'vscode';
import { CronScheduler }     from '../../../../../nivel2/infrastructure/scheduler/CronScheduler';
import { CappyBridge }       from '../../../../../nivel2/infrastructure/bridge/cappy-bridge';
import { CappyWebViewProvider } from '../../webview/cappy-webview';

export class SchedulerSetup {
  private scheduler: CronScheduler | null = null;

  start(
    context: vscode.ExtensionContext,
    bridge: CappyBridge | null,
    webviewProvider: CappyWebViewProvider | null,
  ): CronScheduler | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      console.log('[SchedulerSetup] No workspace folder — scheduler not started');
      return null;
    }

    this.scheduler = new CronScheduler(folders[0].uri.fsPath);

    if (bridge) {
      this.scheduler.setBridge(bridge);
      bridge.setScheduler(this.scheduler);
    }

    if (webviewProvider) {
      this.scheduler.onTasksChanged((tasks) =>
        webviewProvider.postMessage({ type: 'scheduler-tasks', data: tasks })
      );
      this.scheduler.onTaskRunning((id) =>
        webviewProvider.postMessage({ type: 'scheduler-running', data: id })
      );
      this.scheduler.onTaskComplete((id, status) =>
        webviewProvider.postMessage({ type: 'scheduler-complete', data: { taskId: id, status } })
      );
    }

    this.scheduler.start();
    context.subscriptions.push({ dispose: () => this.scheduler?.stop() });
    console.log('[SchedulerSetup] Cron Scheduler started');
    return this.scheduler;
  }

  getScheduler(): CronScheduler | null { return this.scheduler; }
}
