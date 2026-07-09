import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast.show("복사했어요")}>show</button>;
}

describe("ToastProvider", () => {
  it("show 호출 시 메시지를 하단 중앙, 다이얼로그(1100)보다 위에 표시한다", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("show"));
    const item = screen.getByRole("status");
    expect(item).toHaveTextContent("복사했어요");
    const container = item.parentElement as HTMLElement;
    // 다이얼로그 오버레이(zIndex 1100)에 가려지지 않아야 한다
    expect(Number(container.style.zIndex)).toBeGreaterThan(1100);
    // 하단 중앙 정렬(다이얼로그 아래에 뜨도록)
    expect(container.style.left).toBe("50%");
  });
});
