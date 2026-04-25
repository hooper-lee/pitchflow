import { searxngProvider } from "./searxng.provider";
import type { DiscoverySearchProvider } from "../types";

export function getDiscoverySearchProviders(): DiscoverySearchProvider[] {
  const configuredProviders = (process.env.SEARCH_PROVIDERS || "searxng")
    .split(",")
    .map((providerName) => providerName.trim().toLowerCase())
    .filter(Boolean);

  const providers = new Map<string, DiscoverySearchProvider>([
    [searxngProvider.name, searxngProvider],
  ]);

  return configuredProviders
    .map((providerName) => providers.get(providerName))
    .filter((provider): provider is DiscoverySearchProvider => Boolean(provider));
}
