/**
 * Builds the ordered list of system messages for each LLM round.
 * Extracted from RunAgentUseCase to keep it under 300 lines.
 */

import type { SessionContext } from "../../domain/entities/SessionContext";
import type { AgentPreferences, ChatUiMode } from "../../domain/entities/AgentConfig";
import { HitlPolicyService } from "../../domain/services/HitlPolicyService";
import type { RunAgentInput } from "../dto/AgentDtos";

const PLAIN_SYSTEM =
  "Modo Plain: responde só em texto. Não invoques ferramentas. Usa apenas o que o utilizador enviou no chat.";

const ASK_SYSTEM =
  "Modo Ask: podes usar só ferramentas de leitura e pesquisa (ler código, grep, glob, web). " +
  "Não escrevas ficheiros, não executas shell.";

const PLAN_SYSTEM =
  "PLAN MODE: Explora e desenha a abordagem. " +
  "Não uses Write, Edit, Bash ou runTerminal até chamares ExitPlanMode ou o utilizador pedir implementação. " +
  "Usa ExploreAgent, TodoWrite, WebFetch ou WebSearch.";

export class SystemMessageBuilder {
  private readonly hitl = new HitlPolicyService();

  build(
    input: RunAgentInput,
    session: SessionContext,
    prefs: AgentPreferences | null,
    skillsBlock: string,
  ): string[] {
    const msgs: string[] = [];

    // 1. Chat-mode system prefix
    if (input.chatMode === "plain") msgs.push(PLAIN_SYSTEM);
    else if (input.chatMode === "ask") msgs.push(ASK_SYSTEM);

    // 2. Workspace skills (custom .cappy/skills/*.md)
    if (skillsBlock) msgs.push(skillsBlock);

    // 3. HITL policy block
    if (prefs) msgs.push(this.hitl.buildPromptBlock(prefs.hitl.destructiveTools));

    // 4. Compaction memory (not injected for silent/subagent runs)
    const summary = session.getCompactionSummary();
    if (summary && !input.silent) {
      msgs.push(
        "Memória sanitizada do histórico anterior (compactado para caber no contexto). " +
          "Usa estes factos como continuação da conversa:\n" +
          summary,
      );
    }

    // 5. Optional prefix from caller (subagent instructions)
    if (input.systemPromptPrefix) msgs.push(input.systemPromptPrefix);

    // 6. Plan mode guard (skip for subagents that explore with read-only tools)
    if (!input.ignorePlanMode && session.getPlanMode()) msgs.push(PLAN_SYSTEM);

    return msgs.filter((s) => s.length > 0);
  }
}
