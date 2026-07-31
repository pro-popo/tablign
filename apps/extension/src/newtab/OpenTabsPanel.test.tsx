import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { OpenTabsPanel } from "./OpenTabsPanel";
import type { WindowGroup } from "../lib/tabs";

const groups: WindowGroup[] = [
  { windowId: 10, tabs: [
    { id: 1, windowId: 10, url: "https://a.com", title: "탭 A", favIconUrl: undefined },
    { id: 2, windowId: 10, url: "https://b.com", title: "탭 B", favIconUrl: undefined },
  ] },
  { windowId: 20, tabs: [
    { id: 3, windowId: 20, url: "https://c.com", title: "탭 C", favIconUrl: undefined },
  ] },
];

function renderPanel(props: Partial<React.ComponentProps<typeof OpenTabsPanel>> = {}) {
  return render(
    <DndContext>
      <OpenTabsPanel groups={groups} onSaveWindow={() => {}} onCloseWindow={() => {}} onCloseTab={() => {}} onActivateTab={() => {}} onCollapse={() => {}} {...props} />
    </DndContext>,
  );
}

describe("OpenTabsPanel", () => {
  it("창과 탭 제목을 보여준다", () => {
    renderPanel();
    expect(screen.getByText("창 1")).toBeInTheDocument();
    expect(screen.getByText("탭 A")).toBeInTheDocument();
    expect(screen.getByText("탭 B")).toBeInTheDocument();
  });

  it("창 전체 저장 버튼이 onSaveWindow(windowId)를 호출한다", () => {
    const onSaveWindow = vi.fn();
    renderPanel({ onSaveWindow });
    fireEvent.click(screen.getByRole("button", { name: "창 1의 탭 2개 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
  });

  it("탭 닫기 버튼이 onCloseTab(tabId)를 호출한다", () => {
    const onCloseTab = vi.fn();
    renderPanel({ onCloseTab });
    fireEvent.click(screen.getByRole("button", { name: "탭 A 닫기" }));
    expect(onCloseTab).toHaveBeenCalledWith(1);
  });

  it("탭 행을 클릭하면 onActivateTab(tabId, windowId)를 호출한다", () => {
    const onActivateTab = vi.fn();
    renderPanel({ onActivateTab });
    fireEvent.click(screen.getByText("탭 A"));
    expect(onActivateTab).toHaveBeenCalledWith(1, 10);
  });

  it("창이 여러 개면 각 창의 탭을 모두 보여준다", () => {
    renderPanel();
    expect(screen.getByText("창 1")).toBeInTheDocument();
    expect(screen.getByText("창 2")).toBeInTheDocument();
    expect(screen.getByText("탭 A")).toBeInTheDocument();
    expect(screen.getByText("탭 C")).toBeInTheDocument();
  });

  it("두 번째 창의 저장 버튼이 onSaveWindow(20)을 호출한다", () => {
    const onSaveWindow = vi.fn();
    renderPanel({ onSaveWindow });
    fireEvent.click(screen.getByRole("button", { name: "창 2의 탭 1개 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(20);
  });

  it("창 헤더를 클릭하면 해당 창의 탭이 접히고 다시 클릭하면 펼쳐진다", () => {
    renderPanel();
    expect(screen.getByText("탭 A")).toBeInTheDocument();

    fireEvent.click(screen.getByText("창 1"));
    expect(screen.queryByText("탭 A")).not.toBeInTheDocument();
    // 다른 창은 그대로
    expect(screen.getByText("탭 C")).toBeInTheDocument();

    fireEvent.click(screen.getByText("창 1"));
    expect(screen.getByText("탭 A")).toBeInTheDocument();
  });

  it("창 저장 버튼을 클릭해도 탭이 접히지 않는다", () => {
    const onSaveWindow = vi.fn();
    renderPanel({ onSaveWindow });
    fireEvent.click(screen.getByRole("button", { name: "창 1의 탭 2개 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
    expect(screen.getByText("탭 A")).toBeInTheDocument();
  });
});

describe("OpenTabsPanel — 담을 수 없는 탭", () => {
  const mixed: WindowGroup[] = [
    { windowId: 10, tabs: [
      { id: 1, windowId: 10, url: "https://a.com", title: "탭 A" },
      { id: 2, windowId: 10, url: "chrome://settings", title: "설정" },
      { id: 3, windowId: 10, url: "file:///x.pdf", title: "문서" },
      { id: 4, windowId: 10, url: "chrome-extension://xyz/newtab.html", title: "tablign — 새 탭" },
    ] },
    { windowId: 20, tabs: [
      { id: 5, windowId: 20, url: "chrome://history", title: "방문 기록" },
    ] },
  ];
  function renderMixed(props: Partial<React.ComponentProps<typeof OpenTabsPanel>> = {}) {
    return render(
      <DndContext>
        <OpenTabsPanel groups={mixed} selfTabId={4} onSaveWindow={() => {}} onCloseWindow={() => {}}
          onCloseTab={() => {}} onActivateTab={() => {}} onCollapse={() => {}} {...props} />
      </DndContext>,
    );
  }

  it("헤더에 담을 수 있는 실제 개수를 보여준다 — 보이는 5개 중 1개만 담긴다", () => {
    renderMixed();
    expect(screen.getByText("담을 수 있는 탭 1개")).toBeInTheDocument();
  });

  it("담을 수 없는 이유를 스킴별로 알려준다", () => {
    renderMixed();
    // chrome://settings 와 chrome://history 두 곳
    expect(screen.getAllByLabelText("브라우저 내부 페이지는 담을 수 없어요")).toHaveLength(2);
    expect(screen.getByLabelText("내 컴퓨터의 파일은 담을 수 없어요")).toBeInTheDocument();
  });

  it("tablign 새 탭 자신은 목록에 남고 '현재 탭'으로 표시된다", () => {
    renderMixed();
    expect(screen.getByText("tablign — 새 탭")).toBeInTheDocument();
    expect(screen.getByText("현재 탭")).toBeInTheDocument();
  });

  it("담을 수 없는 탭도 클릭하면 그 탭으로 전환된다 — 저장만 막고 전환은 살린다", () => {
    const onActivateTab = vi.fn();
    renderMixed({ onActivateTab });
    fireEvent.click(screen.getByText("설정"));
    expect(onActivateTab).toHaveBeenCalledWith(2, 10);
  });

  it("담을 탭이 없는 창은 저장 버튼이 비활성된다", () => {
    renderMixed();
    const dead = screen.getByRole("button", { name: "창 2 — 담을 수 있는 탭이 없어요" });
    expect(dead).toBeDisabled();
  });

  it("담을 탭이 있는 창은 실제 개수를 저장 버튼 이름에 쓴다", () => {
    const onSaveWindow = vi.fn();
    renderMixed({ onSaveWindow });
    fireEvent.click(screen.getByRole("button", { name: "창 1의 탭 1개 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
  });
});
