import { describe, expect, it } from "vitest";
import { fromTobyExport } from "../import/toby";
import { planImport, defaultEnabled } from "../import/plan";

/** 실제 export(version 4)에서 확인한 스키마의 축소 픽스처. */
const fixture = {
  version: 4,
  groups: [
    {
      name: "KB 검진대행", type: "public", lists: [
        { title: "Client", labelIds: [], cards: [
          { title: "assist-frontend", url: "https://github.com/huray/assist-frontend",
            favIconUrl: "https://github.githubassets.com/favicons/favicon.svg",
            customTitle: "", customDescription: "", description: "" },
          { title: "지라 보드", url: "https://huray.atlassian.net/board",
            favIconUrl: "", customTitle: "KB 보드", customDescription: "", description: "" },
        ]},
        { title: "빈목록", labelIds: [], cards: [] },
      ],
    },
    { name: "빈그룹", type: "private", lists: [{ title: "Web", cards: [] }] },
    {
      name: "배포", type: "private", lists: [
        { title: "Link", cards: [
          { title: "북마클릿", url: "javascript:void(0)", favIconUrl: "", customTitle: "" },
          { title: "운영", url: "https://deploy.huray.net", favIconUrl: "", customTitle: "" },
        ]},
      ],
    },
  ],
  labels: {},
};

describe("fromTobyExport", () => {
  it("루트 하나(Toby, primary) 아래에 group→폴더, list→폴더, card→링크로 정규화한다", () => {
    const roots = fromTobyExport(fixture);
    expect(roots).toHaveLength(1);
    expect(roots[0].title).toBe("Toby");
    expect(roots[0].primary).toBe(true);
    const kb = roots[0].children![0];
    expect(kb.title).toBe("KB 검진대행");
    expect(kb.children![0].title).toBe("Client");
    expect(kb.children![0].children![0].url).toBe("https://github.com/huray/assist-frontend");
  });

  it("favIconUrl을 favicon으로 넘기고, 빈 문자열은 버린다", () => {
    const cards = fromTobyExport(fixture)[0].children![0].children![0].children!;
    expect(cards[0].favicon).toBe("https://github.githubassets.com/favicons/favicon.svg");
    expect(cards[1].favicon).toBeUndefined();
  });

  it("customTitle이 있으면 title보다 우선한다", () => {
    const cards = fromTobyExport(fixture)[0].children![0].children![0].children!;
    expect(cards[0].title).toBe("assist-frontend");
    expect(cards[1].title).toBe("KB 보드");
  });

  it("http·https가 아닌 카드와 빈 목록·빈 그룹을 버린다", () => {
    const root = fromTobyExport(fixture)[0];
    expect(root.children!.map((g) => g.title)).toEqual(["KB 검진대행", "배포"]);
    const kb = root.children![0];
    expect(kb.children!.map((l) => l.title)).toEqual(["Client"]);
    const deploy = root.children![1].children![0];
    expect(deploy.children!.map((c) => c.url)).toEqual(["https://deploy.huray.net"]);
  });

  it("groups 배열이 없으면 Toby 파일이 아니므로 던진다", () => {
    expect(() => fromTobyExport({})).toThrow();
    expect(() => fromTobyExport(null)).toThrow();
    expect(() => fromTobyExport({ roots: [] })).toThrow();
    expect(() => fromTobyExport("문자열")).toThrow();
  });

  it("가져올 카드가 하나도 없으면 빈 배열", () => {
    expect(fromTobyExport({ groups: [{ name: "A", lists: [] }] })).toEqual([]);
  });

  it("원소가 null이거나 배열이 아니어도 던지지 않고 살릴 수 있는 것만 살린다", () => {
    const roots = fromTobyExport({ groups: [
      null,
      { name: "기형", lists: "문자열" },
      { name: "부분손상", lists: [null, { title: "L", cards: [null, { url: "https://ok.com/1", title: "OK" }] }] },
    ]});
    expect(roots).toHaveLength(1);
    expect(roots[0].children!.map((g) => g.title)).toEqual(["부분손상"]);
    expect(roots[0].children![0].children![0].children![0].url).toBe("https://ok.com/1");
  });

  it("planImport에 그대로 넣으면 group이 스페이스, list가 컬렉션이 된다", () => {
    const roots = fromTobyExport(fixture);
    const plan = planImport(roots, { enabled: defaultEnabled(roots) });
    expect(plan.spaces.map((s) => s.name)).toEqual(["KB 검진대행", "배포"]);
    const kb = plan.spaces[0];
    expect(kb.collections.map((c) => c.title)).toEqual(["Client"]);
    // 소스 파비콘이 유추(origin/favicon.ico)를 이긴다
    expect(kb.collections[0].links[0].favicon_url)
      .toBe("https://github.githubassets.com/favicons/favicon.svg");
    // 파비콘이 없던 카드는 유추로 채워진다
    expect(kb.collections[0].links[1].favicon_url).toBe("https://huray.atlassian.net/favicon.ico");
  });
});
