import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("cancelLabel이 null이면 확인 버튼 하나만 있는 얼럿이 된다", () => {
    render(<ConfirmDialog open title="안내" cancelLabel={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["확인"]);
  });

  it("Escape는 이 창만 닫고 뒤에 깔린 창의 키 처리로 새지 않는다", () => {
    const behind = vi.fn();
    window.addEventListener("keydown", behind);
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="안내" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
    window.removeEventListener("keydown", behind);
  });
});
