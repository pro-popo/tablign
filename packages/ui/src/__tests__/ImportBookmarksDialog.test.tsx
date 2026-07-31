import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SourceNode } from "@tablign/core";
import { ImportBookmarksDialog } from "../ImportBookmarksDialog";

const link = (id: string, url: string, title = id): SourceNode => ({ id, title, url });

const roots: SourceNode[] = [
  { id: "1", title: "북마크바", primary: true, children: [
    { id: "dev", title: "개발", children: [
      { id: "react", title: "React", children: [link("r1", "https://react.dev/a")] },
      link("d1", "https://dev.local/x"),
    ]},
    { id: "news", title: "뉴스", children: [link("w1", "https://news.local/a")] },
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

describe("ImportBookmarksDialog", () => {
  it("1단 폴더를 스페이스로, 안쪽 폴더와 공유 폴더를 컬렉션으로 미리 보여준다", () => {
    open();
    // 왼쪽 트리
    expect(screen.getAllByText("개발").length).toBeGreaterThan(0);
    expect(screen.getAllByText("뉴스").length).toBeGreaterThan(0);
    // 오른쪽 미리보기 — 개발 보드에 React와 공유 폴더
    expect(screen.getByTestId("preview-space-dev")).toBeInTheDocument();
    expect(screen.getByTestId("preview-col-react")).toHaveTextContent("React");
    expect(screen.getByTestId("preview-col-dev")).toHaveTextContent("공유 폴더");
  });

  it("푸터에 링크 수와 스페이스 수를 요약한다", () => {
    open();
    expect(screen.getByTestId("import-summary")).toHaveTextContent("링크 3개");
    expect(screen.getByTestId("import-summary")).toHaveTextContent("스페이스 2개");
  });

  it("폴더를 끄면 미리보기와 요약이 함께 줄어든다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-news"));
    expect(screen.queryByTestId("preview-space-news")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-summary")).toHaveTextContent("링크 2개");
    expect(screen.getByTestId("import-summary")).toHaveTextContent("스페이스 1개");
  });

  it("스페이스를 끄면 그 안 컬렉션도 함께 꺼진다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    expect(screen.queryByTestId("preview-space-dev")).not.toBeInTheDocument();
    // 다시 켜면 컬렉션도 돌아온다
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    expect(screen.getByTestId("preview-col-react")).toBeInTheDocument();
  });

  it("스페이스가 꺼진 동안 자손 행은 다시 켤 수 없다(체크와 계획이 어긋나지 않는다)", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    const before = screen.getByTestId("import-summary").textContent;
    // 잠긴 자손을 눌러도 아무 일도 일어나지 않는다
    fireEvent.click(screen.getByTestId("tree-row-react"));
    expect(screen.getByTestId("tree-row-react")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByTestId("preview-space-dev")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-summary").textContent).toBe(before);
  });

  it("모든 폴더를 끄면 가져오기가 막힌다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    fireEvent.click(screen.getByTestId("tree-row-news"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
  });

  it("조직이 여럿이면 선택기를 보여주고 기본값이 선택돼 있다", () => {
    open();
    const select = screen.getByLabelText("가져올 조직") as HTMLSelectElement;
    expect(select.value).toBe("o1");
  });

  it("조직이 하나면 선택기 대신 읽기 전용으로 목적지를 보여준다", () => {
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
    render(
      <ImportBookmarksDialog open roots={bigRoots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(screen.queryByTestId("preview-space-later")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-space-keep")).toBeInTheDocument();
    expect(screen.getByTestId("large-folder-note")).toBeInTheDocument();
  });

  it("링크가 상한을 넘으면 가져오기를 막고 이유를 보여준다", () => {
    const hugeRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "huge", title: "거대폴더", children: Array.from({ length: 2001 },
          (_, i) => link(`h${i}`, `https://h.com/${i}`)) },
      ]},
    ];
    render(
      <ImportBookmarksDialog open roots={hugeRoots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    // 거대폴더는 100개 초과라 기본 해제 상태 → 먼저 켠 다음 상한을 확인한다
    fireEvent.click(screen.getByTestId("tree-row-huge"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    expect(screen.getByTestId("over-limit-note")).toBeInTheDocument();
  });

  it("open이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <ImportBookmarksDialog open={false} roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
