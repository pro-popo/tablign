import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
}

export const PANEL_STATE_KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function isPanelState(v: unknown): v is PanelState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PanelState).left === "boolean" &&
    typeof (v as PanelState).right === "boolean"
  );
}

/** 플랫폼별 영속화(localStorage / chrome.storage)를 주입하는 어댑터. read는 비동기(콜백) 허용. */
export interface PanelStateStorage {
  read: (cb: (state: PanelState | null) => void) => void;
  write: (state: PanelState) => void;
}

export function usePanelState(storage: PanelStateStorage) {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    storage.read((s) => { if (s) setState(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storage.write(next);
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
