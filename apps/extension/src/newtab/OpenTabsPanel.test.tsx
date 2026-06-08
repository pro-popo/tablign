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
];

function renderPanel(props: Partial<React.ComponentProps<typeof OpenTabsPanel>> = {}) {
  return render(
    <DndContext>
      <OpenTabsPanel groups={groups} onSaveWindow={() => {}} onCloseTab={() => {}} onCollapse={() => {}} {...props} />
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
});
