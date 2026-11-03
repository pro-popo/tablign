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

  it("스페이스 아이콘은 사이드바와 같은 토스페이스 폰트로 그린다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    expect(screen.getByText("💼").style.fontFamily).toContain("Tossface");
  });

  it("아이콘이 없는 스페이스는 사이드바처럼 흐린 폴더로 표시한다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    const folder = screen.getByText("📁");
    expect(folder.style.opacity).toBe("0.45");
    expect(folder.style.fontFamily).toContain("Tossface");
  });

  it("뒤로 버튼으로 첫 메뉴로 돌아간다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(screen.getByText("다른 스페이스에 복사")).toBeInTheDocument();
  });

  it("onShare가 있으면 '공유 코드' 항목이 보이고 클릭 시 호출된다", () => {
    const onShare = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("공유 코드"));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("공유 코드")).not.toBeInTheDocument(); // 팝오버 닫힘
  });

  it("다른 스페이스가 없어도 onShare만으로 메뉴가 뜬다", () => {
    render(<CollectionMoreMenu spaces={[]} onMove={noop} onCopy={noop} onShare={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    expect(screen.getByText("공유 코드")).toBeInTheDocument();
    expect(screen.queryByText("다른 스페이스로 이동")).not.toBeInTheDocument();
  });

  it("onCopyLinks가 있으면 '링크 전체 복사' 클릭 시 호출되고 닫힌다", () => {
    const onCopyLinks = vi.fn();
    render(<CollectionMoreMenu spaces={[]} onMove={noop} onCopy={noop} onCopyLinks={onCopyLinks} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("링크 전체 복사"));
    expect(onCopyLinks).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("링크 전체 복사")).not.toBeInTheDocument();
  });
});
