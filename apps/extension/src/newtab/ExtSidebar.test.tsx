import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Space } from "@tablign/core";
import { ExtSidebar } from "./ExtSidebar";

vi.mock("./tossEmoji", () => ({
  buildTossCategories: () => [
    { id: "travel", label: "여행 & 장소", tab: "🚗", items: [{ native: "🚀", name: "Rocket", search: "rocket" }] },
  ],
}));

const space = (over: Partial<Space>): Space =>
  ({ id: "s1", user_id: "u1", name: "배포", icon: "🚀", position: 1000, created_at: "x", org_id: "o1", ...over }) as Space;

function renderSidebar(spaces: Space[], handlers: { onAddSpace?: () => void; onEditSpace?: () => void } = {}) {
  render(
    <ExtSidebar
      spaces={spaces}
      sharedSpaces={[]}
      activeSpaceId={null}
      onSelectSpace={() => {}}
      onAddSpace={handlers.onAddSpace ?? (() => {})}
      onEditSpace={handlers.onEditSpace ?? (() => {})}
      onDeleteSpace={() => {}}
      onLeaveSpace={() => {}}
      onCollapse={() => {}}
      searchSlot={null}
    />,
  );
}

describe("ExtSidebar — 스페이스 아이콘", () => {
  it("아이콘이 없는 스페이스는 기본 폴더 아이콘으로 보인다", () => {
    renderSidebar([space({ icon: null, name: "관리" })]);
    expect(screen.getByText("📁")).toBeInTheDocument();
  });

  it("수정 버튼 없이 목록의 아이콘을 눌러 바로 바꿀 수 있다", () => {
    const onEditSpace = vi.fn();
    renderSidebar([space({ icon: null })], { onEditSpace });
    fireEvent.click(screen.getByRole("button", { name: "아이콘 변경" }));
    fireEvent.click(screen.getByRole("button", { name: "Rocket" }));
    expect(onEditSpace).toHaveBeenCalledWith("s1", "배포", "🚀");
    expect(screen.queryByRole("button", { name: "Rocket" })).toBeNull();
  });

  it("추가할 때 고른 아이콘이 이름과 함께 넘어간다", () => {
    const onAddSpace = vi.fn();
    renderSidebar([], { onAddSpace });
    fireEvent.click(screen.getByRole("button", { name: /스페이스 추가/ }));
    fireEvent.click(screen.getByRole("button", { name: "아이콘 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "Rocket" }));
    const input = screen.getByPlaceholderText("스페이스 이름");
    fireEvent.change(input, { target: { value: "새 스페이스" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddSpace).toHaveBeenCalledWith("새 스페이스", "🚀");
  });

  it("수정할 때는 아이콘을 고르는 즉시 입력 중인 이름과 함께 저장되고 수정이 끝난다", () => {
    const onEditSpace = vi.fn();
    renderSidebar([space({})], { onEditSpace });
    fireEvent.mouseEnter(screen.getByText("배포").closest("div")!);
    fireEvent.click(screen.getByRole("button", { name: "스페이스 이름 수정" }));
    fireEvent.change(screen.getByPlaceholderText("스페이스 이름"), { target: { value: "배포 자동화" } });
    fireEvent.click(screen.getByRole("button", { name: "아이콘 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "기본 아이콘으로" }));
    expect(onEditSpace).toHaveBeenCalledWith("s1", "배포 자동화", null);
    expect(screen.queryByPlaceholderText("스페이스 이름")).toBeNull();
  });

  it("아이콘 버튼을 눌러도 입력이 취소되지 않고, 바깥을 누르면 취소된다", () => {
    const onAddSpace = vi.fn();
    renderSidebar([], { onAddSpace });
    fireEvent.click(screen.getByRole("button", { name: /스페이스 추가/ }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "아이콘 선택" }));
    expect(screen.getByPlaceholderText("스페이스 이름")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText("스페이스 이름")).toBeNull();
    expect(onAddSpace).not.toHaveBeenCalled();
  });
});
