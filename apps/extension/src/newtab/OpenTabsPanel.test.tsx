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
      <OpenTabsPanel groups={groups} onSaveWindow={() => {}} onCloseWindow={() => {}} onCloseTab={() => {}} onCollapse={() => {}} {...props} />
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
    fireEvent.click(screen.getByRole("button", { name: "창 1 전체 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
  });

  it("탭 닫기 버튼이 onCloseTab(tabId)를 호출한다", () => {
    const onCloseTab = vi.fn();
    renderPanel({ onCloseTab });
    fireEvent.click(screen.getByRole("button", { name: "탭 A 닫기" }));
    expect(onCloseTab).toHaveBeenCalledWith(1);
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
    fireEvent.click(screen.getByRole("button", { name: "창 2 전체 저장" }));
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
    fireEvent.click(screen.getByRole("button", { name: "창 1 전체 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
    expect(screen.getByText("탭 A")).toBeInTheDocument();
  });
});
