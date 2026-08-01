import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddCollectionButton } from "../AddCollectionButton";

describe("AddCollectionButton", () => {
  it("본체를 누르면 메뉴를 열지 않고 바로 컬렉션을 만든다", () => {
    const onCreate = vi.fn();
    render(<AddCollectionButton onCreate={onCreate} onImportCode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("▾를 누르면 두 경로가 있는 메뉴가 열린다", () => {
    render(<AddCollectionButton onCreate={vi.fn()} onImportCode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 추가 방법" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "새 컬렉션" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "공유 코드로 추가" })).toBeInTheDocument();
  });

  it("'공유 코드로 추가'를 누르면 핸들러를 호출하고 메뉴를 닫는다", () => {
    const onImportCode = vi.fn();
    render(<AddCollectionButton onCreate={vi.fn()} onImportCode={onImportCode} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 추가 방법" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "공유 코드로 추가" }));
    expect(onImportCode).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Escape로 메뉴가 닫힌다", () => {
    render(<AddCollectionButton onCreate={vi.fn()} onImportCode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 추가 방법" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("바깥을 클릭하면 메뉴가 닫힌다", () => {
    render(<AddCollectionButton onCreate={vi.fn()} onImportCode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 추가 방법" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("aria-expanded가 메뉴 상태를 반영한다", () => {
    render(<AddCollectionButton onCreate={vi.fn()} onImportCode={vi.fn()} />);
    const caret = screen.getByRole("button", { name: "컬렉션 추가 방법" });
    expect(caret).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(caret);
    expect(caret).toHaveAttribute("aria-expanded", "true");
  });
});
