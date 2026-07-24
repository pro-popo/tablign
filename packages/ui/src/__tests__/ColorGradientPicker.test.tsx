import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ColorGradientPicker } from "../ColorGradientPicker";
import { theme } from "../theme";

// jsdom은 PointerEvent에 clientX/pointerId를 전달하지 않는다(AppShell.test.tsx와 동일한 우회).
// 좌표를 실은 이벤트를 직접 디스패치하고, 상태 갱신이 있으므로 act로 감싼다.
function firePointer(target: EventTarget, type: "pointerdown" | "pointermove" | "pointerup", init: { clientX?: number } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  if (init.clientX !== undefined) Object.defineProperty(event, "clientX", { value: init.clientX });
  act(() => { target.dispatchEvent(event); });
}

describe("ColorGradientPicker (그라데이션 전용)", () => {
  it("그라데이션 값이면 시작·끝 핸들과 시작·끝 칩을 렌더하고 칩에 hex를 보여준다", () => {
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작 색 선택" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색 선택" })).toBeInTheDocument();
    expect(screen.getByText("#748FFC")).toBeInTheDocument();
    expect(screen.getByText("#9775FA")).toBeInTheDocument();
  });

  it("단색 값이 오면 표시용 두 스톱으로 승격하되 마운트 시 emit하지 않는다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="#748FFC" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("기본은 끝 스톱 선택이고, 시작 칩을 누르면 시작 스톱이 선택된다", () => {
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    const startHandle = screen.getByRole("button", { name: "시작 색" });
    const endHandle = screen.getByRole("button", { name: "끝 색" });
    // 기본 선택 = 끝
    expect(endHandle.style.boxShadow).toContain(theme.accent);
    expect(startHandle.style.boxShadow).not.toContain(theme.accent);
    // 시작 칩 클릭 → 시작 선택
    fireEvent.click(screen.getByRole("button", { name: "시작 색 선택" }));
    expect(startHandle.style.boxShadow).toContain(theme.accent);
  });

  it("토글·스왑 버튼은 없다(그라데이션 전용)", () => {
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "단색" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "그라데이션" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "시작 끝 색 교환" })).not.toBeInTheDocument();
  });

  it("마운트 후 부모가 value를 외부에서 바꾸면 그 값을 반영한다", () => {
    const { rerender } = render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    expect(screen.getByText("#9775FA")).toBeInTheDocument();
    rerender(<ColorGradientPicker value="linear-gradient(135deg, #FF0000, #00FF00)" onChange={() => {}} />);
    expect(screen.getByText("#FF0000")).toBeInTheDocument();
    expect(screen.getByText("#00FF00")).toBeInTheDocument();
    expect(screen.queryByText("#9775FA")).not.toBeInTheDocument();
  });

  it("끝 핸들을 왼쪽으로 드래그하면 endPos가 줄어든 문자열을 emit", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    const bar = screen.getByTestId("gradient-bar");
    // jsdom은 레이아웃이 0이므로 getBoundingClientRect를 200px 폭으로 스텁한다.
    bar.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200, top: 0, bottom: 34, height: 34, x: 0, y: 0, toJSON: () => {} });
    const endHandle = screen.getByRole("button", { name: "끝 색" });
    firePointer(endHandle, "pointerdown", { clientX: 184 });
    firePointer(window, "pointermove", { clientX: 100 }); // 중앙(=50%) 근처로 이동
    firePointer(window, "pointerup", { clientX: 100 });
    const last = onChange.mock.calls.at(-1)![0] as string;
    expect(last).toMatch(/#9775FA 5\d%\)$/); // endPos ≈ 50%
  });
});
