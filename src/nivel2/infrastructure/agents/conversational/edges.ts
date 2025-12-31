import type { ConversationalState } from './state';

export function shouldUseTools(state: ConversationalState): 'gather_info' | 'direct_response' {
  const requiresTools = state.intent?.requiresTools ?? false;
  const complexity = state.intent?.complexity ?? 'simple';
  const hasSuggestions = (state.intent?.suggestedTools?.length ?? 0) > 0;

  if (requiresTools || (complexity !== 'simple' && hasSuggestions)) {
    return 'gather_info';
  }

  return 'direct_response';
}
