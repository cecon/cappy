/**
 * @fileoverview Planning mode engine with structured output.
 * @module application/modes/PlanningModeEngine
 */

import type {
  IPlanningModeEngine,
  PlanningResult,
  ProviderChatResponse,
  UserTurnInput,
} from '../../../shared/types/agent';
import type { IProviderGateway } from '../../../shared/types/agent';

/**
 * Produces a deterministic structured plan and optionally enriches it with provider output.
 */
export class PlanningModeEngine implements IPlanningModeEngine {
  constructor(private readonly providerGateway: IProviderGateway) {}

  /**
   * Builds a plan payload from the user input.
   */
  async run(input: UserTurnInput): Promise<PlanningResult> {
    const objective = input.prompt.trim();
    const assumptions = [
      'Os requisitos podem evoluir durante a implementação.',
      'É necessário validar em ambiente local antes de aplicar mudanças finais.',
    ];
    const steps = [
      'Mapear os arquivos e módulos diretamente impactados.',
      'Implementar a solução em incrementos pequenos com validação contínua.',
      'Executar build/lint/test e revisar riscos de regressão.',
      'Documentar decisões e próximos passos para manutenção.',
    ];
    const risks = [
      'Mudanças em contratos compartilhados podem quebrar fluxos existentes.',
      'Integrações externas podem falhar por configuração incompleta.',
    ];
    const validation = [
      '[ ] Build da extensão compilando sem erros',
      '[ ] Lint sem novos problemas introduzidos',
      '[ ] Fluxo principal testado manualmente no painel',
      '[ ] Rollback claro definido para mudanças críticas',
    ];

    const providerSummary = await this.tryProviderSummary(objective);
    const markdown = [
      '## Planejamento Estruturado',
      '',
      `### Objetivo`,
      objective,
      '',
      '### Premissas',
      ...assumptions.map((item) => `- ${item}`),
      '',
      '### Passos',
      ...steps.map((item, index) => `${index + 1}. ${item}`),
      '',
      '### Riscos',
      ...risks.map((item) => `- ${item}`),
      '',
      '### Validação',
      ...validation.map((item) => `- ${item}`),
      providerSummary ? ['', '### Resumo IA', providerSummary] : [],
    ]
      .flat()
      .join('\n');

    return {
      objective,
      assumptions,
      steps,
      risks,
      validation,
      markdown,
    };
  }

  /**
   * Gets a short optional enrichment from configured provider.
   */
  private async tryProviderSummary(objective: string): Promise<string | null> {
    try {
      const response: ProviderChatResponse = await this.providerGateway.chat({
        systemPrompt:
          'Você é um assistente técnico que gera resumos curtos de planejamento. Responda em português com no máximo 3 linhas.',
        prompt: `Resuma em até 3 linhas um plano inicial para: ${objective}`,
      });
      return response.text.trim();
    } catch {
      return null;
    }
  }
}

