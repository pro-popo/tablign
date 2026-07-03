import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionMoreMenu } from "../CollectionMoreMenu";

const spaces = [
  { id: "s1", name: "스터디", icon: null },
  { id: "s2", name: "업무", icon: "💼" },
];

function noop() {}

describe("CollectionMoreMenu", () => {
  it("메뉴 버튼을 누르면 이동/복사 항목이 보인다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    expect(screen.getByText("다른 스페이스로 이동")).toBeInTheDocument();
    expect(screen.getByText("다른 스페이스에 복사")).toBeInTheDocument();
  });

  it("이동 → 스페이스 선택 시 onMove(spaceId)를 호출하고 닫힌다", () => {
    const onMove = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={onMove} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    fireEvent.click(screen.getByText("스터디"));
    expect(onMove).toHaveBeenCalledWith("s1");
    expect(screen.queryByText("스터디")).not.toBeInTheDocument(); // 팝오버 닫힘
  });

  it("복사 → 스페이스 선택 시 onCopy(spaceId)를 호출한다", () => {
    const onCopy = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스에 복사"));
    fireEvent.click(screen.getByText((content, element) => element?.textContent === "💼 업무"));
    expect(onCopy).toHaveBeenCalledWith("s2");
  });

  it("뒤로 버튼으로 첫 메뉴로 돌아간다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(screen.getByText("다른 스페이스에 복사")).toBeInTheDocument();
  });
});
