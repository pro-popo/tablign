import emojiData from "@emoji-mart/data";

/** 토스페이스 커버 범위(Unicode 14.0). emoji-mart 데이터의 version 필드 기준. */
const MAX_VERSION = 14;

/** 카테고리 id → 한글 라벨 + 대표 탭 이모지. 여기 없는 카테고리(frequent 등)는 제외된다. */
const CAT_META: Record<string, { label: string; tab: string }> = {
  people: { label: "스마일리 & 사람", tab: "😀" },
  nature: { label: "동물 & 자연", tab: "🐻" },
  foods: { label: "음식 & 음료", tab: "🍔" },
  activity: { label: "활동", tab: "⚽" },
  places: { label: "여행 & 장소", tab: "✈️" },
  objects: { label: "사물", tab: "💡" },
  symbols: { label: "기호", tab: "❤️" },
  flags: { label: "깃발", tab: "🏳️" },
};

export interface TossEmoji {
  native: string;
  name: string;
  /** keywords + name 을 이어붙인 소문자 검색 인덱스. */
  search: string;
}
export interface TossCategory {
  id: string;
  label: string;
  tab: string;
  items: TossEmoji[];
}

interface RawEmoji {
  name?: string;
  keywords?: string[];
  version?: number;
  skins?: { native?: string }[];
}
interface RawData {
  categories?: { id: string; emojis: string[] }[];
  emojis?: Record<string, RawEmoji>;
}

/** @emoji-mart/data 에서 토스 커버 범위(version<=14)만 뽑아 카테고리 구조로 반환. */
export function buildTossCategories(data: unknown = emojiData): TossCategory[] {
  const d = data as RawData;
  const out: TossCategory[] = [];
  for (const c of d.categories ?? []) {
    const meta = CAT_META[c.id];
    if (!meta) continue;
    const items: TossEmoji[] = [];
    for (const id of c.emojis ?? []) {
      const e = d.emojis?.[id];
      const native = e?.skins?.[0]?.native;
      if (!native) continue;
      if ((e?.version ?? 1) > MAX_VERSION) continue;
      const search = `${(e?.keywords ?? []).join(" ")} ${e?.name ?? ""}`.toLowerCase();
      items.push({ native, name: e?.name ?? id, search });
    }
    if (items.length) out.push({ id: c.id, label: meta.label, tab: meta.tab, items });
  }
  return out;
}
