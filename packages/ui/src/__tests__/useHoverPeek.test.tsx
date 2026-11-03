import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useHoverPeek } from "../useHoverPeek";

describe("useHoverPeek", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("올린 뒤 0.15초가 지나야 열린다", () => {
    const { result } = renderHook(() => useHoverPeek());
    act(() => result.current.enter());
    act(() => { vi.advanceTimersByTime(140); });
    expect(result.current.open).toBe(false);
    act(() => { vi.advanceTimersByTime(20); });
    expect(result.current.open).toBe(true);
  });

  it("벗어나면 0.3초 뒤 닫히고, 그 전에 다시 올리면 닫히지 않는다", () => {
    const { result } = renderHook(() => useHoverPeek());
    act(() => { result.current.enter(); vi.advanceTimersByTime(200); });
    act(() => { result.current.leave(); vi.advanceTimersByTime(200); });
    act(() => { result.current.enter(); vi.advanceTimersByTime(400); });
    expect(result.current.open).toBe(true);
    act(() => { result.current.leave(); vi.advanceTimersByTime(310); });
    expect(result.current.open).toBe(false);
  });

  it("덮개 안에 입력 중(포커스)이면 벗어나도 닫지 않는다", () => {
    function Probe() {
      const peek = useHoverPeek();
      return (
        <>
          <div ref={peek.ref}><input aria-label="검색" /></div>
          <button type="button" onClick={peek.enter}>올리기</button>
          <button type="button" onClick={peek.leave}>벗어나기</button>
          <span>{peek.open ? "열림" : "닫힘"}</span>
        </>
      );
    }
    render(<Probe />);
    act(() => { screen.getByText("올리기").click(); vi.advanceTimersByTime(200); });
    act(() => { screen.getByLabelText("검색").focus(); });
    act(() => { screen.getByText("벗어나기").click(); vi.advanceTimersByTime(500); });
    expect(screen.getByText("열림")).toBeInTheDocument();
  });
});
