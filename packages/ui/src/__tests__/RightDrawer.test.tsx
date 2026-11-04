import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RightDrawer } from "../RightDrawer";

afterEach(() => vi.useRealTimers());

// jsdom은 PointerEvent에 clientX를 싣지 않는다 — 좌표를 실은 이벤트를 직접 보낸다
function firePointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX = 0) {
  act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX })); });
}

describe("RightDrawer", () => {
  const ui = (open: boolean, onResize = () => {}) => (
    <RightDrawer open={open} width={300} onResize={onResize} label="테마"><p>내용</p></RightDrawer>
  );

  it("열면 붙이고, 닫으면 빠져나간 뒤에 내린다", () => {
    vi.useFakeTimers();
    const { rerender } = render(ui(false));
    expect(screen.queryByRole("region", { name: "테마" })).toBeNull();

    rerender(ui(true));
    expect(screen.getByRole("region", { name: "테마" })).toHaveStyle({ width: "300px" });

    rerender(ui(false));
    // 빠져나가는 동안은 남아 있다
    expect(screen.getByRole("region", { name: "테마" })).toHaveAttribute("data-closing");
    act(() => { vi.advanceTimersByTime(180); });
    expect(screen.queryByRole("region", { name: "테마" })).toBeNull();
  });

  it("닫히는 중에 다시 열면 내리지 않는다", () => {
    vi.useFakeTimers();
    const { rerender } = render(ui(true));
    rerender(ui(false));
    act(() => { vi.advanceTimersByTime(100); });
    rerender(ui(true));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("region", { name: "테마" })).not.toHaveAttribute("data-closing");
  });

  it("왼쪽 끝을 왼쪽으로 끌면 그만큼 넓힌다", () => {
    const onResize = vi.fn();
    render(ui(true, onResize));
    const grip = screen.getByRole("separator", { name: "테마 크기 조절" });
    firePointer(grip, "pointerdown", 900);
    firePointer(grip, "pointermove", 850);
    expect(onResize).toHaveBeenLastCalledWith(350);
    firePointer(grip, "pointerup", 850);
    firePointer(grip, "pointermove", 800);
    expect(onResize).toHaveBeenCalledTimes(1);
  });
});
