/**
 * Port: configuration persistence abstraction.
 * Separates I/O from business logic; testable with in-memory implementations.
 */

import type { CappyConfig, AgentPreferences } from "../entities/AgentConfig";

export interface IConfigRepository {
  /** Loads `~/.cappy/config.json`; creates with defaults if absent. */
  loadConfig(): Promise<CappyConfig>;

  /** Persists `~/.cappy/config.json`. */
  saveConfig(config: CappyConfig): Promise<void>;

  /** Loads `.cappy/agent-preferences.json` from workspaceRoot; null if absent/invalid. */
  loadPreferences(workspaceRoot: string): Promise<AgentPreferences | null>;

  /** Persists `.cappy/agent-preferences.json`. */
  savePreferences(workspaceRoot: string, prefs: AgentPreferences): Promise<void>;

  /** Creates the default preferences file if it does not exist yet. */
  ensurePreferencesFile(workspaceRoot: string): Promise<void>;
}
