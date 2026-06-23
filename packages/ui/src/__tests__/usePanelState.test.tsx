import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePanelState, type PanelState, type PanelStateStorage } from "../usePanelState";

function fakeStorage(initial: PanelState | null) {
  const box = { saved: initial };
  const adapter: PanelStateStorage = {
    read: (cb) => cb(box.saved),
    write: (s) => { box.saved = s; },
  };
  return { adapter, box };
}

describe("usePanelState (shared)", () => {
  it("저장값이 없으면 기본값(둘 다 열림)을 반환한다", () => {
    const { adapter } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: true, right: true });
  });

  it("저장된 상태를 초기에 읽어온다", () => {
    const { adapter } = fakeStorage({ left: false, right: true });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: true });
  });

  it("toggleLeft가 상태를 뒤집고 저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.toggleLeft());
    expect(result.current.state).toEqual({ left: false, right: true });
    expect(box.saved).toEqual({ left: false, right: true });
  });
});
