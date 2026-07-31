import { describe, expect, it } from "vitest";
import {
  planImport, defaultEnabled, looseSourceId, countLinks,
  SHARED_COLLECTION_TITLE, LARGE_FOLDER_THRESHOLD,
} from "../import/plan";
import type { SourceNode, ImportConfig } from "../import/types";

/** 모든 폴더를 켠 config. 테스트에서 명시적으로 끄고 싶은 것만 덮어쓴다. */
function allOn(roots: SourceNode[], overrides: Record<string, boolean> = {}): ImportConfig {
  const enabled: Record<string, boolean> = {};
  const walk = (n: SourceNode) => {
    if (n.url === undefined) enabled[n.id] = true;
    (n.children ?? []).forEach(walk);
  };
  for (const r of roots) {
    (r.children ?? []).forEach(walk);
    enabled[looseSourceId(r.id)] = true;
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

describe("planImport", () => {
  it("1단 폴더가 스페이스, 안쪽 폴더가 컬렉션이 된다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    expect(dev.name).toBe("개발");
    expect(dev.collections.map((c) => c.title)).toEqual(["React", "React/Hooks", "Node", SHARED_COLLECTION_TITLE]);
  });

  it("깊이 3 이상은 부모/자식으로 이름을 합치고 synthetic으로 표시한다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    const react = dev.collections.find((c) => c.sourceId === "react")!;
    const hooks = dev.collections.find((c) => c.sourceId === "hooks")!;
    expect(react.title).toBe("React");
    expect(react.synthetic).toBe(false);
    expect(hooks.title).toBe("React/Hooks");
    expect(hooks.synthetic).toBe(true);
  });

  it("폴더 직속 링크는 공유 폴더 컬렉션으로 맨 뒤에 모인다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    const shared = dev.collections.at(-1)!;
    expect(shared.title).toBe(SHARED_COLLECTION_TITLE);
    expect(shared.synthetic).toBe(true);
    expect(shared.links.map((l) => l.url)).toEqual(["https://dev.local/direct"]);
  });

  it("직속 링크가 없으면 공유 폴더를 만들지 않는다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [{ id: "b", title: "B", children: [link("l", "https://a.com/1")] }] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections.map((c) => c.title)).toEqual(["B"]);
  });

  it("하위 폴더 없이 링크만 든 1단 폴더도 스페이스가 되고 공유 폴더 하나를 갖는다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const news = plan.spaces.find((s) => s.sourceId === "news")!;
    expect(news.name).toBe("뉴스");
    expect(news.collections).toHaveLength(1);
    expect(news.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
  });

  it("루트 직속 링크는 루트 이름의 스페이스로 들어간다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const loose = plan.spaces.find((s) => s.sourceId === looseSourceId("1"))!;
    expect(loose.name).toBe("북마크바");
    expect(loose.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
    expect(loose.collections[0].links.map((l) => l.url)).toEqual(["https://loose.local/a"]);
  });

  it("링크 0개 컬렉션과 컬렉션 0개 스페이스는 계획에 넣지 않는다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("empty");
  });

  it("꺼진 폴더는 계획에서 빠진다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://a.com/1")] },
      { id: "b", title: "B", children: [link("l2", "https://b.com/1")] },
    ]}];
    const plan = planImport(roots, allOn(roots, { a: false }));
    expect(plan.spaces.map((s) => s.sourceId)).toEqual(["b"]);
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

  it("저장하는 url은 원본이고 정규화 결과가 아니다", () => {
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

  it("북마크바(primary) 아래 폴더는 켜짐", () => {
    const roots = tree();
    const e = defaultEnabled(roots);
    expect(e.dev).toBe(true);
    expect(e.react).toBe(true);
    expect(e.hooks).toBe(true);
    expect(e.news).toBe(true);
  });

  it("루트 직속 링크 묶음도 primary면 켜짐", () => {
    const e = defaultEnabled(tree());
    expect(e[looseSourceId("1")]).toBe(true);
  });

  it("primary가 아닌 루트(기타 북마크) 아래는 전부 꺼짐", () => {
    const e = defaultEnabled(tree());
    expect(e.tmp).toBe(false);
    expect(e[looseSourceId("2")]).toBe(false);
  });

  it("자손 포함 링크가 100개를 넘는 1단 폴더는 꺼짐", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "later", title: "나중에 읽기", children: many(LARGE_FOLDER_THRESHOLD + 1, "l") },
      { id: "small", title: "작은폴더", children: many(3, "s") },
    ]}];
    const e = defaultEnabled(roots);
    expect(e.later).toBe(false);
    expect(e.small).toBe(true);
  });

  it("100개 정확히는 켜짐(경계)", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "edge", title: "딱백개", children: many(LARGE_FOLDER_THRESHOLD, "e") },
    ]}];
    expect(defaultEnabled(roots).edge).toBe(true);
  });

  it("큰 1단 폴더의 자손도 함께 꺼진다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "big", title: "큰폴더", children: [
        { id: "inner", title: "안쪽", children: many(LARGE_FOLDER_THRESHOLD + 1, "b") },
      ]},
    ]}];
    const e = defaultEnabled(roots);
    expect(e.big).toBe(false);
    expect(e.inner).toBe(false);
  });

  it("결과를 planImport에 그대로 넣을 수 있다", () => {
    const roots = tree();
    const plan = planImport(roots, { enabled: defaultEnabled(roots) });
    // 기타 북마크의 '임시'는 기본 해제이므로 스페이스가 되지 않는다
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("tmp");
    expect(plan.spaces.map((s) => s.sourceId)).toContain("dev");
  });
});
