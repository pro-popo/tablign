export interface ParsedMetadata {
  title: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
}

function matchAttr(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function toAbsolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export function parseMetadata(html: string, pageUrl: string): ParsedMetadata {
  const ogTitle = matchAttr(
    html,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  const docTitle = matchAttr(html, /<title[^>]*>([^<]*)<\/title>/i);
  const ogImage = matchAttr(
    html,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  const iconHref = matchAttr(
    html,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );

  return {
    title: ogTitle ?? docTitle ?? null,
    thumbnail_url: ogImage ? toAbsolute(ogImage, pageUrl) : null,
    favicon_url: toAbsolute(iconHref ?? "/favicon.ico", pageUrl),
  };
}
