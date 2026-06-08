import { describe, expect, it, beforeEach } from "vitest";
import { readPanelState, writePanelState, type PanelState } from "./usePanelState";

const store: Record<string, string> = {};
const fakeStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
} as Pick<Storage, "getItem" | "setItem">;

describe("panel state 직렬화", () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it("저장한 상태를 다시 읽는다", () => {
    const state: PanelState = { left: false, right: true };
    writePanelState(fakeStorage, state);
    expect(readPanelState(fakeStorage)).toEqual(state);
  });

  it("저장값이 없으면 기본값(둘 다 열림)을 반환한다", () => {
    expect(readPanelState(fakeStorage)).toEqual({ left: true, right: true });
  });

  it("손상된 값이면 기본값으로 폴백한다", () => {
    store["tablign.panels"] = "not-json";
    expect(readPanelState(fakeStorage)).toEqual({ left: true, right: true });
  });
});
