import { describe, expect, it } from "vitest";
import {
  planImport, outlineSpaces, defaultEnabled, looseSourceId, directSourceId, countLinks,
  SHARED_COLLECTION_TITLE, LARGE_FOLDER_THRESHOLD,
} from "../import/plan";
import type { SourceNode, ImportConfig } from "../import/types";

/** 윤곽의 모든 컬렉션을 켠 config. 끄고 싶은 키만 덮어쓴다. */
function allOn(roots: SourceNode[], overrides: Record<string, boolean> = {}): ImportConfig {
  const enabled: Record<string, boolean> = {};
  for (const sp of outlineSpaces(roots)) {
    for (const c of sp.collections) enabled[c.sourceId] = true;
  }
  return { enabled: { ...enabled, ...overrides } };
}

const link = (id: string, url: string, title = id): SourceNode => ({ id, title, url });

/** 스펙의 예시 트리. 3단 중첩·평탄 폴더·직속 링크 혼재·루트 직속 링크를 모두 포함한다. */
function tree(): SourceNode[] {
  return [
    {
      id: "1", title: "북마크바", primary: true, children: [
        {
          id: "dev", title: "개발", children: [
            { id: "react", title: "React", children: [
              link("r1", "https://react.dev/a"),
              { id: "hooks", title: "Hooks", children: [link("h1", "https://react.dev/hooks")] },
            ]},
            { id: "node", title: "Node", children: [link("n1", "https://nodejs.org/a")] },
            link("d1", "https://dev.local/direct"),
          ],
        },
        { id: "news", title: "뉴스", children: [link("w1", "https://news.local/a")] },
        { id: "empty", title: "빈폴더", children: [] },
        link("root1", "https://loose.local/a"),
      ],
    },
    {
      id: "2", title: "기타 북마크", children: [
        { id: "tmp", title: "임시", children: [link("t1", "https://tmp.local/a")] },
      ],
    },
  ];
}

describe("outlineSpaces", () => {
  it("1단 폴더가 스페이스, 안쪽 폴더가 컬렉션이 된다", () => {
    const dev = outlineSpaces(tree()).find((s) => s.sourceId === "dev")!;
    expect(dev.name).toBe("개발");
    expect(dev.collections.map((c) => c.title))
      .toEqual(["React", "React/Hooks", "Node", SHARED_COLLECTION_TITLE]);
  });

  it("깊이 3 이상은 부모/자식으로 이름을 합치고 synthetic으로 표시한다", () => {
    const dev = outlineSpaces(tree()).find((s) => s.sourceId === "dev")!;
    const react = dev.collections.find((c) => c.sourceId === "react")!;
    const hooks = dev.collections.find((c) => c.sourceId === "hooks")!;
    expect(react.title).toBe("React");
    expect(react.synthetic).toBe(false);
    expect(hooks.title).toBe("React/Hooks");
    expect(hooks.synthetic).toBe(true);
  });

  it("폴더 직속 링크는 공유 폴더로 맨 뒤에 모이고 별도 키를 갖는다", () => {
    const dev = outlineSpaces(tree()).find((s) => s.sourceId === "dev")!;
    const shared = dev.collections.at(-1)!;
    expect(shared.title).toBe(SHARED_COLLECTION_TITLE);
    expect(shared.synthetic).toBe(true);
    // 스페이스 폴더 id와 겹치지 않아야 따로 끄고 켤 수 있다
    expect(shared.sourceId).toBe(directSourceId("dev"));
    expect(shared.sourceId).not.toBe("dev");
    expect(shared.links.map((l) => l.url)).toEqual(["https://dev.local/direct"]);
  });

  it("직속 링크가 없으면 공유 폴더를 만들지 않는다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [{ id: "b", title: "B", children: [link("l", "https://a.com/1")] }] },
    ]}];
    expect(outlineSpaces(roots)[0].collections.map((c) => c.title)).toEqual(["B"]);
  });

  it("하위 폴더 없이 링크만 든 1단 폴더도 스페이스가 되고 공유 폴더 하나를 갖는다", () => {
    const news = outlineSpaces(tree()).find((s) => s.sourceId === "news")!;
    expect(news.name).toBe("뉴스");
    expect(news.collections).toHaveLength(1);
    expect(news.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
    expect(news.collections[0].sourceId).toBe(directSourceId("news"));
  });

  it("루트 직속 링크는 루트 이름의 스페이스로 들어간다", () => {
    const loose = outlineSpaces(tree()).find((s) => s.sourceId === looseSourceId("1"))!;
    expect(loose.name).toBe("북마크바");
    expect(loose.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
    expect(loose.collections[0].links.map((l) => l.url)).toEqual(["https://loose.local/a"]);
  });

  it("링크 0개 컬렉션과 컬렉션 0개 스페이스는 윤곽에 넣지 않는다", () => {
    expect(outlineSpaces(tree()).map((s) => s.sourceId)).not.toContain("empty");
  });

  it("선택 상태와 무관하다 — 전부 꺼도 윤곽은 그대로다", () => {
    const roots = tree();
    const full = outlineSpaces(roots);
    expect(planImport(roots, { enabled: {} }).spaces).toHaveLength(0);
    expect(outlineSpaces(roots)).toEqual(full);
  });
});

