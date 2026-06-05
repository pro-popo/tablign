import type { ParsedMetadata } from "./parse-metadata";

export async function fetchMetadata(url: string): Promise<ParsedMetadata> {
  const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    return { title: null, thumbnail_url: null, favicon_url: null };
  }
  return (await res.json()) as ParsedMetadata;
}
