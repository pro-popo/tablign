import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ColorGradientPicker } from "../ColorGradientPicker";

// jsdom은 PointerEvent에 clientX/pointerId를 전달하지 않는다(AppShell.test.tsx와 동일한 우회).
// 좌표를 실은 이벤트를 직접 디스패치하고, 상태 갱신이 있으므로 act로 감싼다.
function firePointer(target: EventTarget, type: "pointerdown" | "pointermove" | "pointerup", init: { clientX?: number } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  if (init.clientX !== undefined) Object.defineProperty(event, "clientX", { value: init.clientX });
  act(() => { target.dispatchEvent(event); });
}

describe("ColorGradientPicker", () => {
  it("단색 값이면 색 핸들 하나, 그라데이션 토글 있음", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "그라데이션" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "시작 색" })).not.toBeInTheDocument();
  });

  it("그라데이션으로 토글하면 시작·끝 핸들이 나오고 onChange가 그라데이션 문자열을 emit", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="#748FFC" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "그라데이션" }));
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^linear-gradient\(135deg,/));
  });

  it("핸들 탭하면 팔레트(HEX 입력) 팝오버가 열린다", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.queryByDisplayValue("#748FFC")).not.toBeInTheDocument();
    firePointer(screen.getByRole("button", { name: "색" }), "pointerdown");
    expect(screen.getByDisplayValue("#748FFC")).toBeInTheDocument();
  });

  it("그라데이션에서 끝 색을 바꾸면 그 색이 emit된다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    const endHandle = screen.getByRole("button", { name: "끝 색" });
    firePointer(endHandle, "pointerdown", { clientX: 0 });
    firePointer(window, "pointerup", { clientX: 0 });
    const hexInput = screen.getByDisplayValue("#9775FA");
    fireEvent.change(hexInput, { target: { value: "#FF0000" } });
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #748FFC, #FF0000)");
  });

  it("스왑 버튼이 시작·끝 색을 맞바꾼다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 끝 색 교환" }));
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #9775FA, #748FFC)");
  });

  it("마운트 후 부모가 value를 외부에서 바꾸면 그 값을 반영한다", () => {
    const { rerender } = render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "색" })).toBeInTheDocument();
    rerender(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "색" })).not.toBeInTheDocument();
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
    // 드래그였으므로 팔레트는 열리지 않음
    expect(screen.queryByDisplayValue("#9775FA")).not.toBeInTheDocument();
  });
});
