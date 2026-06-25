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

/**
 * 페이지 HTML에서 제목·썸네일·파비콘을 추출한다.
 * HTML을 가져오는 책임은 호출자에게 있다(웹은 서버 라우트, 익스텐션은 직접 fetch 등).
 */
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
