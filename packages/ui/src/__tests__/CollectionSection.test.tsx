import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionSection } from "../CollectionSection";
import type { Collection, Link } from "@tablign/core";

const collection: Collection = {
  id: "c1", space_id: "s1", user_id: "u1", title: "읽을거리",
  icon: null, note: null, position: 1000, created_at: "2026-01-01T00:00:00Z",
};
const links: Link[] = [
  { id: "l1", collection_id: "c1", user_id: "u1", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, position: 1000, created_at: "x" },
];

function noop() {}

describe("CollectionSection", () => {
  it("제목과 링크 개수를 보여준다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    expect(screen.getByText("읽을거리")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("헤더의 접기 버튼을 누르면 링크가 숨겨진다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "섹션 접기" }));
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("링크 추가를 열고 Enter로 onAddLink를 호출한다", () => {
    const onAddLink = vi.fn();
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={onAddLink} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "링크 추가" }));
    const input = screen.getByPlaceholderText("URL 붙여넣기") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddLink).toHaveBeenCalledWith("https://x.com");
  });
});
