import { DiscoveredEntity } from "./DiscoveredEntity";
import { DiscoveredRelationship } from "./DiscoveredRelationship";

export interface EntityDiscoveryResult {
  entities: DiscoveredEntity[];
  relationships: DiscoveredRelationship[];
  summary?: string;
}
