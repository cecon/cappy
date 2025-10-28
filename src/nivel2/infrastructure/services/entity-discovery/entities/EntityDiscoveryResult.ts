import type { DiscoveredEntity } from "./DiscoveredEntity";
import type { DiscoveredRelationship } from "./DiscoveredRelationship";

export interface EntityDiscoveryResult {
  entities: DiscoveredEntity[];
  relationships: DiscoveredRelationship[];
  summary?: string;
}
