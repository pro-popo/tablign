import type { Link } from "./types";

/** 컬렉션 링크를 LLM에 붙여넣기 좋은 `제목 | URL | 메모` 줄 목록으로 만든다. 제목·메모는 있을 때만 넣는다. */
export function linksToText(title: string, links: Pick<Link, "url" | "title" | "custom_title" | "note">[]): string {
  const lines = links.map((l) => [l.custom_title ?? l.title, l.url, l.note].filter(Boolean).join(" | "));
  return `# ${title}\n\n${lines.join("\n")}\n`;
}