describe("planImport", () => {
  it("전부 켜면 윤곽과 같다", () => {
    const roots = tree();
    expect(planImport(roots, allOn(roots)).spaces).toEqual(outlineSpaces(roots));
  });

  it("꺼진 컬렉션만 빠지고 나머지는 그대로다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots, { node: false }));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    expect(dev.collections.map((c) => c.title))
      .toEqual(["React", "React/Hooks", SHARED_COLLECTION_TITLE]);
  });

  it("공유 폴더만 따로 끌 수 있다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots, { [directSourceId("dev")]: false }));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    expect(dev.collections.map((c) => c.title)).toEqual(["React", "React/Hooks", "Node"]);
  });

  it("컬렉션을 전부 끄면 그 스페이스가 계획에서 빠진다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots, {
      react: false, hooks: false, node: false, [directSourceId("dev")]: false,
    }));
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("dev");
    expect(plan.spaces.map((s) => s.sourceId)).toContain("news");
  });

  it("같은 URL이 여러 폴더에 있어도 각각 그대로 담긴다(중복 제거 없음)", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://same.com/x")] },
      { id: "b", title: "B", children: [link("l2", "https://same.com/x"), link("l3", "https://b.com/1")] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    const a = plan.spaces.find((s) => s.sourceId === "a")!.collections[0];
    const b = plan.spaces.find((s) => s.sourceId === "b")!.collections[0];
    expect(a.links.map((l) => l.url)).toEqual(["https://same.com/x"]);
    expect(b.links.map((l) => l.url)).toEqual(["https://same.com/x", "https://b.com/1"]);
    expect(plan.totals.links).toBe(3);
  });

  it("저장하는 url은 원본 그대로다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://a.com/b/?x=1#top")] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections[0].links[0].url).toBe("https://a.com/b/?x=1#top");
  });

  it("파비콘을 링크마다 채운다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const react = plan.spaces.find((s) => s.sourceId === "dev")!.collections[0];
    expect(react.links[0].favicon_url).toBe("https://react.dev/favicon.ico");
  });

  it("소스가 준 파비콘이 유추보다 우선한다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [
        { id: "l", title: "L", url: "https://a.com/1", favicon: "https://cdn.a.com/icon.svg" },
      ]},
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections[0].links[0].favicon_url).toBe("https://cdn.a.com/icon.svg");
  });

  it("제목이 빈 문자열이면 null로 둔다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [{ id: "l", title: "", url: "https://a.com/1" }] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections[0].links[0].title).toBeNull();
  });

  it("totals가 실제 계획과 일치한다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const cols = plan.spaces.flatMap((s) => s.collections);
    expect(plan.totals.spaces).toBe(plan.spaces.length);
    expect(plan.totals.collections).toBe(cols.length);
    expect(plan.totals.links).toBe(cols.reduce((n, c) => n + c.links.length, 0));
  });
});

describe("countLinks", () => {
  it("자손을 포함해 링크를 센다", () => {
    const dev = tree()[0].children![0];
    expect(countLinks(dev)).toBe(4); // r1, h1, n1, d1
  });
  it("링크가 없으면 0", () => {
    expect(countLinks({ id: "x", title: "x", children: [] })).toBe(0);
  });
});

describe("defaultEnabled", () => {
  const many = (n: number, prefix: string): SourceNode[] =>
    Array.from({ length: n }, (_, i) => link(`${prefix}${i}`, `https://${prefix}.com/${i}`));

  it("북마크바(primary) 아래 스페이스의 모든 컬렉션 키를 켠다", () => {
    const e = defaultEnabled(tree());
    expect(e.react).toBe(true);
    expect(e.hooks).toBe(true);
    expect(e.node).toBe(true);
    expect(e[directSourceId("dev")]).toBe(true);
    expect(e[directSourceId("news")]).toBe(true);
  });

  it("루트 직속 링크 묶음도 primary면 켜짐", () => {
    expect(defaultEnabled(tree())[looseSourceId("1")]).toBe(true);
  });

  it("primary가 아닌 루트(기타 북마크) 아래는 전부 꺼짐", () => {
    const e = defaultEnabled(tree());
    expect(e[directSourceId("tmp")]).toBe(false);
    expect(e[looseSourceId("2")]).toBeUndefined(); // 루트 직속 링크가 없으면 키 자체가 없다
  });

  it("자손 포함 링크가 100개를 넘는 1단 폴더는 통째로 꺼짐", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "later", title: "나중에 읽기", children: many(LARGE_FOLDER_THRESHOLD + 1, "l") },
      { id: "small", title: "작은폴더", children: many(3, "s") },
    ]}];
    const e = defaultEnabled(roots);
    expect(e[directSourceId("later")]).toBe(false);
    expect(e[directSourceId("small")]).toBe(true);
  });

  it("100개 정확히는 켜짐(경계)", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "edge", title: "딱백개", children: many(LARGE_FOLDER_THRESHOLD, "e") },
    ]}];
    expect(defaultEnabled(roots)[directSourceId("edge")]).toBe(true);
  });

  it("큰 1단 폴더의 자손 컬렉션도 함께 꺼진다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "big", title: "큰폴더", children: [
        { id: "inner", title: "안쪽", children: many(LARGE_FOLDER_THRESHOLD + 1, "b") },
      ]},
    ]}];
    expect(defaultEnabled(roots).inner).toBe(false);
  });

  it("결과를 planImport에 그대로 넣을 수 있다", () => {
    const roots = tree();
    const plan = planImport(roots, { enabled: defaultEnabled(roots) });
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("tmp");
    expect(plan.spaces.map((s) => s.sourceId)).toContain("dev");
  });

  it("윤곽의 모든 컬렉션 키를 빠짐없이 만든다", () => {
    const roots = tree();
    const e = defaultEnabled(roots);
    for (const sp of outlineSpaces(roots)) {
      for (const c of sp.collections) {
        expect(e).toHaveProperty(c.sourceId);
      }
    }
  });
});
