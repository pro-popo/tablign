import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { directSourceId, looseSourceId, type SourceNode } from "@tablign/core";
import { ImportBookmarksDialog } from "../ImportBookmarksDialog";

const link = (id: string, url: string, title = id): SourceNode => ({ id, title, url });

const roots: SourceNode[] = [
  { id: "1", title: "북마크바", primary: true, children: [
    { id: "dev", title: "개발", children: [
      { id: "react", title: "React", children: [link("r1", "https://react.dev/a", "리액트 문서")] },
      link("d1", "https://dev.local/x", "개발 직속"),
    ]},
    { id: "news", title: "뉴스", children: [link("w1", "https://news.local/a", "뉴스 링크")] },
  ]},
];

const orgs = [{ id: "o1", name: "개인" }, { id: "o2", name: "허레이" }];
function noop() {}

function open(overrides: Partial<React.ComponentProps<typeof ImportBookmarksDialog>> = {}) {
  const onImport = vi.fn().mockResolvedValue(undefined);
  render(
    <ImportBookmarksDialog
      open roots={roots} orgs={orgs} defaultOrgId="o1"
      onImport={onImport} onClose={noop} {...overrides}
    />,
  );
  return { onImport };
}

const railOf = (id: string) => screen.getByTestId(`rail-${id}`);

