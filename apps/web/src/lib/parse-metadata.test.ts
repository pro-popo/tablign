import { describe, expect, it } from "vitest";
import { parseMetadata } from "./parse-metadata";

const html = `
<html><head>
  <title>일반 제목</title>
  <meta property="og:title" content="OG 제목" />
  <meta property="og:image" content="https://cdn.example.com/img.png" />
  <link rel="icon" href="/favicon.ico" />
</head><body></body></html>`;

describe("parseMetadata", () => {
  it("og:title을 우선 제목으로 추출한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.title).toBe("OG 제목");
  });

  it("og:image를 썸네일로 추출한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.thumbnail_url).toBe("https://cdn.example.com/img.png");
  });

  it("상대 경로 favicon을 절대 URL로 변환한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.favicon_url).toBe("https://example.com/favicon.ico");
  });

  it("og:title이 없으면 <title>을 쓴다", () => {
    const m = parseMetadata("<title>오직 타이틀</title>", "https://x.com");
    expect(m.title).toBe("오직 타이틀");
  });

  it("아무 메타도 없으면 title은 null, favicon은 기본 /favicon.ico 절대경로", () => {
    const m = parseMetadata("<html></html>", "https://x.com/a/b");
    expect(m.title).toBeNull();
    expect(m.favicon_url).toBe("https://x.com/favicon.ico");
  });
});
