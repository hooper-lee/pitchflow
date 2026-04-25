export type DiscoveryQueryIntent =
  | "product"
  | "brand"
  | "dtc"
  | "official_site"
  | "platform"
  | "problem_scene"
  | "broad";

export interface DiscoveryExpandedQuery {
  query: string;
  intent: DiscoveryQueryIntent;
  priority: number;
}

export interface DiscoverySearchQuery {
  query: string;
  intent: DiscoveryQueryIntent;
  maxResults: number;
  country?: string | null;
  language?: string | null;
}

export interface DiscoverySearchSourceEvidence {
  provider: string;
  query: string;
  queryIntent: DiscoveryQueryIntent;
  rawRank: number;
  sourceConfidence: number;
}

export interface DiscoverySearchResult {
  title: string;
  link: string;
  snippet: string;
  sourceProvider: string;
  query: string;
  queryIntent: DiscoveryQueryIntent;
  rawRank: number;
  sourceConfidence: number;
  metadata?: {
    rootDomain?: string;
    sourceQualityScore?: number;
    sources?: DiscoverySearchSourceEvidence[];
    [key: string]: unknown;
  };
}

export interface DiscoverySearchProvider {
  name: string;
  enabled(): Promise<boolean> | boolean;
  search(query: DiscoverySearchQuery): Promise<DiscoverySearchResult[]>;
}
