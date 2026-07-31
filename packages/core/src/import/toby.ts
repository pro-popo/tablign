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
 * Toby가 다른 도구에서 가져올 때 그룹 이름 앞에 붙이는 접두어("Import - ")를 뗀다.
 * 사용자가 지은 이름이 아니라 Toby의 흔적이므로 스페이스 이름에 남기지 않는다.
 * 떼고 나면 빈 이름이 되는 경우엔 원래 이름을 그대로 둔다.
 */
function cleanGroupName(name: string | undefined): string {
  const raw = name ?? "";
  const cleaned = raw.replace(/^Import\s*-\s*/, "").trim();
  return cleaned || raw;
}

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
  // 원소가 null이거나 배열이 아닌 기형 입력도 던지지 않고 건너뛴다 — 파일 오류는
  // 최상위(groups 부재)에서만 판정하고, 부분 손상은 살릴 수 있는 만큼 살린다.
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  (groups as (TobyGroup | null)[]).forEach((g, gi) => {
    const lists: SourceNode[] = [];
    arr<TobyList | null>(g?.lists).forEach((l, li) => {
      const cards: SourceNode[] = [];
      arr<TobyCard | null>(l?.cards).forEach((c, ci) => {
        if (typeof c?.url !== "string" || !isImportableUrl(c.url)) return;
        cards.push({
          id: `toby:${gi}:${li}:${ci}`,
          // 사용자가 직접 고친 제목이 있으면 그것이 진짜 제목이다
          title: (c.customTitle || c.title || "").trim(),
          url: c.url,
          favicon: c.favIconUrl || undefined,
        });
      });
      if (cards.length) lists.push({ id: `toby:${gi}:${li}`, title: l?.title ?? "", children: cards });
    });
    if (lists.length) children.push({ id: `toby:${gi}`, title: cleanGroupName(g?.name), children: lists });
  });

  return children.length ? [{ id: "toby", title: "Toby", primary: true, children }] : [];
}
