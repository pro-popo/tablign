import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
  leftWidth: number;
  rightWidth: number;
  /** 테마 서랍 — 열린 탭 패널과 따로 */
  themeWidth: number;
}

export const PANEL_STATE_KEY = "tablign.panels";
export const MIN_PANEL_WIDTH = 180;
export const MAX_PANEL_WIDTH = 400;
/** 테마 서랍은 그라데이션 편집 칸·배경 종류 버튼이 들어가야 해 더 좁아지지 않는다 */
export const MIN_THEME_WIDTH = 260;
const DEFAULT: PanelState = { left: true, right: true, leftWidth: 212, rightWidth: 272, themeWidth: 300 };

function clampWidth(w: number, min = MIN_PANEL_WIDTH): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(min, w));
}

// 하위호환: 폭 개념이 없던 기존 저장값도 유효로 본다(left/right만 필수).
export function isPanelState(v: unknown): v is PanelState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PanelState).left === "boolean" &&
    typeof (v as PanelState).right === "boolean"
  );
}

// 저장값을 완전한 PanelState로 정규화. 폭이 없거나 숫자가 아니면 기본값, 있으면 클램프.
function normalize(v: PanelState): PanelState {
  return {
    left: v.left,
    right: v.right,
    leftWidth: typeof v.leftWidth === "number" ? clampWidth(v.leftWidth) : DEFAULT.leftWidth,
    rightWidth: typeof v.rightWidth === "number" ? clampWidth(v.rightWidth) : DEFAULT.rightWidth,
    themeWidth: typeof v.themeWidth === "number" ? clampWidth(v.themeWidth, MIN_THEME_WIDTH) : DEFAULT.themeWidth,
  };
}

/** 플랫폼별 영속화(localStorage / chrome.storage)를 주입하는 어댑터. read는 비동기(콜백) 허용. */
export interface PanelStateStorage {
  read: (cb: (state: PanelState | null) => void) => void;
  write: (state: PanelState) => void;
}

export function usePanelState(storage: PanelStateStorage) {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    storage.read((s) => { if (s) setState(normalize(s)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: "left" | "right") {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storage.write(next);
      return next;
    });
  }

  function setWidth(key: "leftWidth" | "rightWidth" | "themeWidth", value: number) {
    setState((prev) => {
      const next = { ...prev, [key]: clampWidth(value, key === "themeWidth" ? MIN_THEME_WIDTH : MIN_PANEL_WIDTH) };
      storage.write(next);
      return next;
    });
  }

  return {
    state,
    toggleLeft: () => toggle("left"),
    toggleRight: () => toggle("right"),
    setLeftWidth: (w: number) => setWidth("leftWidth", w),
    setRightWidth: (w: number) => setWidth("rightWidth", w),
    setThemeWidth: (w: number) => setWidth("themeWidth", w),
  };
}
