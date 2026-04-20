export interface SearchCandidate {
  title: string;
  link: string;
  snippet: string;
}

export interface FilteredCandidate extends SearchCandidate {
  domain: string;
  blocked: boolean;
  blockReason?: string;
}

export interface PageSignals {
  url: string;
  domain: string;
  // Content signals
  titleHasCompanyName: boolean;
  titleExactMatch: boolean;
  metaDescriptionHasCompanyName: boolean;
  hasCompanyKeywords: boolean;
  hasProductKeywords: boolean;
  hasB2BKeywords: boolean;
  hasContactPage: boolean;
  hasAboutPage: boolean;
  // Negative signals
  isBlog: boolean;
  isNews: boolean;
  isForum: boolean;
  isMarketplace: boolean;
  isSocialProfile: boolean;
  isDirectory: boolean;
  isJobSite: boolean;
  isAcademic: boolean;
  isEcommerce: boolean;
  // Domain quality
  isDotCom: boolean;
  hasCleanPath: boolean;
  pathDepth: number;
  hasCompanySubdomain: boolean;
  // Navigation signals
  hasBusinessNavLinks: boolean;
  // Extracted data
  emailsFound: string[];
  phonesFound: string[];
  addressesFound: string[];
  companyNamesFound: string[];
  socialLinks: { platform: string; url: string }[];
  // Meta
  fetchMethod: "cheerio" | "playwright";
  fetchDurationMs: number;
  httpStatus: number;
  finalUrl: string;
  error?: string;
}

export interface ScoredCandidate {
  candidate: SearchCandidate;
  signals: PageSignals;
  score: number;
  dimensionScores: Record<string, number>;
  rank: number;
}

export interface DetectorResult {
  winner: ScoredCandidate | null;
  allCandidates: ScoredCandidate[];
  searchQuery: string;
  totalCandidates: number;
  passedFilter: number;
  fetchedSuccessfully: number;
}

export interface ScoreWeights {
  domainQuality: number;
  contentSignals: number;
  negativeSignals: number;
  navigationSignals: number;
  contactSignals: number;
}

export interface DetectorConfig {
  blockedDomains: string[];
  blockedTlds: string[];
  scoreWeights: ScoreWeights;
  navKeywords: Record<string, string[]>;
  enablePlaywright: boolean;
}

export interface ExtractedContact {
  emails: string[];
  phones: string[];
  addresses: string[];
  companyName: string | null;
  socialLinks: { platform: string; url: string }[];
}
