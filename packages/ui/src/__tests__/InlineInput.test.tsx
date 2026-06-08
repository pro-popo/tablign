import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineInput } from "../InlineInput";

describe("InlineInput", () => {
  it("Enter로 값을 제출하고 입력을 비운다", () => {
    const onSubmit = vi.fn();
    render(<InlineInput placeholder="컬렉션 이름" onSubmit={onSubmit} onCancel={() => {}} />);
    const input = screen.getByPlaceholderText("컬렉션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "새 컬렉션" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("새 컬렉션");
    expect(input.value).toBe("");
  });

  it("빈 값은 제출하지 않는다", () => {
    const onSubmit = vi.fn();
    render(<InlineInput placeholder="x" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.keyDown(screen.getByPlaceholderText("x"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Esc로 취소한다", () => {
    const onCancel = vi.fn();
    render(<InlineInput placeholder="x" onSubmit={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByPlaceholderText("x"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
