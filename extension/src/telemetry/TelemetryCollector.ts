import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StepTelemetry {
  tool: string;
  startedAt: number;
  durationMs: number;
  success: boolean;
  error?: string | undefined;
}

export interface SessionTelemetry {
  sessionId: string;
  startedAt: string;
  durationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  steps: StepTelemetry[];
  modifiedFiles: string[];
}

export class TelemetryCollector {
  private readonly sessionId: string;
  private readonly sessionStartMs: number;
  private readonly steps: StepTelemetry[] = [];
  private readonly pendingStarts = new Map<string, number>();
  private readonly modifiedFiles: Set<string> = new Set();
  private totalTokensIn = 0;
  private totalTokensOut = 0;

  constructor() {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sessionStartMs = Date.now();
  }

  startStep(toolName: string): void {
    this.pendingStarts.set(toolName, Date.now());
  }

  endStep(toolName: string, success: boolean, error?: string): void {
    const startMs = this.pendingStarts.get(toolName) ?? Date.now();
    this.pendingStarts.delete(toolName);
    this.steps.push({
      tool: toolName,
      startedAt: startMs,
      durationMs: Date.now() - startMs,
      success,
      error,
    });
  }

  recordTokens(input: number, output: number): void {
    this.totalTokensIn += input;
    this.totalTokensOut += output;
  }

  recordModifiedFile(filePath: string): void {
    this.modifiedFiles.add(filePath);
  }

  export(): SessionTelemetry {
    return {
      sessionId: this.sessionId,
      startedAt: new Date(this.sessionStartMs).toISOString(),
      durationMs: Date.now() - this.sessionStartMs,
      totalTokensIn: this.totalTokensIn,
      totalTokensOut: this.totalTokensOut,
      steps: [...this.steps],
      modifiedFiles: [...this.modifiedFiles],
    };
  }

  async save(sessionDir: string): Promise<void> {
    await mkdir(sessionDir, { recursive: true });
    const telemetry = this.export();
    const filePath = path.join(sessionDir, `telemetry-${this.sessionId}.json`);
    await writeFile(filePath, `${JSON.stringify(telemetry, null, 2)}\n`, "utf8");
  }
}
