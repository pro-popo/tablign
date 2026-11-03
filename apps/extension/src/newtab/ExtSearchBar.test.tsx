import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExtSearchBar } from "./ExtSearchBar";

vi.mock("../lib/supabase", () => ({ supabase: {} }));

const searchLinks = vi.fn();
vi.mock("@tablign/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tablign/core")>()),
  searchLinks: (...args: unknown[]) => searchLinks(...args),
}));

function link(id: string, title: string, spaceId = "s1") {
  return {
    id, url: `https://${id}.dev`, title, custom_title: null, favicon_url: null,
    collection: { title: "문서", space: { id: spaceId, name: "개발", icon: null } },
  };
}

function type(value: string) {
  const input = screen.getByPlaceholderText("탭 검색");
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
}

describe("ExtSearchBar", () => {
  const create = vi.fn();
  beforeEach(() => {
    searchLinks.mockReset();
    create.mockReset();
    Object.assign(chrome, { tabs: { create } });
  });

  it("늦게 도착한 이전 검색 결과가 최신 결과를 덮지 않는다", async () => {
    let resolveFirst!: (v: unknown) => void;
    searchLinks
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce([link("b", "fig 최신")]);
    render(<ExtSearchBar orgId="o1" onSelectSpace={vi.fn()} />);
    type("f");
    type("fig");
    expect(await screen.findByText("fig 최신")).toBeInTheDocument();

    await act(async () => resolveFirst([link("a", "f 이전")]));

    expect(screen.queryByText("f 이전")).not.toBeInTheDocument();
    expect(screen.getByText("fig 최신")).toBeInTheDocument();
  });

  it("스페이스는 아이콘으로만 보이고, 올리면 이름 말풍선이 뜬다", async () => {
    searchLinks.mockResolvedValue([link("a", "Figma")]);
    render(<ExtSearchBar orgId="o1" onSelectSpace={vi.fn()} />);
    type("fig");
    const icon = await screen.findByRole("button", { name: "개발" });
    expect(screen.queryByText("개발")).not.toBeInTheDocument();

    fireEvent.mouseEnter(icon);
    expect(screen.getByRole("tooltip")).toHaveTextContent("개발");

    fireEvent.mouseLeave(icon);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("스페이스 아이콘을 누르면 그 스페이스로 이동하고 링크는 열지 않는다", async () => {
    searchLinks.mockResolvedValue([link("a", "Figma", "s9")]);
    const onSelectSpace = vi.fn();
    render(<ExtSearchBar orgId="o1" onSelectSpace={onSelectSpace} />);
    type("fig");

    fireEvent.click(await screen.findByRole("button", { name: "개발" }));

    expect(onSelectSpace).toHaveBeenCalledWith("s9");
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByText("Figma")).not.toBeInTheDocument();
  });

  it("링크를 누르면 새 탭으로 연다", async () => {
    searchLinks.mockResolvedValue([link("a", "Figma")]);
    render(<ExtSearchBar orgId="o1" onSelectSpace={vi.fn()} />);
    type("fig");

    fireEvent.click(await screen.findByRole("button", { name: "Figma" }));

    expect(create).toHaveBeenCalledWith({ url: "https://a.dev" });
  });
});
