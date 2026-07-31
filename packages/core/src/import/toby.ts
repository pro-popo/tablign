import { isImportableUrl } from "./url";
import type { SourceNode } from "./types";

// Toby 내보내기(설정 → Export, version 4 실측)의 우리가 쓰는 부분.
// group → 스페이스, list → 컬렉션, card → 링크로 계층이 정확히 떨어진다 —
// 중첩 폴더·직속 링크가 없어 이름 합침도 공유 폴더도 생기지 않는다.
interface TobyCard {
  title?: string;
  url?: string;
  favIconUrl?: string;
  customTitle?: string;
}
interface TobyList { title?: string; cards?: TobyCard[] }
interface TobyGroup { name?: string; lists?: TobyList[] }

/**
 * Toby 내보내기 JSON(파싱된 객체) → 정규화된 소스 트리.
 * 루트 하나("Toby", primary)를 만들어 group들이 1단 폴더(=스페이스 후보)가 되게 한다.
 * Chrome 쪽 fromChromeTree와 같은 정리 규칙: http/https가 아닌 카드와 빈 목록·빈 그룹은 버린다.
 * groups 배열이 없으면 Toby 파일이 아닌 것이므로 throw.
 */
export function fromTobyExport(data: unknown): SourceNode[] {
  const groups = (data as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(groups)) {
    throw new Error("Toby 내보내기 파일이 아니에요");
  }

  const children: SourceNode[] = [];
  (groups as TobyGroup[]).forEach((g, gi) => {
    const lists: SourceNode[] = [];
    (g.lists ?? []).forEach((l, li) => {
      const cards: SourceNode[] = [];
      (l.cards ?? []).forEach((c, ci) => {
        if (!c.url || !isImportableUrl(c.url)) return;
        cards.push({
          id: `toby:${gi}:${li}:${ci}`,
          // 사용자가 직접 고친 제목이 있으면 그것이 진짜 제목이다
          title: (c.customTitle || c.title || "").trim(),
          url: c.url,
          favicon: c.favIconUrl || undefined,
        });
      });
      if (cards.length) lists.push({ id: `toby:${gi}:${li}`, title: l.title ?? "", children: cards });
    });
    if (lists.length) children.push({ id: `toby:${gi}`, title: g.name ?? "", children: lists });
  });

  return children.length ? [{ id: "toby", title: "Toby", primary: true, children }] : [];
}
