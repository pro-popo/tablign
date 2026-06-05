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
  it("custom_title이 있으면 그것을, 없으면 title을 보여준다", () => {
    const { rerender } = render(<LinkCard link={baseLink} onOpen={() => {}} />);
    expect(screen.getByText("예시 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, custom_title: "내가 정한 제목" }} onOpen={() => {}} />);
    expect(screen.getByText("내가 정한 제목")).toBeInTheDocument();
  });

  it("title도 custom_title도 없으면 도메인을 보여준다", () => {
    render(<LinkCard link={{ ...baseLink, title: null }} onOpen={() => {}} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("클릭하면 onOpen이 url과 함께 호출된다", () => {
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("https://example.com/page");
  });
});
