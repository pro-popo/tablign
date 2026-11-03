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

  it("닫을 때 내용이 즉시 사라지지 않고 접힘 애니메이션(200ms) 후 Rail로 바뀐다", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <AppShell
          leftOpen rightOpen
          onToggleLeft={() => {}} onToggleRight={() => {}}
          left={<div>LEFT</div>} right={<div>RIGHT</div>}
        >
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("LEFT")).toBeInTheDocument();

      act(() => {
        rerender(
          <AppShell
            leftOpen={false} rightOpen
            onToggleLeft={() => {}} onToggleRight={() => {}}
            left={<div>LEFT</div>} right={<div>RIGHT</div>}
          >
            <div>CENTER</div>
          </AppShell>,
        );
      });
      // 닫는 순간: 내용은 아직 남아 있고(함께 밀려 사라지도록) Rail 버튼은 아직 없다.
      expect(screen.getByText("LEFT")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "사이드바 열기" })).not.toBeInTheDocument();

      // 애니메이션 시간이 지나면 Rail로 교체된다.
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.queryByText("LEFT")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "사이드바 열기" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  describe("좁은 화면(narrow)", () => {
    const closed = { open: false, enter: () => {}, leave: () => {} };

    it("사이드바는 붙박이로 두지 않고, 덮개가 열려야 보인다", () => {
      const { rerender } = render(
        <AppShell narrow leftOpen={false} rightOpen={false} onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("LEFT")).not.toBeVisible();
      expect(screen.queryByRole("button", { name: "사이드바 열기" })).not.toBeInTheDocument();
      rerender(
        <AppShell narrow leftOpen={false} rightOpen={false} onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={{ ...closed, open: true }} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("LEFT")).toBeVisible();
    });

    it("열린 탭은 지금의 접힘 레일로 두고, 레일에 올리면 덮개를 연다", () => {
      const enter = vi.fn();
      const { rerender } = render(
        <AppShell narrow leftOpen={false} rightOpen={false} onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={{ ...closed, enter }} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      const rail = screen.getByRole("button", { name: "열린 탭 열기" });
      expect(screen.getByText("RIGHT")).not.toBeVisible();
      fireEvent.mouseEnter(rail);
      expect(enter).toHaveBeenCalled();
      rerender(
        <AppShell narrow leftOpen={false} rightOpen={false} onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={{ ...closed, open: true }} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("RIGHT")).toBeVisible();
    });

    it("열린 탭을 고정(rightOpen)하면 지금처럼 붙박이로 펼친다", () => {
      render(
        <AppShell narrow leftOpen={false} rightOpen onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("RIGHT")).toBeVisible();
      expect(screen.queryByRole("button", { name: "열린 탭 열기" })).not.toBeInTheDocument();
    });
  });

  describe("넓은 화면에서 접어 둔 패널", () => {
    const closed = { open: false, enter: () => {}, leave: () => {} };

    it("접힌 사이드바 레일에 올리면 덮개를 열고, 아이콘을 누르면 고정(onToggleLeft)한다", () => {
      const enter = vi.fn();
      const onToggleLeft = vi.fn();
      const { rerender } = render(
        <AppShell leftOpen={false} rightOpen onToggleLeft={onToggleLeft} onToggleRight={() => {}}
          leftPeek={{ ...closed, enter }} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      const rail = screen.getByRole("button", { name: "사이드바 열기" });
      fireEvent.mouseEnter(rail);
      expect(enter).toHaveBeenCalled();
      fireEvent.click(rail);
      expect(onToggleLeft).toHaveBeenCalled();
      rerender(
        <AppShell leftOpen={false} rightOpen onToggleLeft={onToggleLeft} onToggleRight={() => {}}
          leftPeek={{ ...closed, open: true }} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getByText("LEFT")).toBeVisible();
    });

    it("접힌 열린 탭 레일에 올리면 덮개를 연다", () => {
      const enter = vi.fn();
      render(
        <AppShell leftOpen rightOpen={false} onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={{ ...closed, enter }} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      fireEvent.mouseEnter(screen.getByRole("button", { name: "열린 탭 열기" }));
      expect(enter).toHaveBeenCalled();
    });

    it("펼쳐 둔 패널은 덮개를 따로 그리지 않는다", () => {
      render(
        <AppShell leftOpen rightOpen onToggleLeft={() => {}} onToggleRight={() => {}}
          leftPeek={closed} rightPeek={closed} left={<div>LEFT</div>} right={<div>RIGHT</div>}>
          <div>CENTER</div>
        </AppShell>,
      );
      expect(screen.getAllByText("LEFT")).toHaveLength(1);
      expect(screen.getAllByText("RIGHT")).toHaveLength(1);
    });
  });
});
