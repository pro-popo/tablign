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

  it("카드를 클릭하면 onOpen(url)이 호출된다", () => {
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /예시 제목/ }));
    expect(onOpen).toHaveBeenCalledWith("https://example.com/page");
  });

  it("삭제 버튼을 누르면 onDelete(id)가 호출된다", () => {
    const onDelete = vi.fn();
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
