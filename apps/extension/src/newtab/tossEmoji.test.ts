import { describe, it, expect } from "vitest";
import { buildTossCategories } from "./tossEmoji";

const fake = {
  categories: [
    { id: "people", emojis: ["grinning", "newface"] },
    { id: "frequent", emojis: ["grinning"] },
  ],
  emojis: {
    grinning: { name: "Grinning", keywords: ["smile", "happy"], version: 1, skins: [{ native: "😀" }] },
    newface: { name: "New Face", keywords: ["new"], version: 15, skins: [{ native: "🫩" }] },
  },
};

describe("buildTossCategories", () => {
  it("version<=14만 포함하고 그 이상(미커버)은 제외한다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.items.map((i) => i.native)).toEqual(["😀"]);
  });
  it("frequent 등 비표준 카테고리는 제외한다", () => {
    expect(buildTossCategories(fake).some((c) => c.id === "frequent")).toBe(false);
  });
  it("한글 라벨과 대표 탭 이모지를 붙인다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.label).toBe("스마일리 & 사람");
    expect(people.tab).toBe("😀");
  });
  it("keywords+name 소문자 검색 인덱스를 만든다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.items[0].search).toContain("smile");
    expect(people.items[0].search).toContain("grinning");
  });
});
