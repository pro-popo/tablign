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
  it("저장값이 없으면 기본값(둘 다 열림, 기본 폭)을 반환한다", () => {
    const { adapter } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: true, right: true, leftWidth: 212, rightWidth: 272 });
  });

  it("저장된 상태를 초기에 읽어온다", () => {
    const { adapter } = fakeStorage({ left: false, right: true, leftWidth: 300, rightWidth: 350 });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: true, leftWidth: 300, rightWidth: 350 });
  });

  it("폭 필드가 없던 기존 저장값은 기본 폭으로 보정한다(하위호환)", () => {
    const { adapter } = fakeStorage({ left: false, right: false } as PanelState);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: false, leftWidth: 212, rightWidth: 272 });
  });

  it("복원 시 범위 밖 폭은 클램프한다", () => {
    const { adapter } = fakeStorage({ left: true, right: true, leftWidth: 50, rightWidth: 999 });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state.leftWidth).toBe(180);
    expect(result.current.state.rightWidth).toBe(400);
  });

  it("toggleLeft가 상태를 뒤집고 저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.toggleLeft());
    expect(result.current.state).toEqual({ left: false, right: true, leftWidth: 212, rightWidth: 272 });
    expect(box.saved).toEqual({ left: false, right: true, leftWidth: 212, rightWidth: 272 });
  });

  it("setLeftWidth가 폭을 갱신·저장하고 범위를 클램프한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.setLeftWidth(320));
    expect(result.current.state.leftWidth).toBe(320);
    expect(box.saved?.leftWidth).toBe(320);
    act(() => result.current.setLeftWidth(1000));
    expect(result.current.state.leftWidth).toBe(400);
    act(() => result.current.setLeftWidth(10));
    expect(result.current.state.leftWidth).toBe(180);
  });

  it("setRightWidth가 폭을 갱신·저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.setRightWidth(360));
    expect(result.current.state.rightWidth).toBe(360);
    expect(box.saved?.rightWidth).toBe(360);
  });
});
