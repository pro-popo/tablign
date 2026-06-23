import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionSection } from "../CollectionSection";
import type { Collection, Link } from "@tablign/core";

const collection: Collection = {
  id: "c1", space_id: "s1", user_id: "u1", title: "읽을거리",
  icon: null, note: null, position: 1000, created_at: "2026-01-01T00:00:00Z",
};
const links: Link[] = [
  { id: "l1", collection_id: "c1", user_id: "u1", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, note: null, position: 1000, created_at: "x" },
];

function noop() {}

describe("CollectionSection", () => {
  it("제목을 보여준다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    expect(screen.getByText("읽을거리")).toBeInTheDocument();
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

  it("호버 시 나오는 수정 버튼으로 인라인 편집되고 Enter로 onRenameCollection을 호출한다", () => {
    const onRename = vi.fn();
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop}
        onRenameCollection={onRename} />,
    );
    // 헤더 호버 시에만 수정(연필) 버튼이 노출된다.
    fireEvent.mouseEnter(screen.getByText("읽을거리").closest("header")!);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 이름 수정" }));
    const input = screen.getByDisplayValue("읽을거리");
    fireEvent.change(input, { target: { value: "새 이름" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("c1", "새 이름");
  });

  it("autoEditTitle이면 마운트 시 제목 편집 입력이 보인다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop}
        onRenameCollection={noop} autoEditTitle />,
    );
    expect(screen.getByDisplayValue("읽을거리")).toBeInTheDocument();
  });
});
