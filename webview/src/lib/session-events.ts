/**
 * Evento de janela disparado ao pedir nova sessão (antes de `session:new` no bridge).
 * O `Chat` escuta para limpar mensagens e remontar o campo de input.
 */
export const CAPPY_NEW_SESSION_EVENT = "cappy:new-session";
