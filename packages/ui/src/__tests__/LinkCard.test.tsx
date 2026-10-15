import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkCard } from "../LinkCard";
import type { Link } from "@tablign/core";

const baseLink: Link = {
  id: "1",
  collection_id: "c1",
  user_id: "u1",
  url: "https://example.com/page",
  title: "예시 제목",
  favicon_url: null,
  thumbnail_url: null,
  custom_title: null,
  note: null,
  position: 1000,
  created_at: "2026-01-01T00:00:00Z",
};

describe("LinkCard", () => {
  it("custom_title > title > 도메인 순으로 라벨을 보여준다", () => {
    const { rerender } = render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("예시 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, custom_title: "내 제목" }} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("내 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, title: null }} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("부제는 메모 하나만 — 메모가 없으면 도메인, 있으면 메모만 보여준다", () => {
    const { rerender } = render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, note: "팀 위키" }} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("팀 위키")).toBeInTheDocument();
    expect(screen.queryByText(/example\.com/)).toBeNull();
  });

  it("메모가 없으면 편집 폼 메모 칸이 도메인으로 채워지고, 그대로 저장하면 note는 null이다", () => {
    const onUpdate = vi.fn();
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(screen.getByLabelText("메모")).toHaveValue("example.com");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onUpdate).toHaveBeenCalledWith("1", expect.objectContaining({ note: null }));
  });

  it("편집 팝오버: 입력칸에서 Enter는 저장, 바깥 클릭은 저장 없이 닫는다", () => {
    const onUpdate = vi.fn();
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} onDelete={() => {}} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 제목" } });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "링크 편집" })).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    // 팝오버 안을 눌러도 카드의 링크 열기로 번지지 않는다
    fireEvent.click(screen.getByLabelText("제목"));
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 제목" } });
    fireEvent.keyDown(screen.getByLabelText("제목"), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith("1", expect.objectContaining({ custom_title: "새 제목" }));
    expect(screen.queryByRole("dialog", { name: "링크 편집" })).toBeNull();
  });

  it("카드를 클릭하면 onOpen(url)이 호출된다", () => {
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} onDelete={() => {}} />);
    // 제목 영역을 클릭하면 카드 onClick으로 버블링되어 onOpen이 호출된다.
    fireEvent.click(screen.getByText("예시 제목"));
    expect(onOpen).toHaveBeenCalledWith("https://example.com/page");
  });

  it("삭제 버튼을 누르면 onDelete(id)가 호출된다", () => {
    const onDelete = vi.fn();
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("onUpdate 미제공이면 편집 버튼이 없다", () => {
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole("button", { name: "편집" })).toBeNull();
  });

  it("편집 버튼을 누르면 폼이 열리고 저장 시 onUpdate(id, patch)를 호출한다", () => {
    const onUpdate = vi.fn();
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 제목" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://new.com" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "메모" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onUpdate).toHaveBeenCalledWith("1", {
      custom_title: "새 제목",
      url: "https://new.com",
      note: "메모",
    });
  });
});
