import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddLinkInput } from "../AddLinkInput";

describe("AddLinkInput", () => {
  it("URL을 입력하고 제출하면 onAdd가 호출되고 입력이 비워진다", () => {
    const onAdd = vi.fn();
    render(<AddLinkInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("URL 붙여넣기") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).toHaveBeenCalledWith("https://x.com");
    expect(input.value).toBe("");
  });

  it("빈 입력은 onAdd를 호출하지 않는다", () => {
    const onAdd = vi.fn();
    render(<AddLinkInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("URL 붙여넣기");
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
