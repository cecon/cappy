export interface DiscoveredEntity {
  name: string;
  discoveredType: string;
  confidence: number;
  properties: Record<string, unknown>;
  sourceContext: string;
  structuredMapping?: string;
}
