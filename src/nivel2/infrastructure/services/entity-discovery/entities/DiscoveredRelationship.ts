export interface DiscoveredRelationship {
  from: string;
  to: string;
  discoveredType: string;
  confidence: number;
  context: string;
}