describe("ImportBookmarksDialog", () => {
  it("레일에 모든 스페이스를, 보드에는 첫 스페이스의 컬렉션만 보여준다", () => {
    open();
    expect(railOf("dev")).toBeInTheDocument();
    expect(railOf("news")).toBeInTheDocument();

    // 보드는 '개발'만 — React와 공유 폴더
    expect(screen.getByTestId("board-header")).toHaveTextContent("개발");
    expect(screen.getByTestId("col-react")).toHaveTextContent("React");
    expect(screen.getByTestId(`col-${directSourceId("dev")}`)).toHaveTextContent("공유 폴더");
    // 다른 스페이스의 컬렉션은 없다
    expect(screen.queryByTestId(`col-${directSourceId("news")}`)).not.toBeInTheDocument();
  });

  it("탭을 제목과 도메인이 있는 한 줄로 보여준다", () => {
    open();
    const col = screen.getByTestId("col-react");
    expect(within(col).getByText("리액트 문서")).toBeInTheDocument();
    expect(within(col).getByText("react.dev")).toBeInTheDocument();
  });

  it("레일에서 이름을 누르면 보드가 그 스페이스로 바뀐다", () => {
    open();
    fireEvent.click(within(railOf("news")).getByRole("button"));
    expect(screen.getByTestId("board-header")).toHaveTextContent("뉴스");
    expect(screen.getByTestId(`col-${directSourceId("news")}`)).toBeInTheDocument();
    expect(screen.queryByTestId("col-react")).not.toBeInTheDocument();
  });

  it("레일 체크박스는 전환하지 않고 포함/제외만 바꾼다", () => {
    open();
    fireEvent.click(within(railOf("news")).getByRole("checkbox"));
    // 보드는 여전히 '개발'
    expect(screen.getByTestId("board-header")).toHaveTextContent("개발");
    // 제외된 스페이스는 계획에서 빠진다
    expect(screen.getByTestId("space-count")).toHaveTextContent("1/2");
  });

  it("컬렉션을 일부만 끄면 스페이스 체크가 부분 선택이 된다", () => {
    open();
    fireEvent.click(within(screen.getByTestId("col-react")).getByRole("checkbox"));
    const railCheck = within(railOf("dev")).getByRole("checkbox");
    expect(railCheck).toHaveAttribute("aria-checked", "mixed");
    // 스페이스는 여전히 포함된다(공유 폴더가 남아 있으므로)
    expect(screen.getByTestId("space-count")).toHaveTextContent("2/2");
  });

  it("공유 폴더만 따로 끌 수 있다", () => {
    const { onImport } = open();
    fireEvent.click(
      within(screen.getByTestId(`col-${directSourceId("dev")}`)).getByRole("checkbox"),
    );
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    return waitFor(() => {
      const plan = onImport.mock.calls[0][1];
      const dev = plan.spaces.find((s: { sourceId: string }) => s.sourceId === "dev");
      expect(dev.collections.map((c: { title: string }) => c.title)).toEqual(["React"]);
    });
  });

  it("스페이스를 꺼도 보드에 컬렉션이 남아 다시 켤 수 있다", () => {
    open();
    fireEvent.click(within(railOf("dev")).getByRole("checkbox"));
    expect(screen.getByTestId("space-count")).toHaveTextContent("1/2");
    // 사라지지 않는다
    expect(screen.getByTestId("col-react")).toBeInTheDocument();
    // 다시 켜기
    fireEvent.click(within(railOf("dev")).getByRole("checkbox"));
    expect(screen.getByTestId("space-count")).toHaveTextContent("2/2");
  });

  it("보드 헤더 체크박스도 스페이스 전체를 토글한다", () => {
    open();
    fireEvent.click(within(screen.getByTestId("board-header")).getByRole("checkbox"));
    expect(screen.getByTestId("space-count")).toHaveTextContent("1/2");
  });

  it("스페이스를 전부 끄면 가져오기가 비활성된다 — 별도 안내 문구는 없다", () => {
    open();
    fireEvent.click(within(railOf("dev")).getByRole("checkbox"));
    fireEvent.click(within(railOf("news")).getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    expect(screen.getByTestId("space-count")).toHaveTextContent("0/2");
    expect(screen.queryByText(/골라주세요/)).not.toBeInTheDocument();
  });

  it("개수 요약 문구는 어디에도 없다", () => {
    open();
    expect(screen.queryByText(/개를 가져와요/)).not.toBeInTheDocument();
  });

  it("조직이 여럿이면 선택기를, 하나면 읽기 전용으로 보여준다", () => {
    const { unmount } = render(
      <ImportBookmarksDialog open roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect((screen.getByLabelText("가져올 조직") as HTMLSelectElement).value).toBe("o1");
    unmount();

    open({ orgs: [{ id: "o1", name: "개인" }] });
    expect(screen.queryByLabelText("가져올 조직")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-org-fixed")).toHaveTextContent("개인");
  });

  it("고른 조직과 계획으로 onImport를 호출한다", async () => {
    const { onImport } = open();
    fireEvent.change(screen.getByLabelText("가져올 조직"), { target: { value: "o2" } });
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const [orgId, plan] = onImport.mock.calls[0];
    expect(orgId).toBe("o2");
    expect(plan.totals).toEqual({ spaces: 2, collections: 3, links: 3 });
  });

  it("가져오는 중에는 버튼이 비활성이고 문구가 바뀐다", async () => {
    let resolveImport: () => void = () => {};
    const onImport = vi.fn(() => new Promise<void>((r) => { resolveImport = r; }));
    render(
      <ImportBookmarksDialog open roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={onImport} onClose={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    expect(await screen.findByRole("button", { name: "가져오는 중…" })).toBeDisabled();
    resolveImport();
  });

  it("실패하면 다이얼로그를 유지하고 오류를 보여준다", async () => {
    const onImport = vi.fn().mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    render(
      <ImportBookmarksDialog open roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={onImport} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    expect(await screen.findByText(/가져오지 못했어요/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "가져오기" })).not.toBeDisabled();
  });

  it("링크 100개를 넘는 폴더는 기본 해제하고 이유를 적는다", () => {
    const bigRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "later", title: "나중에 읽기",
          children: Array.from({ length: 101 }, (_, i) => link(`x${i}`, `https://x.com/${i}`)) },
        { id: "keep", title: "작은폴더", children: [link("k1", "https://k.com/1")] },
      ]},
    ];
    open({ roots: bigRoots });
    // 레일엔 남지만 계획에선 빠져 있다
    expect(screen.getByTestId("rail-later")).toBeInTheDocument();
    expect(screen.getByTestId("space-count")).toHaveTextContent("1/2");
    expect(screen.getByTestId("large-folder-note")).toBeInTheDocument();
  });

  it("링크가 상한을 넘으면 가져오기를 막고 이유를 보여준다", () => {
    const hugeRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "huge", title: "거대폴더", children: Array.from({ length: 2001 },
          (_, i) => link(`h${i}`, `https://h.com/${i}`)) },
      ]},
    ];
    open({ roots: hugeRoots });
    // 100개 초과라 기본 해제 상태 → 먼저 켠 다음 상한을 확인한다
    fireEvent.click(within(screen.getByTestId("rail-huge")).getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    expect(screen.getByTestId("over-limit-note")).toBeInTheDocument();
  });

  it("루트 직속 링크는 루트 이름의 스페이스로 레일에 나온다", () => {
    const looseRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "a", title: "A", children: [link("l1", "https://a.com/1")] },
        link("root1", "https://loose.com/1", "폴더 밖 링크"),
      ]},
    ];
    open({ roots: looseRoots });
    const rail = screen.getByTestId(`rail-${looseSourceId("1")}`);
    expect(rail).toHaveTextContent("북마크바");
  });

  it("open이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <ImportBookmarksDialog open={false} roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
