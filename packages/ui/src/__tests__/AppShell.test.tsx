import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AppShell } from "../AppShell";

// jsdom은 PointerEvent에 clientX/pointerId를 전달하지 않는다. 이 파일 한정으로
// 좌표를 실은 이벤트를 직접 디스패치하고, 상태 갱신(setDragging)이 있으므로 act로 감싼다.
function firePointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup", init: { clientX?: number; pointerId?: number } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  if (init.clientX !== undefined) Object.defineProperty(event, "clientX", { value: init.clientX });
  if (init.pointerId !== undefined) Object.defineProperty(event, "pointerId", { value: init.pointerId });
  act(() => { target.dispatchEvent(event); });
}

describe("AppShell", () => {
  it("left/center/right 슬롯을 렌더한다", () => {
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("CENTER")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  it("right가 닫히면 right 내용이 숨고 열기 버튼이 보인다", () => {
    const onToggleRight = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen={false}
        onToggleLeft={() => {}} onToggleRight={onToggleRight}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.queryByText("RIGHT")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "열린 탭 열기" }));
    expect(onToggleRight).toHaveBeenCalled();
  });

  it("패널이 열리면 리사이즈 핸들이 보이고 닫히면 사라진다", () => {
    const { rerender } = render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.getByRole("separator", { name: "왼쪽 패널 크기 조절" })).toBeInTheDocument();

    rerender(
      <AppShell
        leftOpen={false} rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.queryByRole("separator", { name: "왼쪽 패널 크기 조절" })).not.toBeInTheDocument();
  });

  it("left 핸들 드래그가 onResizeLeft를 시작폭+delta로 호출한다", () => {
    const onResizeLeft = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
        leftWidth={212} onResizeLeft={onResizeLeft}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    const handle = screen.getByRole("separator", { name: "왼쪽 패널 크기 조절" });
    firePointer(handle, "pointerdown", { clientX: 100, pointerId: 1 });
    firePointer(handle, "pointermove", { clientX: 130, pointerId: 1 });
    expect(onResizeLeft).toHaveBeenCalledWith(242);
  });

  it("right 핸들 드래그는 왼쪽으로 끌면 폭이 늘어난다", () => {
    const onResizeRight = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
        rightWidth={272} onResizeRight={onResizeRight}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    const handle = screen.getByRole("separator", { name: "오른쪽 패널 크기 조절" });
    firePointer(handle, "pointerdown", { clientX: 200, pointerId: 1 });
    firePointer(handle, "pointermove", { clientX: 170, pointerId: 1 });
    expect(onResizeRight).toHaveBeenCalledWith(302);
  });
});
