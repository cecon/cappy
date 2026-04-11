/**
 * Use case: compress dropped message history to preserve context memory.
 * Extracted from createStream() in loop.ts. Coordinates MessageSanitizer + SessionContext.
 */

import type { Message } from "../../domain/entities/Message";
import type { SessionContext } from "../../domain/entities/SessionContext";
import type { ILlmProvider } from "../../domain/ports/ILlmProvider";
import type { ILogger } from "../../domain/ports/ILogger";
import { ContextBudgetService } from "../../domain/services/ContextBudgetService";
import { MessageSanitizer, MAX_SANITIZE_ITERATIONS } from "../../domain/services/MessageSanitizer";
import { SYSTEM_PROMPT_OVERHEAD_TOKENS } from "../../domain/entities/ContextBudget";

export interface CompressResult {
  messages: Message[];
  droppedCount: number;
  didTrim: boolean;
}

export class CompressContextUseCase {
  private readonly sanitizer: MessageSanitizer;

  constructor(
    private readonly budget: ContextBudgetService,
    private readonly llm: ILlmProvider,
    private readonly session: SessionContext,
    private readonly logger: ILogger,
  ) {
    this.sanitizer = new MessageSanitizer(this.budget);
  }

  /**
   * Iteratively trims messages to fit within effectiveBudget.
   * Dropped messages are summarised and appended to session compaction notes.
   * Use `silent = true` for subagent runs (no LLM summarisation, no note injection).
   */
  async execute(
    messages: Message[],
    effectiveBudget: number,
    model: string,
    silent: boolean,
  ): Promise<CompressResult> {
    const compactionExtra = silent ? 0 : this.budget.estimateTokens(this.session.getCompactionSummary());
    const trimBudget = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionExtra);
    const firstTrim = this.budget.trimForBudget(messages, trimBudget);

    if (firstTrim.droppedCount === 0) {
      return { messages: firstTrim.messages, droppedCount: 0, didTrim: false };
    }

    if (silent) {
      return {
        messages: firstTrim.messages,
        droppedCount: firstTrim.droppedCount,
        didTrim: true,
      };
    }

    return this.iterativeCompress(messages, effectiveBudget, model);
  }

  private async iterativeCompress(
    messages: Message[],
    effectiveBudget: number,
    model: string,
  ): Promise<CompressResult> {
    let work = [...messages];
    let totalDropped = 0;
    let didTrim = false;

    for (let iter = 0; iter < MAX_SANITIZE_ITERATIONS; iter++) {
      const compactionExtra = this.budget.estimateTokens(this.session.getCompactionSummary());
      const budget = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionExtra);
      const tr = this.budget.trimForBudget(work, budget);

      if (tr.droppedCount === 0) break;

      didTrim = true;
      totalDropped += tr.droppedCount;
      const dropped = work.slice(0, tr.droppedCount);
      work = tr.messages;

      await this.addCompactionNote(dropped, tr.droppedTokenEstimate, model);
    }

    // Final safety trim after all notes are appended
    const finalExtra = this.budget.estimateTokens(this.session.getCompactionSummary());
    const finalBudget = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - finalExtra);
    const finalTr = this.budget.trimForBudget(work, finalBudget);
    if (finalTr.droppedCount > 0) {
      didTrim = true;
      totalDropped += finalTr.droppedCount;
      await this.addCompactionNote(work.slice(0, finalTr.droppedCount), finalTr.droppedTokenEstimate, model);
      work = finalTr.messages;
    }

    return { messages: work, droppedCount: totalDropped, didTrim };
  }

  private async addCompactionNote(dropped: Message[], tokenEstimate: number, model: string): Promise<void> {
    try {
      const summary = await this.sanitizer.summarizeDropped(this.llm, model, dropped);
      if (summary.length > 0) {
        this.session.appendCompactionNote(summary);
      } else {
        this.session.appendCompactionNote(
          `[Compactação] Trecho omitido (~${tokenEstimate} tokens); resumo vazio.`,
        );
      }
    } catch (err) {
      this.logger.warn(`Context compression failed: ${String(err)}`);
      this.session.appendCompactionNote(
        `[Compactação] Trecho omitido (~${tokenEstimate} tokens); falha ao gerar resumo.`,
      );
    }
  }
}
